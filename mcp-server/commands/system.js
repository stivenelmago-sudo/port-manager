/**
 * PortPilot MCP - System Tools
 *
 * Extra tools beyond the core port listing: process inspection, network
 * diagnostics, container/lock listings, and free-port scanning. Designed
 * so an AI agent can answer "what's on port X?", "who's running on this
 * PID?", "what's holding my file?", and "give me a port I can bind to"
 * without leaving the MCP session.
 *
 * Cross-platform notes:
 *   - Linux:   uses `ss` (preferred, no root) and `ps`
 *   - macOS:   uses `netstat -an` and `ps`
 *   - Windows: uses `netstat -ano` and `tasklist`
 *
 * Destructive tools (kill_by_name) require `confirm: true` and have a
 * safety cap on the number of processes that will be signalled in one call.
 */

const { execFile } = require("child_process");
const { promisify } = require("util");
const os = require("os");
const net = require("net");
const path = require("path");

const execFileP = promisify(execFile);
const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const IS_LINUX = !IS_WIN && !IS_MAC;

const portService = require("../../src/core/portService");
const containerService = require("../../src/core/containerService");
const lockService = require("../../src/core/lockService");

const KILL_SAFETY_CAP = 50; // never kill more than this in a single call

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function safeInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function run(cmd, args, opts = {}) {
  return execFileP(cmd, args, { timeout: opts.timeout || 8000, maxBuffer: 4 * 1024 * 1024 });
}

function asText(obj) { return JSON.stringify(obj, null, 2); }

// ---------------------------------------------------------------------------
// 1. find_free_port
// ---------------------------------------------------------------------------

/**
 * Scan forward from `preferred` and return the first port that is free.
 * Returns `{found:false, tried}` if no free port found in `max` tries.
 */
async function findFreePort({ preferred = 3000, max = 100, host = "127.0.0.1" } = {}) {
  const start = safeInt(preferred) ?? 3000;
  const cap = Math.max(1, Math.min(1000, safeInt(max) ?? 100));
  for (let i = 0; i < cap; i++) {
    const port = start + i;
    if (port < 1 || port > 65535) break;
    // eslint-disable-next-line no-await-in-loop
    const free = await portService.checkPortFree(port);
    if (free) return { found: true, port, tried: i + 1 };
  }
  return { found: false, tried: cap };
}

// ---------------------------------------------------------------------------
// 2. list_connections — all TCP socket states (not just LISTEN)
// ---------------------------------------------------------------------------

function parseSsTan(stdout) {
  // Lines look like: "ESTAB  0  0  192.168.1.5:443  192.168.1.10:51234  users:((\"sshd\",pid=1489,...))"
  const rows = [];
  const lines = stdout.split("\n").slice(1); // header
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const state = parts[0];
    const localMatch = (parts[3] || "").match(/^(.+):(\d+)$/);
    const peerMatch = (parts[4] || "").match(/^(.+):(\d+)$/);
    if (!localMatch) continue;
    const pidMatch = line.match(/pid=(\d+)/);
    rows.push({
      protocol: "tcp",
      state,
      local: { address: localMatch[1], port: safeInt(localMatch[2]) },
      peer: peerMatch ? { address: peerMatch[1], port: safeInt(peerMatch[2]) } : null,
      pid: pidMatch ? safeInt(pidMatch[1]) : null,
    });
  }
  return rows;
}

function parseNetstatWindows(stdout) {
  const rows = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^(TCP|UDP)\s+(\S+):(\d+)\s+(\S+):(\d+)\s+(\S+)\s+(\d+)/);
    if (!m) continue;
    rows.push({
      protocol: m[1].toLowerCase(),
      state: m[6] || "UNKNOWN",
      local: { address: m[2], port: safeInt(m[3]) },
      peer: { address: m[4], port: safeInt(m[5]) },
      pid: safeInt(m[7]),
    });
  }
  return rows;
}

async function listConnections({ state, port, limit = 500 } = {}) {
  let rows = [];
  let source = "unknown";
  try {
    if (IS_LINUX) {
      const { stdout } = await run("ss", ["-tanp", "state", "all"]);
      rows = parseSsTan(stdout);
      source = "ss";
    } else if (IS_MAC) {
      const { stdout } = await run("netstat", ["-an", "-p", "tcp"]);
      rows = parseNetstatWindows(stdout); // netstat format is similar enough
      source = "netstat";
    } else if (IS_WIN) {
      const { stdout } = await run("netstat", ["-ano", "-p", "TCP"]);
      rows = parseNetstatWindows(stdout);
      source = "netstat";
    }
  } catch (e) {
    return { count: 0, source, error: e.message, rows: [] };
  }

  if (state) rows = rows.filter((r) => (r.state || "").toLowerCase() === String(state).toLowerCase());
  if (port) {
    const p = safeInt(port);
    rows = rows.filter((r) => r.local.port === p || r.peer.port === p);
  }
  if (rows.length > limit) rows = rows.slice(0, limit);
  return { count: rows.length, source, truncated: rows.length === limit, rows };
}

