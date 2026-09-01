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

const host = require("./host");
const runner = require("./runner");

/**
 * @typedef {Object} WitrAvailability
 * @property {"available"|"missing"|"unsupported"|"permission_denied"|"error"} status
 * @property {string} [hint] - human-readable hint for the UI
 * @property {string} [binaryPath] - resolved path when status==="available"
 */

/**
 * Resolve the host binary and return availability metadata.
 * @param {vscode.ExtensionContext} ctx
 * @returns {WitrAvailability}
 */
function probe(ctx) {
  if (!host.isSupported()) {
    return {
      status: "unsupported",
      hint: "Process ancestry is not available on this platform.",
    };
  }
  const bin = host.binaryPath(ctx);
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
 * Sets the module-level `lastError` if WITR fails — read by the UI to show
 * a one-time toast hint (e.g. "relaunch VS Code as Administrator").
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

  // lookupPortsBatch returns null for failed lookups — only successful
  // entries are in the map, so fall back to null for everything else.
  for (const row of portsWithPid) {
    row.witr = map.get(row.port) || null;
  }

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
  host,
  runner,
};
