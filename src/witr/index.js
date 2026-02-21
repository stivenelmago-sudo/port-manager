/**
 * PortPilot - WITR Feature Orchestrator
 *
 * Public entry point used by portService. Combines host detection + runner
 * to enrich port rows with ancestry ("why-it-exists"), supervisor, and leaf
 * process name from WITR.
 *
 * Design goals:
 *   - Zero network at runtime (binary is bundled).
 *   - Never throws — returns the original ports array on any failure.
 *   - Best-effort: missing binary or exit code 3 produces an empty enrichment
 *     map and an `availability` flag so the UI can show a clear hint.
 */

const vscode = require("vscode");
const host = require("./host");
const runner = require("./runner");

/**
 * @typedef {Object} WitrAvailability
 * @property {"available"|"disabled"|"missing"|"unsupported"|"permission_denied"|"error"} status
 * @property {string} [hint] - human-readable hint for the UI
 * @property {string} [binaryPath] - resolved path when status==="available"
 */

/**
 * Read the user's WITR-related settings from VS Code configuration.
 * @returns {{enabled: boolean, binaryPath: string}}
 */
function readConfig() {
  try {
    const cfg = vscode.workspace.getConfiguration("portManager.witr");
    return {
      enabled: cfg.get("enabled", true) !== false,
      binaryPath: String(cfg.get("binaryPath", "") || ""),
    };
  } catch {
    // Settings unavailable (e.g. in tests without vscode mock) — assume defaults.
    return { enabled: true, binaryPath: "" };
  }
}

/**
 * Resolve the host binary and return availability metadata, honoring the
 * user's `portManager.witr.enabled` and `portManager.witr.binaryPath` settings.
 * @param {vscode.ExtensionContext} ctx
 * @returns {WitrAvailability}
 */
function probe(ctx) {
  const cfg = readConfig();

  if (!cfg.enabled) {
    return {
      status: "disabled",
      hint: "WITR enrichment disabled by setting",
    };
  }

  if (!host.isSupported()) {
    return {
      status: "unsupported",
      hint: "Process ancestry is not available on this platform. On iOS/iPadOS open a remote workspace (SSH/WSL/Dev Container) to inspect processes.",
    };
  }

  const override = cfg.binaryPath.trim();
  const bin = override || host.binaryPath(ctx);

  return {
    status: "available",
    binaryPath: bin,
  };
}

/**
 * Enrich an array of port rows with WITR-derived metadata.
 *
 * Mutates each row in place by adding:
 *   - witr: { chain, supervisor, leafName, leafPid } | null
 *
 * @param {Array} ports - port rows from portService.getListeningPorts()
 * @param {string} bin - absolute path to witr binary
 * @returns {Promise<{enriched: number, availability: WitrAvailability}>}
 */
async function enrichPorts(ports, bin) {
  if (!Array.isArray(ports) || ports.length === 0) {
    return { enriched: 0, availability: { status: "available", binaryPath: bin } };
  }
  if (!bin) {
    return {
      enriched: 0,
      availability: { status: "missing", hint: "witr binary not bundled for this platform" },
    };
  }

  const portsWithPid = ports.filter((p) => p && p.pid != null);
  const portNumbers = portsWithPid.map((p) => p.port);

  let map = new Map();
  try {
    map = await runner.lookupPortsBatch(bin, portNumbers);
  } catch (e) {
    return {
      enriched: 0,
      availability: { status: "error", hint: e && e.message },
    };
  }

  for (const row of portsWithPid) {
    row.witr = map.get(row.port) || null;
  }

  // Detect if WITR reported permission denied (exit 3) on any port — best
  // signal: empty map but witr ran. We can't easily distinguish "no matches"
  // from "permission denied" without parsing stderr, so we leave the
  // `available` status here and let the host module's runtime error propagate.
  return { enriched: map.size, availability: { status: "available", binaryPath: bin } };
}

/**
 * Clear WITR fields from a port row (used when refreshing after errors).
 */
function strip(ports) {
  if (!Array.isArray(ports)) return;
  for (const p of ports) {
    if (p && "witr" in p) p.witr = null;
  }
}

module.exports = {
  probe,
  enrichPorts,
  strip,
  readConfig,
  cacheClear: runner.cacheClear,
  host,
  runner,
};