// ---------------------------------------------------------------------------
// 3. get_process_info
// ---------------------------------------------------------------------------

function parsePsLinux(stdout) {
  const lines = stdout.trim().split("\n");
  if (lines.length < 2) return null;
  // ps -p PID -o pid=,ppid=,user=,stat=,etime=,%cpu=,%mem=,vsz=,rss=,comm=,args=
  const cols = lines[1].trim().split(/\s+/);
  // args may have spaces — rejoin trailing columns
  const fixed = cols.length >= 11 ? cols.slice(0, 10).concat([cols.slice(10).join(" ")]) : cols;
  if (fixed.length < 10) return null;
  return {
    pid: safeInt(fixed[0]),
    ppid: safeInt(fixed[1]),
    user: fixed[2],
    stat: fixed[3],
    etime: fixed[4],
    cpuPct: fixed[5],
    memPct: fixed[6],
    vszKb: safeInt(fixed[7]),
    rssKb: safeInt(fixed[8]),
    comm: fixed[9],
    args: fixed[10] || "",
  };
}

function parseTasklistWindows(stdout) {
  const lines = stdout.trim().split("\n").slice(1);
  for (const line of lines) {
    const m = line.match(/^"([^"]+)","(\d+)","([^"]+)","([^"]+)"/);
    if (!m) continue;
    return { imageName: m[1], pid: safeInt(m[2]), sessionName: m[3], sessionNum: safeInt(m[4]), memory: null };
  }
  return null;
}

async function getProcessInfo({ pid }) {
  const p = safeInt(pid);
  if (!p || p < 1) return { error: "invalid pid" };
  if (IS_LINUX || IS_MAC) {
    try {
      const fmt = "pid=,ppid=,user=,stat=,etime=,%cpu=,%mem=,vsz=,rss=,comm=,args=";
      const { stdout } = await run("ps", ["-p", String(p), "-o", fmt]);
      const info = parsePsLinux(stdout);
      if (!info) return { error: "process not found", pid: p };
      // augement with parent cmdline + existence check
      let parent = null;
      if (info.ppid && info.ppid > 0) {
        try {
          const pr = await run("ps", ["-p", String(info.ppid), "-o", "comm=,args="]);
          const c = parsePsLinux(`\nHEADER\n${pr.stdout}`);
          if (c) parent = { pid: info.ppid, comm: c.comm, args: c.args };
        } catch { /* parent may be gone */ }
      }
      return { ...info, parent, alive: true };
    } catch (e) {
      return { error: "process not found", pid: p, detail: e.message };
    }
  }
  if (IS_WIN) {
    try {
      // tasklist doesn't have a pid filter; grep manually
      const { stdout } = await run("tasklist", ["/fi", `pid eq ${p}`, "/fo", "csv", "/nh"]);
      const info = parseTasklistWindows(stdout);
      if (!info) return { error: "process not found", pid: p };
      return { ...info, alive: true };
    } catch (e) {
      return { error: "process not found", pid: p, detail: e.message };
    }
  }
  return { error: "unsupported platform" };
}

// ---------------------------------------------------------------------------
// 4. find_processes_by_name
// ---------------------------------------------------------------------------

async function findProcessesByName({ query, limit = 200 } = {}) {
  const q = String(query || "").trim();
  if (!q) return { error: "query required", count: 0, processes: [] };

  if (IS_LINUX || IS_MAC) {
    try {
      const fmt = "pid=,ppid=,user=,stat=,%cpu=,%mem=,comm=,args=";
      // -i for case-insensitive, exact match on comm would miss cmdlines; use
      // grep on the whole ps output as a simpler portable approach.
      const { stdout } = await run("sh", ["-c", `ps -axo ${fmt} | grep -i -- "${q.replace(/"/g, "")}" | grep -v grep || true`]);
      const rows = [];
      for (const line of stdout.trim().split("\n")) {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 7) continue;
        const fixed = cols.length >= 8 ? cols.slice(0, 7).concat([cols.slice(7).join(" ")]) : cols;
        rows.push({
          pid: safeInt(fixed[0]),
          ppid: safeInt(fixed[1]),
          user: fixed[2],
          stat: fixed[3],
          cpuPct: fixed[4],
          memPct: fixed[5],
          comm: fixed[6],
          args: fixed[7] || "",
        });
        if (rows.length >= limit) break;
      }
      return { count: rows.length, truncated: rows.length === limit, query: q, processes: rows };
    } catch (e) {
      return { error: e.message, count: 0, processes: [] };
    }
  }
  if (IS_WIN) {
    try {
      const { stdout } = await run("tasklist", ["/fo", "csv", "/nh"]);
      const qLower = q.toLowerCase();
      const rows = [];
      for (const line of stdout.trim().split("\n")) {
        const m = line.match(/^"([^"]+)","(\d+)","([^"]+)","([^"]+)","([\d,]+)"/);
        if (!m) continue;
        if (!m[1].toLowerCase().includes(qLower)) continue;
        rows.push({
          pid: safeInt(m[2]),
          imageName: m[1],
          sessionName: m[3],
          sessionNum: safeInt(m[4]),
        });
        if (rows.length >= limit) break;
      }
      return { count: rows.length, truncated: rows.length === limit, query: q, processes: rows };
    } catch (e) {
      return { error: e.message, count: 0, processes: [] };
    }
  }
  return { error: "unsupported platform", count: 0, processes: [] };
}

