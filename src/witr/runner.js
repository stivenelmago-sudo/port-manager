/**
 * PortPilot - WITR Runner
 *
 * Spawns the bundled `witr` binary and returns parsed JSON output.
 *
 * WITR exit codes (per upstream docs):
 *   0 = clean
 *   1 = warnings
 *   2 = not found
 *   3 = permission denied  ← surfaced as PERMISSION_DENIED
 *   4 = invalid input
 *   5 = internal error
 *
 * Strategy: best-effort, never auto-sudo. Exit code 3 produces a clear
 * "needs elevation" error so the extension UI can show an actionable hint.
 */

const { spawn } = require("child_process");
const { promises: fs } = require("fs");
const { TIMEOUT } = require("../core/constants");

const WITR_TIMEOUT_MS = 8000;

// Per-process TTL cache: each port's enrichment is reused for CACHE_TTL_MS
// before witr is re-invoked. Keeps the panel snappy when the user toggles
// the refresh button rapidly and prevents spawning witr N times for N ports
// on every render cycle.
const CACHE_TTL_MS = 3000;
const cache = new Map();

function cacheGet(port) {
  const e = cache.get(port);
  if (!e) return null;
  if (Date.now() > e.expires) {
    cache.delete(port);
    return null;
  }
  return e.value;
}

function cacheSet(port, value) {
  cache.set(port, { value, expires: Date.now() + CACHE_TTL_MS });
}

function cacheClear() {
  cache.clear();
}

class WitrError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WitrError";
    this.code = code;
  }
}

/**
 * Ensure the binary is executable. No-op on Windows. Best-effort: if chmod
 * fails (read-only filesystem in remote workspaces), we still attempt spawn
 * and let the OS decide.
 */
async function ensureExecutable(bin) {
  if (process.platform === "win32") return;
  try {
    await fs.chmod(bin, 0o755);
  } catch {
    /* ignore — spawn may still work */
  }
}

/**
 * Check if the binary exists and is a regular file.
 */
async function exists(bin) {
  try {
    const st = await fs.stat(bin);
    return st.isFile();
  } catch {
    return false;
  }
}

/**
 * Run `witr <args>` and resolve with parsed JSON (when --json is passed),
 * or raw stdout string otherwise.
 *
 * @param {string} bin - absolute path to witr binary
 * @param {string[]} args - arguments to pass
 * @returns {Promise<{ok: boolean, code: number, data?: any, text?: string, error?: string}>}
 */
async function run(bin, args) {
  if (!(await exists(bin))) {
    return {
      ok: false,
      code: -1,
      error: `witr binary not found at ${bin}`,
    };
  }
  await ensureExecutable(bin);

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let child;
    try {
      child = spawn(bin, args, {
        cwd: undefined,
        env: process.env,
        windowsHide: true,
      });
    } catch (e) {
      settle({ ok: false, code: -1, error: e.message });
      return;
    }

    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      settle({ ok: false, code: -1, error: "witr timed out" });
    }, WITR_TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString("utf8"); });
    child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });

    child.on("error", (e) => {
      clearTimeout(timer);
      settle({ ok: false, code: -1, error: e.message });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const exitCode = typeof code === "number" ? code : -1;

      if (exitCode === 3) {
        settle({
          ok: false,
          code: 3,
          error: "permission_denied",
        });
        return;
      }

      // Exit codes 0 (clean), 1 (warnings), 2 (not found) and 4 (invalid input /
      // ambiguous match) may still have produced valid output for OTHER ports in
      // a batch invocation. Only 5 (internal error) and other unexpected codes
      // are hard failures — and even those should fall back to "no enrichment"
      // rather than discard partial results.
      const isHardFail = exitCode >= 5;
      if (isHardFail) {
        settle({
          ok: false,
          code: exitCode,
          error: (stderr || stdout || `witr exited ${exitCode}`).trim(),
        });
        return;
      }

      const wantsJson = args.includes("--json");
      if (wantsJson) {
        try {
          const parsed = JSON.parse(stdout);
          settle({ ok: true, code: exitCode, data: parsed });
        } catch (e) {
          settle({
            ok: false,
            code: exitCode,
            error: `invalid JSON from witr: ${e.message}`,
            text: stdout,
          });
        }
      } else {
        settle({ ok: true, code: exitCode, text: stdout });
      }
    });
  });
}

