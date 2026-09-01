/**
 * PortPilot - Port Detection & Management Service
 */

const { execSync } = require("child_process");
const net = require("net");
const { PLATFORM, TIMEOUT, STATE } = require("./constants");

/**
 * Get all listening ports on the system (sync, no WITR enrichment).
 * @returns {Array<{port:number,pid:number|null,process:string,state:string}>}
 */
function getListeningPorts() {
  let ports = [];

  if (PLATFORM === "darwin" || PLATFORM === "linux") {
    ports = getPortsUnix();
  } else if (PLATFORM === "win32") {
    ports = getPortsWindows();
  }

  return ports.map((p) => ({ ...p, state: STATE.LISTEN }));
}

/**
 * Get listening ports enriched with WITR ancestry info. Async variant.
 * Falls back to plain getListeningPorts() if WITR is unavailable or fails.
 *
 * @param {Object} [opts]
 * @param {string} [opts.witrBin] - absolute path to witr binary
 * @returns {Promise<{ports: Array, availability: object}>}
 */
async function getListeningPortsEnriched(opts = {}) {
  const base = getListeningPorts().map((p) => ({ ...p, witr: null }));

  if (!opts.witrBin) {
    return { ports: base, availability: { status: "skipped" } };
  }

  try {
    const { enrichPorts } = require("../witr");
    const { enriched, availability } = await enrichPorts(base, opts.witrBin);
    return { ports: base, availability: { ...availability, enriched } };
  } catch {
    return { ports: base, availability: { status: "error" } };
  }
}

/**
 * Get listening ports on Unix-like systems (macOS, Linux)
 * @returns {Array<{port: number, pid: number, process: string}>}
 */
function getPortsUnix() {
  const ports = [];

  // Try lsof first (works well on macOS)
  if (tryLsof(ports)) {
    return sortByPort(ports);
  }

  // Fallback to ss (common on Linux)
  trySs(ports);
  return sortByPort(ports);
}

/**
 * Try to get ports using lsof command
 * @param {Array} ports - Array to populate with port info
 * @returns {boolean} - True if successful
 */
function tryLsof(ports) {
  try {
    const output = execSync("lsof -iTCP -sTCP:LISTEN -nP 2>/dev/null || true", {
      encoding: "utf-8",
      timeout: TIMEOUT.COMMAND,
    });

    const seen = new Set();
    const lines = output.split("\n").slice(1); // Skip header

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;

      const process = parts[0];
      const pid = parseInt(parts[1], 10);
      const addressField = parts[8] || "";
      const portMatch = addressField.match(/:(\d+)$/);

      if (!portMatch) continue;

      const port = parseInt(portMatch[1], 10);
      if (seen.has(port)) continue;

      seen.add(port);
      ports.push({ port, pid, process });
    }

    return ports.length > 0;
  } catch {
    return false;
  }
}

/**
 * Try to get ports using ss command (Linux)
 * @param {Array} ports - Array to populate with port info
 */
function trySs(ports) {
  try {
    const output = execSync("ss -tlnp 2>/dev/null || true", {
      encoding: "utf-8",
      timeout: TIMEOUT.COMMAND,
    });

    const lines = output.split("\n").slice(1); // Skip header

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;

      const addressField = parts[3] || "";
      const portMatch = addressField.match(/:(\d+)$/);
      if (!portMatch) continue;

      const port = parseInt(portMatch[1], 10);
      const processField = parts[6] || "";
      const pidMatch = processField.match(/pid=(\d+)/);
      const nameMatch = processField.match(/\("([^"]+)"/);

      ports.push({
        port,
        pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
        process: nameMatch ? nameMatch[1] : "unknown",
      });
    }
  } catch {
    // Silently fail - no ports available
  }
}

/**
 * Get listening ports on Windows
 * @returns {Array<{port: number, pid: number, process: string}>}
 */