// ---------------------------------------------------------------------------
// 5. kill_by_name
// ---------------------------------------------------------------------------

async function killByName({ name, confirm, signal = "SIGTERM", self_protect = true, exclude_self = true } = {}) {
  if (!confirm) {
    const err = new Error("Refusing to kill: confirm must be true. Pass confirm: true to actually signal processes.");
    err.isValidation = true;
    throw err;
  }
  if (!name || typeof name !== "string") {
    throw new Error("name required (substring to match in process command line)");
  }

  const match = await findProcessesByName({ query: name, limit: KILL_SAFETY_CAP + 1 });
  if (match.error) return { error: match.error };

  let targets = match.processes;
  if (exclude_self) {
    targets = targets.filter((p) => p.pid && p.pid !== process.pid);
  }
  if (targets.length > KILL_SAFETY_CAP) {
    const err = new Error(`too many matches (${targets.length}); raise query precision or omit the call`);
    err.details = { matched: targets.length, cap: KILL_SAFETY_CAP };
    throw err;
  }

  const sig = signal || "SIGTERM";
  const killed = [];
  const failed = [];
  for (const t of targets) {
    if (!t.pid) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const sent = await portService.sendSignal(t.pid, sig);
      killed.push({ pid: t.pid, comm: t.comm || t.imageName, signal: sig, sent });
    } catch (e) {
      failed.push({ pid: t.pid, comm: t.comm || t.imageName, error: e.message });
    }
  }
  return { count: killed.length, failed: failed.length, killed, failed, query: name, safety_cap: KILL_SAFETY_CAP };
}

// ---------------------------------------------------------------------------
// 6. list_docker_containers (passthrough to containerService)
// ---------------------------------------------------------------------------

async function listDockerContainers({ timeout_ms = 4000 } = {}) {
  try {
    const wrap = (p) => Promise.race([
      p.catch(() => []),
      new Promise((r) => setTimeout(() => r([]), timeout_ms)),
    ]);
    const out = await portService ? null : null; // placeholder
    // delegate to containerService
    const { containers, runtimes } = await containerService.listContainers();
    // enrich with port mappings if present in original record
    const enriched = containers.map((c) => ({
      id: c.id,
      name: c.name,
      runtime: c.runtime,
      image: c.image,
      state: c.state,
      status: c.status,
      ports: c.ports || [],
    }));
    return { count: enriched.length, runtimes, containers: enriched };
  } catch (e) {
    return { error: e.message, count: 0, containers: [], runtimes: [] };
  }
}

// ---------------------------------------------------------------------------
// 7. list_locks
// ---------------------------------------------------------------------------

async function listLocks({ pid, limit = 500 } = {}) {
  try {
    const locks = await lockService.listLocks();
    let rows = locks;
    if (pid) {
      const p = safeInt(pid);
      rows = locks.filter((l) => Number(l.pid) === p);
    }
    if (rows.length > limit) rows = rows.slice(0, limit);
    return { count: rows.length, total: locks.length, truncated: rows.length === limit, locks: rows };
  } catch (e) {
    return { error: e.message, count: 0, locks: [] };
  }
}

// ---------------------------------------------------------------------------
// 8. get_network_interfaces
// ---------------------------------------------------------------------------

function getNetworkInterfaces() {
  const ifaces = os.networkInterfaces();
  const rows = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs) {
      rows.push({
        name,
        family: a.family,
        address: a.address,
        netmask: a.netmask,
        mac: a.mac,
        internal: a.internal,
        cidr: a.cidr,
      });
    }
  }
  return { count: rows.length, interfaces: rows };
}

