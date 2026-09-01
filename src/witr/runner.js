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

      if (exitCode !== 0 && exitCode !== 1 && exitCode !== 2) {
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
 * @param {string} bin
 * @param {number[]} ports
 * @returns {Promise<Map<number, object|null>>} port → enrichment or null
 */
async function lookupPortsBatch(bin, ports) {
  const out = new Map();
  if (!ports || ports.length === 0) return out;

  const args = ["--short"];
  for (const p of ports) args.push("--port", String(p));

  const res = await run(bin, args);
  if (!res.ok) return out;

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
      out.set(currentPort, parseShortLine(line));
      currentPort = null;
    }
  }

  // Fallback: if WITR didn't emit dividers (single-port path or older versions),
  // assign the first parsed line to the first requested port.
  if (out.size === 0 && ports.length === 1) {
    const parsed = parseShortLine(text);
    if (parsed) out.set(ports[0], parsed);
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
};