function getPortsWindows() {
  const ports = [];

  try {
    const output = execSync("netstat -ano -p TCP", {
      encoding: "utf-8",
      timeout: TIMEOUT.COMMAND,
    });

    const pidToName = getPidToNameMap();
    const seen = new Set();

    for (const line of output.split("\n")) {
      if (!line.includes("LISTENING")) continue;

      const parts = line.trim().split(/\s+/);
      const addressField = parts[1] || "";
      const portMatch = addressField.match(/:(\d+)$/);

      if (!portMatch) continue;

      const port = parseInt(portMatch[1], 10);
      if (seen.has(port)) continue;

      seen.add(port);
      const pid = parseInt(parts[parts.length - 1], 10);

      ports.push({
        port,
        pid,
        process: pidToName[String(pid)] || `PID:${pid}`,
      });
    }
  } catch {
    // Silently fail
  }

  return sortByPort(ports);
}

/**
 * Get PID to process name mapping on Windows
 * @returns {Object<string, string>}
 */
function getPidToNameMap() {
  const pidToName = {};

  try {
    const tasks = execSync("tasklist /fo csv /nh", {
      encoding: "utf-8",
      timeout: TIMEOUT.COMMAND,
    });

    for (const line of tasks.split("\n")) {
      const match = line.match(/"([^"]+)","(\d+)"/);
      if (match) {
        pidToName[match[2]] = match[1];
      }
    }
  } catch {
    // Silently fail
  }

  return pidToName;
}

/**
 * Kill a process by PID — legacy `kill -9` / `taskkill /F` synchronous kill.
 * Used by the bulk kill path where latency matters.
 * @param {number} pid - Process ID to kill
 * @throws {Error} If kill fails
 */
function killByPid(pid) {
  const command =
    PLATFORM === "win32" ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;

  execSync(command, { timeout: TIMEOUT.KILL });
}

/**
 * Graceful kill: SIGTERM first, escalating to SIGKILL after `graceMs` if the
 * process is still alive. Windows falls back to `taskkill` (no POSIX signals).
 *
 * @param {number} pid
 * @param {number} [graceMs=3000]
 * @returns {Promise<{signal:"SIGTERM"|"SIGKILL"|"taskkill", escalated:boolean, alive:boolean}>}
 */
async function killGraceful(pid, graceMs = 3000) {
  if (!pid) throw new Error("pid required");

  const isAlive = (p) => {
    try {
      process.kill(p, 0); // signal 0 = existence check
      return true;
    } catch (e) {
      return e.code === "EPERM"; // exists but no permission
    }
  };

  if (PLATFORM === "win32") {
    execSync(`taskkill /PID ${pid}`, { timeout: TIMEOUT.KILL });
    return { signal: "taskkill", escalated: false, alive: !isAlive(pid) };
  }

  // POSIX: SIGTERM, wait, escalate.
  try {
    process.kill(pid, "SIGTERM");
  } catch (e) {
    if (e.code === "ESRCH") return { signal: "SIGTERM", escalated: false, alive: false };
    throw e;
  }

  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) {
      return { signal: "SIGTERM", escalated: false, alive: false };
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // Still alive — escalate.
  if (isAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
      return { signal: "SIGKILL", escalated: true, alive: false };
    } catch (e) {
      if (e.code === "ESRCH") return { signal: "SIGTERM", escalated: true, alive: false };
      throw e;
    }
  }

  return { signal: "SIGTERM", escalated: false, alive: false };
}

/**
 * Check if a port is free (not in use)
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is free
 */
function checkPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, "127.0.0.1");
  });
}

/**
 * Sort ports array by port number
 * @param {Array} ports
 * @returns {Array}
 */
function sortByPort(ports) {
  return ports.sort((a, b) => a.port - b.port);
}

module.exports = {
  getListeningPorts,
  getListeningPortsEnriched,
  killByPid,
  killGraceful,
  checkPortFree,
};
