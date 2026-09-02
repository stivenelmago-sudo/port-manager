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
 * Get listening ports on Unix-like systems (macOS, Linux).
 *
 * Combines `lsof` and `ss` rather than using either as a fallback: on some
 * Linux kernels `lsof -iTCP -sTCP:LISTEN -nP` silently omits certain sockets
 * (e.g. localhost binds for processes with parens in the command name), while
 * `ss -tlnp` still sees them. Merging both ensures we don't miss listeners.
 * Entries are deduped by port; the entry with a real (non-null) PID wins.
 *
 * @returns {Array<{port: number, pid: number, process: string}>}
 */
function getPortsUnix() {
  const byPort = new Map();

  const merge = (rows) => {
    for (const row of rows) {
      const existing = byPort.get(row.port);
      if (!existing) {
        byPort.set(row.port, row);
        continue;
      }
      // Prefer the entry with a real PID; if both have one, keep whichever
      // has a non-empty process name.
      const existingHasPid = existing.pid != null;
      const newHasPid = row.pid != null;
      if (!existingHasPid && newHasPid) {
        byPort.set(row.port, row);
      } else if (existingHasPid === newHasPid && row.process && row.process !== "unknown") {
        byPort.set(row.port, row);
      }
    }
  };

  merge(tryLsof());
  merge(trySs());
  return sortByPort(Array.from(byPort.values()));
}

/**
 * Try to get ports using lsof command
 * @returns {Array<{port:number, pid:number|null, process:string}>}
 */
function tryLsof() {
  const ports = [];
  try {
    const output = execSync("lsof -iTCP -sTCP:LISTEN -nP 2>/dev/null || true", {
      encoding: "utf-8",
      timeout: TIMEOUT.COMMAND,
    });

    const lines = output.split("\n").slice(1); // Skip header

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;

      const process = parts[0];
      const pid = parseInt(parts[1], 10);
      const addressField = parts[8] || "";
      const portMatch = addressField.match(/:(\d+)$/);
      if (!portMatch) continue;

      // Skip kernel internal sockets (kthread/*) — they're never actionable.
      if (/^kthread/i.test(process)) continue;

      ports.push({
        port: parseInt(portMatch[1], 10),
        pid: Number.isFinite(pid) ? pid : null,
        process: process || "unknown",
      });
    }
  } catch {
    // ignore
  }
  return ports;
}

/**
 * Try to get ports using ss command (Linux)
 * @returns {Array<{port:number, pid:number|null, process:string}>}
 */
function trySs() {
  const ports = [];
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

      // The process field starts at parts[5] and may contain spaces (e.g.
      // `users:(("ng serve (gskAp",pid=…)`); concatenate everything from
      // parts[5] onward so regexes see the full token.
      const processField = parts.slice(5).join(" ");
      const pidMatch = processField.match(/pid=(\d+)/);
      const nameMatch = processField.match(/\("([^"]+)"/);

      ports.push({
        port: parseInt(portMatch[1], 10),
        pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
        process: nameMatch ? nameMatch[1] : "unknown",
      });
    }
  } catch {
    // Silently fail - no ports available
  }
  return ports;
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

/**
 * Send an arbitrary POSIX signal to a PID.
 * Returns true on success, false if the process is gone.
 * Throws on hard failures (permission denied, etc.).
 */
function sendSignal(pid, signal) {
  if (process.platform === "win32") {
    throw new Error("POSIX signals are not supported on Windows");
  }
  try {
    process.kill(pid, signal);
    return true;
  } catch (e) {
    if (e.code === "ESRCH") return false;
    throw e;
  }
}

/**
 * SIGTERM — terminate gracefully.
 */
function terminateByPid(pid) {
  return sendSignal(pid, "SIGTERM");
}

/**
 * SIGSTOP — pause the process.
 */
function pauseByPid(pid) {
  return sendSignal(pid, "SIGSTOP");
}

/**
 * SIGCONT — resume a paused process.
 */
function resumeByPid(pid) {
  return sendSignal(pid, "SIGCONT");
}

/**
 * Adjust the nice value of a process (-20 highest priority, 19 lowest).
 */
function renice(pid, nice) {
  const n = parseInt(nice, 10);
  if (Number.isNaN(n) || n < -20 || n > 19) {
    throw new Error(`Invalid nice value: ${nice}`);
  }
  // Cross-platform: on POSIX use nice(2) via the `nice` CLI so it can elevate
  // when needed. On Windows, there's no equivalent — fall back to a no-op.
  if (process.platform === "win32") {
    throw new Error("Renice is not supported on Windows");
  }
  const { execSync } = require("child_process");
  try {
    execSync(`renice -n ${n} -p ${pid}`, { timeout: 3000 });
    return { pid, nice: n };
  } catch (e) {
    // Renice to lower priority never needs privileges; raising might.
    // Retry via shell `nice` to allow passwordless sudo on systems that have it.
    try {
      execSync(`nice -n ${n} renice -n ${n} -p ${pid}`, { timeout: 3000 });
      return { pid, nice: n };
    } catch (e2) {
      throw new Error(`renice failed: ${e2.message}`);
    }
  }
}

module.exports = {
  getListeningPorts,
  getListeningPortsEnriched,
  killByPid,
  killGraceful,
  terminateByPid,
  pauseByPid,
  resumeByPid,
  renice,
  sendSignal,
  checkPortFree,
};