// ---------------------------------------------------------------------------
// 9. get_system_info
// ---------------------------------------------------------------------------

async function getSystemInfo() {
  const info = {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    cpus: { model: os.cpus()[0]?.model || "unknown", count: os.cpus().length, speed: os.cpus()[0]?.speed || null },
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      usedBytes: os.totalmem() - os.freemem(),
    },
    uptimeSec: os.uptime(),
    node: process.version,
    pid: process.pid,
    userInfo: (() => { try { return os.userInfo(); } catch { return null; } })(),
  };
  if (IS_LINUX || IS_MAC) {
    info.loadAvg = os.loadavg();
  }
  return info;
}

// ---------------------------------------------------------------------------
// Tool definitions (consumed by index.js)
// ---------------------------------------------------------------------------

module.exports = {
  find_free_port: {
    description: "Find the first TCP port that is free to bind to, scanning forward from `preferred`.",
    inputSchema: {
      type: "object",
      properties: {
        preferred: { type: "integer", minimum: 1, maximum: 65535, default: 3000, description: "Where to start scanning." },
        max: { type: "integer", minimum: 1, maximum: 1000, default: 100, description: "How many ports to try before giving up." },
        host: { type: "string", default: "127.0.0.1", description: "Bind host (currently informational — check is loopback only)." },
      },
    },
    handler: async (args) => asText(await findFreePort(args)),
  },

  list_connections: {
    description: "List all TCP socket states (LISTEN, ESTAB, TIME_WAIT, ...) — not just LISTEN. Cross-platform ss/netstat with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string", description: "Filter by state, e.g. ESTAB, TIME_WAIT, LISTEN (case-insensitive)." },
        port: { type: "integer", minimum: 1, maximum: 65535, description: "Filter by local or peer port." },
        limit: { type: "integer", minimum: 1, maximum: 5000, default: 500, description: "Max rows to return." },
      },
    },
    handler: async (args) => asText(await listConnections(args)),
  },

  get_process_info: {
    description: "Detailed info about a specific PID: cmdline, parent, status, CPU/mem, user. Cross-platform via ps or tasklist.",
    inputSchema: {
      type: "object",
      required: ["pid"],
      properties: { pid: { type: "integer", minimum: 1 } },
    },
    handler: async (args) => asText(await getProcessInfo(args)),
  },

  find_processes_by_name: {
    description: "Search running processes whose command line or name matches the given substring (case-insensitive).",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1, description: "Substring to search for in process name/args." },
        limit: { type: "integer", minimum: 1, maximum: 1000, default: 200 },
      },
    },
    handler: async (args) => asText(await findProcessesByName(args)),
  },

  kill_by_name: {
    description: "Send a signal (default SIGTERM) to every process matching `name`. Requires confirm=true. Safety-capped at 50 matches per call; refuses to kill itself.",
    inputSchema: {
      type: "object",
      required: ["name", "confirm"],
      properties: {
        name: { type: "string", minLength: 1, description: "Substring to match (same as find_processes_by_name)." },
        confirm: { type: "boolean", description: "Must be true to actually signal processes." },
        signal: { type: "string", default: "SIGTERM", description: "POSIX signal name (POSIX only). Ignored on Windows." },
      },
    },
    handler: async (args) => asText(await killByName(args)),
  },

  list_docker_containers: {
    description: "List Docker / Podman / nerdctl / LXC containers with their port mappings and basic status. Pass-through to the extension's container service.",
    inputSchema: {
      type: "object",
      properties: { timeout_ms: { type: "integer", minimum: 500, maximum: 30000, default: 4000 } },
    },
    handler: async (args) => asText(await listDockerContainers(args)),
  },

  list_locks: {
    description: "List file locks (POSIX + OFD) currently held on the system. Optionally filter by PID.",
    inputSchema: {
      type: "object",
      properties: {
        pid: { type: "integer", minimum: 1, description: "If set, only return locks owned by this PID." },
        limit: { type: "integer", minimum: 1, maximum: 5000, default: 500 },
      },
    },
    handler: async (args) => asText(await listLocks(args)),
  },

  get_network_interfaces: {
    description: "List local network interfaces and their addresses (IPv4/IPv6 + MAC). No external commands — uses Node's os.networkInterfaces.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => asText(getNetworkInterfaces()),
  },

  get_system_info: {
    description: "Host snapshot: hostname, CPU model/count, total/free memory, uptime, load avg (Linux/macOS), Node version.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => asText(await getSystemInfo()),
  },

  // helpers exposed for tests
  _internal: { findFreePort, listConnections, getProcessInfo, findProcessesByName, killByName, listDockerContainers, listLocks, getNetworkInterfaces, getSystemInfo },
};
