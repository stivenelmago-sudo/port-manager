/**
 * PortPilot - Lock Service
 *
 * System-wide file lock inspection.
 *   - Linux: parse /proc/locks (POSIX FLOCK + OFD locks)
 *   - macOS/BSD: derive from `lsof` for each PID
 *
 * Pressing `a` in the TUI toggles "all open files" mode (merged view of locks
 * + interesting fds). The webview exposes this as a checkbox toggle.
 */

const { execFile } = require("child_process");
const { promises: fs } = require("fs");
const { promisify } = require("util");
const { PLATFORM } = require("./constants");

const execFileP = promisify(execFile);

/**
 * Parse /proc/locks (Linux only).
 * Each line: <ordinal>: <type> <scope> <rw> <pid> <major:minor:inode> <bytes> [EOF]
 *   type:      FLOCK | OFDLCK | POSIX
 *   scope:     ADVISORY | MANDATORY
 *   rw:        READ | WRITE | UNLCK
 *   pid:       owning PID
 *   inode:     <major>:<minor>:<inode>
 */
async function listLocksLinux() {
  const text = await fs.readFile("/proc/locks", "utf8").catch(() => "");
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Strip the leading "<n>:" ordinal token (kernel-added since Linux 2.6.x).
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const afterOrdinal = line.slice(colonIdx + 1).trim();
    const parts = afterOrdinal.split(/\s+/);
    if (parts.length < 6) continue;
    const [typeRaw, scopeRaw, rwRaw, pidRaw, range, inodeRaw] = parts;
    const scope = (scopeRaw || "").replace("ADVISORY", "ADV").replace("MANDATORY", "MAN");
    const pid = parseInt(pidRaw, 10);
    const inode = parseInt(inodeRaw, 10);
    out.push({
      type: typeRaw,
      mode: scope,
      rw: rwRaw,
      pid,
      range,
      inode,
      fd: null,
    });
  }
  // Resolve file paths from /proc/<pid>/fd/* and resolve the fd number
  // for each lock (the symlink that targets the matching inode).
  await Promise.all(out.map(async (l) => {
    try {
      const { path: filePath, fd } = await resolveFdInfo(l.pid, l.inode);
      l.path = filePath;
      l.fd = fd;
    } catch {
      l.path = null;
      l.fd = null;
    }
  }));
  return out;
}

/**
 * Scan /proc/<pid>/fd/* for a symlink whose target points at `inode`.
 * Returns both the resolved path and the fd number (string) when found.
 */
async function resolveFdInfo(pid, inode) {
  const fdDir = `/proc/${pid}/fd`;
  const entries = await fs.readdir(fdDir).catch(() => []);
  for (const fd of entries) {
    const target = await fs.readlink(`${fdDir}/${fd}`).catch(() => "");
    // target looks like "/some/path" or "socket:[12345]" or "pipe:[...]"
    const m = target.match(/\[(\d+)\]$/);
    if (m && parseInt(m[1], 10) === inode) {
      return { path: target, fd };
    }
  }
  return { path: null, fd: null };
}

/**
 * macOS / BSD fallback: parse `lsof` output for lock-like entries.
 * Heuristic: any entry whose FD column shows one of `LOCK`, `WRLCK`, `RLCK`,
 * `lLock`, `rLock`, or `wLock` is treated as a lock.
 */
async function listLocksLsof() {
  let stdout;
  try {
    const res = await execFileP("lsof", ["-nP", "-F0"], { timeout: 8000, maxBuffer: 16 * 1024 * 1024 });
    stdout = res.stdout;
  } catch {
    return [];
  }

  const records = parseLsofF0(stdout);
  const locks = [];
  for (const r of records) {
    const fdLower = (r.fd || "").toLowerCase();
    if (fdLower.includes("lock") || fdLower.includes("wrlck")) {
      locks.push({
        type: "FLOCK",
        mode: fdLower.includes("w") ? "WRITE" : "READ",
        rw: fdLower.includes("w") ? "WRITE" : "READ",
        pid: parseInt(r.pid, 10) || 0,
        range: "0:",
        inode: r.inode,
        path: r.path,
        fd: r.fd,
      });
    }
  }
  return locks;
}

function parseLsofF0(text) {
  const records = [];
  let current = {};
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const tag = line[0];
    const value = line.slice(1);
    switch (tag) {
      case "p": current = { pid: value }; break;
      case "c": current.command = value; break;
      case "u": current.user = value; break;
      case "f": current.fd = value; break;
      case "t": current.type = value; break;
      case "i": {
        // inode info; format varies; keep raw
        current.inode = value;
        break;
      }
      case "n": current.path = value; break;
      case "0":
        records.push(current);
        current = {};
        break;
    }
  }
  return records;
}

/**
 * All interesting open fds for a given PID — used by the "all open files" mode.
 * On Linux, parses /proc/<pid>/fd/*. On macOS/BSD, queries lsof.
 */
async function listInterestingFds(pid) {
  if (PLATFORM === "linux") {
    const fdDir = `/proc/${pid}/fd`;
    const entries = await fs.readdir(fdDir).catch(() => []);
    const interesting = [];
    for (const fd of entries) {
      const target = await fs.readlink(`${fdDir}/${fd}`).catch(() => "");
      if (
        !target.startsWith("/") ||
        target.startsWith("/proc/") ||
        target.startsWith("/sys/") ||
        target.startsWith("/dev/") ||
        target.startsWith("/run/")
      ) continue;
      interesting.push({ fd, pid, path: target });
    }
    return interesting;
  }
  // macOS/BSD
  try {
    const { stdout } = await execFileP("lsof", ["-p", String(pid), "-nP", "-F0"], { timeout: 5000 });
    const records = parseLsofF0(stdout);
    return records
      .filter((r) => r.path && r.path.startsWith("/"))
      .filter((r) => !r.path.startsWith("/dev/") && !r.path.startsWith("/System/"))
      .map((r) => ({ fd: r.fd, pid, path: r.path }));
  } catch {
    return [];
  }
}

/**
 * Top-level entry: list system-wide locks.
 * @returns {Promise<Array>}
 */
async function listLocks() {
  if (PLATFORM === "linux") {
    return listLocksLinux();
  }
  return listLocksLsof();
}

module.exports = {
  listLocks,
  listLocksLinux,
  listLocksLsof,
  listInterestingFds,
  parseLsofF0,
};
