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

  process.stderr.write("[smoke] OK\n");
  server.kill();
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[smoke] FAILED: ${err.stack || err.message}\n`);
  server.kill();
  process.exit(1);
});
