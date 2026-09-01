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
 * Each line: <lock-type> <lock-mode> <lock-pid> <lock-start>:<lock-end> <lock-inode>
 *   lock-type: FLOCK | OFDLCK | POSIX
 *   lock-mode: ADVISORY | MANDATORY
 *   lock-mode: READ | WRITE | UNLCK
 */
async function listLocksLinux() {
  const text = await fs.readFile("/proc/locks", "utf8").catch(() => "");
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;
    const [typeRaw, modeRaw, pidRaw, range, inodeRaw] = parts;
    const mode = (modeRaw || "").replace("ADVISORY", "ADV").replace("MANDATORY", "MAN");
    const rw = mode.replace(/^(ADV|MAN)/, "");
    const pid = parseInt(pidRaw, 10);
    const inode = parseInt(inodeRaw, 10);
    out.push({
      type: typeRaw,
      mode,
      rw,
      pid,
      range,
      inode,
      fd: lookupFd(pid, inode).catch(() => null),
    });
  }
  // Resolve file paths from /proc/<pid>/fd/<n>
  await Promise.all(out.map(async (l) => {
    try { l.path = await resolveFdPath(l.pid, l.inode); }
    catch { l.path = null; }
  }));
  return out;
}

async function resolveFdPath(pid, inode) {
  // Scan /proc/<pid>/fd/* for a symlink pointing to the inode.
  const fdDir = `/proc/${pid}/fd`;
  const entries = await fs.readdir(fdDir).catch(() => []);
  for (const fd of entries) {
    const target = await fs.readlink(`${fdDir}/${fd}`).catch(() => "");
    // target looks like "/some/path" or "socket:[12345]" or "pipe:[...]"
    const m = target.match(/\[(\d+)\]$/);
    if (m && parseInt(m[1], 10) === inode) return target;
  }
  return null;
}

async function lookupFd(_pid, _inode) {
  // Reserved for future fd-level lookup via /proc/<pid>/fdinfo/<n>.
  return null;
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
