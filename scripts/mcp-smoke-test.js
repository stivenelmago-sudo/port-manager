/**
 * Smoke test for the PortPilot MCP server.
 *
 * Spawns the server, drives an MCP initialize + tools/list + a sample
 * tools/call round-trip over stdio, and asserts the basic shape.
 */

const { spawn } = require("child_process");
const path = require("path");

const server = spawn(process.execPath, [path.join(__dirname, "..", "mcp-server", "index.js")], {
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = Buffer.alloc(0);
const pending = new Map();
let nextId = 1;

function send(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: "2.0", id, method, params: params || {} };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const frame = JSON.stringify(msg) + "\n";
    server.stdin.write(frame);
  });
}

function onFrame(text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }
  if (msg.id != null && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
}

server.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  let idx;
  while ((idx = buffer.indexOf(0x0a)) >= 0) {
    const line = buffer.slice(0, idx).toString("utf8").trim();
    buffer = buffer.slice(idx + 1);
    if (line) onFrame(line);
  }
});

server.on("exit", (code) => {
  process.stderr.write(`[smoke] server exited with code ${code}\n`);
});

async function main() {
  // 1. initialize
  const initResult = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.0.0" },
  });
  if (!initResult.serverInfo || initResult.serverInfo.name !== "portpilot") {
    throw new Error(`Bad initialize result: ${JSON.stringify(initResult)}`);
  }
  process.stderr.write(`[smoke] initialized: ${initResult.serverInfo.name} v${initResult.serverInfo.version}\n`);

  // MCP requires the client to send "initialized" notification after initialize.
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  // 2. list tools
  const { tools } = await send("tools/list", {});
  const names = tools.map((t) => t.name).sort();
  const expected = [
    "check_port",
    "find_ports_by_process",
    "get_port_info",
    "kill_pid",
    "kill_port",
    "list_listening_ports",
    "witr_availability",
  ];
  for (const e of expected) {
    if (!names.includes(e)) throw new Error(`Missing tool: ${e}`);
  }
  process.stderr.write(`[smoke] tools: ${names.join(", ")}\n`);

  // 3. list resources
  const { resources } = await send("resources/list", {});
  if (!resources.find((r) => r.uri === "portpilot://manifest")) {
    throw new Error("Missing portpilot://manifest resource");
  }
  process.stderr.write(`[smoke] resources: ${resources.map((r) => r.uri).join(", ")}\n`);

  // 4. read manifest
  const manifestRead = await send("resources/read", { uri: "portpilot://manifest" });
  const manifest = JSON.parse(manifestRead.contents[0].text);
  if (manifest.name !== "portpilot") throw new Error("Bad manifest");
  process.stderr.write(`[smoke] manifest.commands: ${manifest.commands.join(", ")}\n`);

  // 5. call list_listening_ports (no enrich to keep it fast and avoid WITR noise)
  const portsResult = await send("tools/call", {
    name: "list_listening_ports",
    arguments: { enrich: false },
  });
  if (portsResult.isError) throw new Error(`list_listening_ports errored: ${JSON.stringify(portsResult)}`);
  const parsed = JSON.parse(portsResult.content[0].text);
  process.stderr.write(`[smoke] listening ports found: ${parsed.count}\n`);

  // 6. call check_port for a random high port — should be free
  const check = await send("tools/call", {
    name: "check_port",
    arguments: { port: 49151 },
  });
  const checkParsed = JSON.parse(check.content[0].text);
  process.stderr.write(`[smoke] check_port(49151) → free=${checkParsed.free}\n`);

  // 7. kill_port must refuse without confirm
  const refused = await send("tools/call", {
    name: "kill_port",
    arguments: { port: 49151, confirm: false },
  });
  if (!refused.isError) throw new Error("kill_port should refuse without confirm");
  process.stderr.write(`[smoke] kill_port without confirm correctly refused\n`);

  // 8. find_free_port must return a free port
  const free = await send("tools/call", {
    name: "find_free_port",
    arguments: { preferred: 50000, max: 5 },
  });
  const freeParsed = JSON.parse(free.content[0].text);
  if (!freeParsed.found) throw new Error("find_free_port failed to find a free port");
  process.stderr.write(`[smoke] find_free_port → port=${freeParsed.port}\n`);

  // 9. list_connections — should at least not throw
  const conns = await send("tools/call", {
    name: "list_connections",
    arguments: { state: "LISTEN", limit: 50 },
  });
  const connsParsed = JSON.parse(conns.content[0].text);
  if (typeof connsParsed.count !== "number") throw new Error("list_connections bad shape");
  process.stderr.write(`[smoke] list_connections → ${connsParsed.count} LISTEN rows (source=${connsParsed.source})\n`);

  // 10. get_process_info — test on self pid (always exists)
  const pi = await send("tools/call", {
    name: "get_process_info",
    arguments: { pid: process.pid },
  });
  const piParsed = JSON.parse(pi.content[0].text);
  if (!piParsed.pid) throw new Error("get_process_info missing pid");
  process.stderr.write(`[smoke] get_process_info(self) → pid=${piParsed.pid}, comm=${piParsed.comm || piParsed.imageName || "?"}\n`);

  // 11. find_processes_by_name — search for the running node (smoke test)
  const fpn = await send("tools/call", {
    name: "find_processes_by_name",
    arguments: { query: "node", limit: 20 },
  });
  const fpnParsed = JSON.parse(fpn.content[0].text);
  process.stderr.write(`[smoke] find_processes_by_name('node') → ${fpnParsed.count} matches\n`);

  // 12. list_docker_containers — must not throw even when no docker
  const dc = await send("tools/call", { name: "list_docker_containers", arguments: {} });
  const dcParsed = JSON.parse(dc.content[0].text);
  process.stderr.write(`[smoke] list_docker_containers → ${dcParsed.count} containers, runtimes=${JSON.stringify(dcParsed.runtimes)}\n`);

  // 13. list_locks
  const ll = await send("tools/call", { name: "list_locks", arguments: { limit: 5 } });
  const llParsed = JSON.parse(ll.content[0].text);
  process.stderr.write(`[smoke] list_locks → ${llParsed.total} total locks\n`);

  // 14. get_network_interfaces
  const ni = await send("tools/call", { name: "get_network_interfaces", arguments: {} });
  const niParsed = JSON.parse(ni.content[0].text);
  process.stderr.write(`[smoke] get_network_interfaces → ${niParsed.count} addresses\n`);

  // 15. get_system_info
  const si = await send("tools/call", { name: "get_system_info", arguments: {} });
  const siParsed = JSON.parse(si.content[0].text);
  process.stderr.write(`[smoke] get_system_info → ${siParsed.hostname} (${siParsed.cpus.count} CPUs, ${(siParsed.memory.totalBytes / 1e9).toFixed(1)} GB)\n`);

  // 16. kill_by_name must refuse without confirm
  const refused2 = await send("tools/call", {
    name: "kill_by_name",
    arguments: { name: "node", confirm: false },
  });
  if (!refused2.isError) throw new Error("kill_by_name should refuse without confirm");
  process.stderr.write(`[smoke] kill_by_name without confirm correctly refused\n`);

  // 17. MCP runtime config: write a config disabling some tools and one
  //     path-suppression check, then verify tools/list drops them and
  //     tools/call returns isError for the disabled ones.
  const { writeFileSync, mkdirSync, mkdtempSync, existsSync } = require("fs");
  const { tmpdir } = require("os");
  const path = require("path");
  const cfgDir = mkdtempSync(path.join(tmpdir(), "portpilot-mcp-"));
  const cfgFile = path.join(cfgDir, "mcp.json");
  process.env.PORTPILOT_MCP_CONFIG = cfgFile;
  writeFileSync(cfgFile, JSON.stringify({
    enabled: true,
    disabledTools: ["kill_pid", "kill_by_name", "get_system_info"],
    version: "1.1.0",
  }, null, 2));
  const filtered = await send("tools/list", {});
  const filteredToolNames = filtered.tools.map((t) => t.name).sort();
  for (const name of ["kill_pid", "kill_by_name", "get_system_info"]) {
    if (filteredToolNames.includes(name)) {
      throw new Error(`tools/list should hide disabled tool ${name}, but it's present`);
    }
  }
  // mcpState metadata is exposed via _portpilot (advisory)
  if (filtered._portpilot && Array.isArray(filtered._portpilot.blocked)) {
    if (!filtered._portpilot.blocked.includes("kill_pid")) {
      throw new Error("_portpilot.blocked missing kill_pid");
    }
  }
  process.stderr.write(`[smoke] config filter: ${filtered.tools.length} tools after filter (blocked: ${JSON.stringify(filtered._portpilot?.blocked || [])})\n`);

  // 18. Calling a disabled tool returns isError
  const denied = await send("tools/call", {
    name: "kill_pid",
    arguments: { pid: 1, confirm: true },
  });
  if (!denied.isError) {
    throw new Error("Expected isError when calling a disabled tool (kill_pid)");
  }
  process.stderr.write(`[smoke] disabled tool call rejected with isError\n`);

  // 19. Master switch off — list returns 0 tools, calls all denied
  writeFileSync(cfgFile, JSON.stringify({ enabled: false, disabledTools: [], version: "1.1.0" }, null, 2));
  const off = await send("tools/list", {});
  if (off.tools.length !== 0) throw new Error("Expected 0 tools when MCP disabled globally");
  const denied2 = await send("tools/call", { name: "check_port", arguments: { port: 49151 } });
  if (!denied2.isError) throw new Error("Expected isError when MCP disabled globally");
  process.stderr.write(`[smoke] MCP disabled globally: 0 tools + all calls rejected\n`);

  // Restore default config for the rest of the suite.
  delete process.env.PORTPILOT_MCP_CONFIG;

  process.stderr.write("[smoke] OK\n");
  server.kill();
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[smoke] FAILED: ${err.stack || err.message}\n`);
  server.kill();
  process.exit(1);
});