/**
 * High-level helper: lookup the process owning a port via `witr --port N --json`.
 * Returns a normalized summary suitable for direct attachment to a port row.
 *
 * @param {string} bin - absolute path to witr binary
 * @param {number} port
 * @returns {Promise<object|null>} null on failure or when witr is missing
 */
async function lookupPort(bin, port) {
  const res = await run(bin, ["--port", String(port), "--short"]);
  if (!res.ok) return null;
  return parseShortLine(res.text || "");
}

/**
 * Parse the one-line `--short` output. Format example (from README):
 *   systemd (pid 1) → PM2 v5.3.1: God (pid 1481580) → python (pid 1482060)
 */
function parseShortLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  // WITR emits a "Multiple matching processes found:" block (with pid list and
  // "Re-run with witr --pid ...") when a query is ambiguous. That's not an
  // ancestry chain — return null so the UI falls back to "—" instead of showing
  // a confusing prompt.
  if (/Multiple matching/i.test(trimmed) || /Re-run with:/i.test(trimmed)) {
    return null;
  }

  const chain = trimmed.split("→").map((s) => s.trim()).filter(Boolean);
  const ancestry = chain.map((segment) => {
    const m = segment.match(/^(.*?)\s*\(pid\s+(\d+)\)\s*$/i);
    if (m) return { name: m[1].trim(), pid: parseInt(m[2], 10) };
    return { name: segment, pid: null };
  });
  const supervisor = ancestry.length > 1 ? ancestry[0].name : null;
  const leaf = ancestry[ancestry.length - 1] || null;
  return {
    chain: trimmed,
    ancestry,
    supervisor,
    leafName: leaf ? leaf.name : null,
    leafPid: leaf ? leaf.pid : null,
  };
}

/**
 * Batch lookup for multiple ports in a single witr invocation.
 * Uses `witr <port1> <port2> ...` with --short so WITR labels each result
 * with the target port. We rely on stderr/stdout order; WITR prints each
 * divider sequentially.
 *
 * Cached ports (within CACHE_TTL_MS) are served from memory; the rest are
 * fetched in a single witr invocation.
 *
 * @param {string} bin
 * @param {number[]} ports
 * @returns {Promise<Map<number, object|null>>} port → enrichment or null
 */
async function lookupPortsBatch(bin, ports) {
  const out = new Map();
  if (!ports || ports.length === 0) return out;

  // Serve cached entries; collect the miss-list.
  const miss = [];
  for (const p of ports) {
    const hit = cacheGet(p);
    if (hit !== null) out.set(p, hit);
    else miss.push(p);
  }

  if (miss.length === 0) return out;

  const args = ["--short"];
  for (const p of miss) args.push("--port", String(p));

  const res = await run(bin, args);
  if (!res.ok) {
    // Cache null for missed ports so we don't keep retrying within the TTL.
    for (const p of miss) {
      cacheSet(p, null);
      out.set(p, null);
    }
    return out;
  }

  let currentPort = null;
  const text = res.text || "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const divider = line.match(/^-----\s*\[port:\s*(\d+)\]\s*-----/i);
    if (divider) {
      currentPort = parseInt(divider[1], 10);
      continue;
    }
    if (currentPort != null) {
      const parsed = parseShortLine(line);
      cacheSet(currentPort, parsed);
      out.set(currentPort, parsed);
      currentPort = null;
    }
  }

  // Fallback: if WITR didn't emit dividers (single-port path or older versions),
  // assign the first parsed line to the first requested port.
  if (out.size === 0 && miss.length === 1) {
    const parsed = parseShortLine(text);
    cacheSet(miss[0], parsed);
    out.set(miss[0], parsed);
  }

  // Cache null for any requested port that produced no chain — avoids
  // repeated witr calls for ports witr simply can't trace.
  for (const p of miss) {
    if (!out.has(p)) {
      cacheSet(p, null);
      out.set(p, null);
    }
  }

  return out;
}

module.exports = {
  WitrError,
  exists,
  ensureExecutable,
  run,
  lookupPort,
  lookupPortsBatch,
  parseShortLine,
  cacheClear,
  CACHE_TTL_MS,
};
