/**
 * PortPilot - MCP Auto-Configuration
 *
 * Shared logic used by both the VS Code extension activation path and the
 * `npm` postinstall script. Detects which AI clients are present on the
 * host (VS Code / GitHub Copilot, Cursor, Antigravity, Kilo, Claude Code,
 * Claude Desktop) and writes a portpilot MCP entry into each of their
 * config files. Also ensures the WITR ancestry binary is present for the
 * current host.
 *
 * Detection sources:
 *   - vscode.env.appName when run inside an editor (tells us the active host)
 *   - filesystem markers (~/.cursor, ~/.antigravity, ~/.gemini, ...)
 *
 * Design goals:
 *   - Idempotent: never overwrite an existing portpilot entry.
 *   - Non-fatal: any individual failure is logged and skipped so a single
 *     unreadable config file can't break installation.
 *   - Opt-out: respect PORTPILOT_SKIP_AUTOCONFIG=1.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const MCP_LABEL = "portpilot";
const SKIP_ENV = "PORTPILOT_SKIP_AUTOCONFIG";

function shouldSkip() {
  return process.env[SKIP_ENV] === "1" || process.env[SKIP_ENV] === "true";
}

function log(msg) {
  process.stderr.write(`[portpilot-autoconfig] ${msg}\n`);
}

/**
 * Build the MCP server entry that clients will execute.
 * Resolves to an absolute path so the entry is valid no matter what cwd the
 * client launches the server from.
 *
 * @param {string} mcpEntry absolute path to mcp-server/index.js
 * @param {string} [nodeBin] optional node binary (defaults to process.execPath)
 */
function buildServerEntry(mcpEntry, nodeBin) {
  return {
    command: nodeBin || process.execPath,
    args: [mcpEntry],
    env: {},
  };
}

/**
 * Read JSON from a file, returning an empty object on missing/parse error.
 * Caller decides whether the file should exist.
 */
function readJsonSafe(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeJsonAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

function isAlreadyRegistered(configObj) {
  if (!configObj) return false;
  const servers = (configObj.mcpServers && typeof configObj.mcpServers === "object")
    ? configObj.mcpServers
    : (configObj.servers && typeof configObj.servers === "object" ? configObj.servers : null);
  if (!servers) return false;
  return Boolean(servers[MCP_LABEL]);
}

function registerInConfigFile(file, entry, opts = {}) {
  const exists = fs.existsSync(file);
  const cfg = exists ? readJsonSafe(file) : {};

  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") {
    cfg.mcpServers = {};
  }

  if (cfg.mcpServers[MCP_LABEL] && !opts.force) {
    return { status: "already", file };
  }

  cfg.mcpServers[MCP_LABEL] = entry;
  try {
    writeJsonAtomic(file, cfg);
    return { status: "registered", file };
  } catch (e) {
    return { status: "error", file, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Config locations
// ---------------------------------------------------------------------------

function candidateFiles(workspaceDir, platformOverride, appNameOverride) {
  const platform = platformOverride || process.platform;
  if (!isSupportedPlatform(platform)) return [];

  const clients = detectClients({ appName: appNameOverride });
  return candidateFilesForClients(workspaceDir, platform, clients);
}

/**
 * Returns true if the current host is one of the platforms PortPilot
 * auto-configures for. iOS/iPadOS users access the extension through a
 * remote workspace (SSH/WSL/Dev Container), so on the extension host
 * `process.platform` will be the remote OS — never ios. The guard is here
 * for the unusual case of running the postinstall directly from an iOS
 * Node fork, where no native paths exist.
 */
function isSupportedPlatform(override) {
  const p = override || process.platform;
  return p === "linux" || p === "darwin" || p === "win32" || p === "freebsd";
}

// ---------------------------------------------------------------------------
// MCP runtime config (read by the spawned server)
// ---------------------------------------------------------------------------

/**
 * Absolute path where the extension writes the MCP runtime config
 * (`enabled` + `disabledTools`) that the spawned MCP server picks up.
 */
function mcpConfigPath(opts = {}) {
  const home = opts.home || os.homedir();
  const appData = opts.appData || process.env.APPDATA;
  const platform = opts.platform || process.platform;
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "portpilot", "mcp.json");
  }
  if (platform === "win32" && appData) {
    return path.join(appData, "portpilot", "mcp.json");
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(xdg, "portpilot", "mcp.json");
}

/**
 * Write the MCP runtime config to disk. Called by the extension when
 * VS Code settings (`portManager.mcp.enabled`, `portManager.mcp.disabledTools`)
 * change. Safe to call repeatedly — overwrites atomically.
 *
 * @param {Object} opts
 * @param {boolean} opts.enabled
 * @param {string[]} opts.disabledTools
 * @param {string} [opts.version] extension version, stamped into the file
 * @returns {{path:string, written:boolean}}
 */
function syncMcpConfig(opts) {
  if (!isSupportedPlatform()) return { path: null, written: false };
  const file = mcpConfigPath();
  const data = {
    enabled: opts.enabled !== false,
    disabledTools: Array.isArray(opts.disabledTools) ? opts.disabledTools.slice() : [],
    version: opts.version || "0.0.0",
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, file);
    return { path: file, written: true };
  } catch (e) {
    return { path: file, written: false, error: e.message };
  }
}

/**
 * Read the MCP runtime config from disk (used by tests + the extension to
 * verify its own writes).
 */
function readMcpConfig(opts) {
  const file = mcpConfigPath(opts);
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Client detection
// ---------------------------------------------------------------------------

/**
 * Detect which AI clients are installed on this host so we only touch the
 * config files that exist for real users. Detection combines:
 *   1. The supplied `appName` (typically `vscode.env.appName`) which tells
 *      us the active editor host.
 *   2. Filesystem markers in the user's home directory.
 *   3. `~/.config`-style config dirs (XDG-friendly).
 *
 * Recognised clients:
 *   - vscode    : VS Code stable / Insiders + GitHub Copilot Chat (same engine)
 *   - cursor    : Cursor editor
 *   - antigravity: Google Antigravity (current known config paths)
 *   - kilo      : Kilo CLI / editor
 *   - claude-code, claude-desktop: Anthropic clients
 *
 * Returns a Set of client ids; callers can override or extend.
 *
 * @param {Object} [opts]
 * @param {string} [opts.appName]  editor application name (e.g. "Visual Studio Code", "Cursor", "Antigravity")
 * @param {string} [opts.home]     override $HOME (testing)
 * @param {string} [opts.appData]  override %APPDATA% (testing)
 * @param {boolean} [opts.includeDefaults]  also return clients that we always target (vscode, kilo, claude-code, claude-desktop)
 */
function detectClients(opts = {}) {
  const home = opts.home || os.homedir();
  const appData = opts.appData || process.env.APPDATA;
  const appName = (opts.appName || "").toLowerCase();
  const platform = process.platform;
  const found = new Set();

  // Always target the cross-platform Anthropic + Kilo configs — these are
  // small JSON files that don't clash with anything else. Users without
  // those clients just end up with an empty ~/.claude.json which is fine.
  if (opts.includeDefaults !== false) {
    found.add("claude-code");
    found.add("claude-desktop");
    found.add("kilo");
  }

  // 1. Active host via appName (works inside any Code-compatible editor)
  if (appName.includes("antigravity")) found.add("antigravity");
  if (appName.includes("cursor")) found.add("cursor");
  if (appName.includes("vs code") || appName.includes("visual studio code") || appName.includes("code - insiders")) {
    found.add("vscode");
  }

  // 2. Filesystem markers (works without an active editor — e.g. from npm postinstall)
  const has = (p) => { try { return fs.existsSync(p); } catch { return false; } };
  if (platform === "darwin") {
    if (has(path.join(home, "Library", "Application Support", "Cursor")) ||
        has(path.join(home, ".cursor"))) found.add("cursor");
    if (has(path.join(home, "Library", "Application Support", "antigravity")) ||
        has(path.join(home, ".antigravity")) ||
        has(path.join(home, "Library", "Application Support", "Google", "Antigravity"))) found.add("antigravity");
  } else if (platform === "win32") {
    if (appData && has(path.join(appData, "Cursor"))) found.add("cursor");
    if (appData && has(path.join(appData, "Antigravity"))) found.add("antigravity");
  } else {
    if (has(path.join(home, ".config", "Cursor")) || has(path.join(home, ".cursor"))) found.add("cursor");
    if (has(path.join(home, ".config", "antigravity")) ||
        has(path.join(home, ".antigravity")) ||
        has(path.join(home, ".config", "Google", "Antigravity")) ||
        has(path.join(home, ".gemini"))) found.add("antigravity");
    if (has(path.join(home, ".config", "Code")) || has(path.join(home, ".vscode"))) found.add("vscode");
  }

  // GitHub Copilot Chat runs inside the VS Code engine and reads the same
  // MCP config files. Tag "copilot" whenever vscode is detected (either
  // from appName or filesystem marker) so callers can log accordingly.
  if (found.has("vscode")) found.add("copilot");

  return found;
}

/**
 * Convert a Set / Array of detected client ids into the list of config file
 * paths to write, given the current platform and (optionally) workspace.
 * Each client may contribute zero, one, or many file paths.
 */
function candidateFilesForClients(workspaceDir, platform, clients, opts = {}) {
  const files = [];
  const home = opts.home || os.homedir();
  const appData = opts.appData || process.env.APPDATA;
  const set = clients instanceof Set ? clients : new Set(clients || []);

  if (set.has("vscode")) {
    if (workspaceDir) files.push(path.join(workspaceDir, ".vscode", "mcp.json"));
    if (platform === "win32" && appData) {
      files.push(path.join(appData, "Code", "User", "mcp.json"));
      files.push(path.join(appData, "Code - Insiders", "User", "mcp.json"));
    } else if (platform === "darwin") {
      files.push(path.join(home, "Library", "Application Support", "Code", "User", "mcp.json"));
      files.push(path.join(home, "Library", "Application Support", "Code - Insiders", "User", "mcp.json"));
    } else if (platform === "linux" || platform === "freebsd") {
      files.push(path.join(home, ".config", "Code", "User", "mcp.json"));
      files.push(path.join(home, ".config", "Code - Insiders", "User", "mcp.json"));
    }
  }

  if (set.has("cursor")) {
    if (workspaceDir) files.push(path.join(workspaceDir, ".cursor", "mcp.json"));
    if (platform === "win32" && appData) {
      files.push(path.join(appData, "Cursor", "User", "mcp.json"));
    } else if (platform === "darwin") {
      files.push(path.join(home, "Library", "Application Support", "Cursor", "User", "mcp.json"));
      files.push(path.join(home, ".cursor", "mcp.json"));
    } else if (platform === "linux" || platform === "freebsd") {
      files.push(path.join(home, ".config", "Cursor", "User", "mcp.json"));
      files.push(path.join(home, ".cursor", "mcp.json"));
    }
  }

  if (set.has("antigravity")) {
    if (workspaceDir) files.push(path.join(workspaceDir, ".antigravity", "mcp.json"));
    if (platform === "win32" && appData) {
      files.push(path.join(appData, "Antigravity", "mcp.json"));
    } else if (platform === "darwin") {
      files.push(path.join(home, "Library", "Application Support", "Antigravity", "mcp.json"));
      files.push(path.join(home, ".antigravity", "mcp.json"));
    } else if (platform === "linux" || platform === "freebsd") {
      files.push(path.join(home, ".config", "antigravity", "mcp.json"));
      files.push(path.join(home, ".antigravity", "mcp.json"));
      files.push(path.join(home, ".gemini", "antigravity", "mcp.json"));
    }
  }

  if (set.has("kilo")) {
    if (platform === "win32" && appData) {
      files.push(path.join(appData, "Kilo", "mcp.json"));
    } else if (platform === "darwin" || platform === "linux" || platform === "freebsd") {
      files.push(path.join(home, ".config", "kilo", "mcp.json"));
      files.push(path.join(home, ".kilo", "mcp.json"));
    }
  }

  if (set.has("claude-code")) {
    files.push(path.join(home, ".claude.json"));
  }

  if (set.has("claude-desktop")) {
    if (platform === "darwin") {
      files.push(path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"));
    } else if (platform === "win32" && appData) {
      files.push(path.join(appData, "Claude", "claude_desktop_config.json"));
    } else {
      files.push(path.join(home, ".config", "Claude", "claude_desktop_config.json"));
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register the MCP server into every config file we can write to.
 * Never throws; collects per-file results.
 *
 * @param {Object} opts
 * @param {string} opts.mcpEntry absolute path to mcp-server/index.js
 * @param {string} [opts.workspaceDir] cwd to also write .vscode/mcp.json
 * @param {boolean} [opts.verbose]
 * @returns {Array<{file:string,status:string,error?:string}>}
 */
function autoConfigure(opts) {
  if (shouldSkip()) {
    if (opts && opts.verbose) log("skipped (PORTPILOT_SKIP_AUTOCONFIG)");
    return [];
  }

  const effectivePlatform = (opts && opts.platform) || process.platform;
  if (!isSupportedPlatform(effectivePlatform)) {
    if (opts && opts.verbose) log(`skipped (unsupported platform: ${effectivePlatform})`);
    return [];
  }

  const entry = buildServerEntry(opts.mcpEntry);
  // Either use the caller-supplied clients list, fall back to appName-driven
  // detection, or auto-detect via filesystem markers. opts.clients wins.
  let clients = opts && opts.clients;
  if (!clients) {
    clients = detectClients({ appName: opts && opts.appName });
  }
  const files = candidateFilesForClients(opts.workspaceDir, effectivePlatform, clients, {
    home: opts && opts.home,
    appData: opts && opts.appData,
  });
  const results = [];

  for (const file of files) {
    const dir = path.dirname(file);
    // Skip files in directories we can't create (e.g. permission denied).
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      continue;
    }
    // Skip workspace-local files (.vscode/mcp.json, .cursor/mcp.json,
    // .antigravity/mcp.json) when they don't already exist — never create
    // a fresh client config in an arbitrary cwd. Only the VS Code
    // extension activation path opts into this.
    const exists = fs.existsSync(file);
    const fileName = path.basename(file);
    const isWorkspaceClientFile = [".vscode", ".cursor", ".antigravity"].some(
      (d) => file.includes(`${path.sep}${d}${path.sep}`) && file.endsWith(`${path.sep}mcp.json`)
    );
    if (!exists && isWorkspaceClientFile && !opts.allowWorkspaceWrite) {
      continue;
    }
    const r = registerInConfigFile(file, entry);
    results.push(r);
    if (opts.verbose) {
      log(`${r.status}: ${r.file}${r.error ? ` (${r.error})` : ""}`);
    }
  }

  return results;
}

/**
 * Ensure the WITR binary for the current host is present at resources/bin/.
 * Downloads only when the binary is missing; never overwrites.
 *
 * @param {string} repoRoot absolute path to the project root
 * @returns {Promise<{status:"present"|"downloaded"|"skipped"|"error", binaryPath?:string, error?:string}>}
 */
async function ensureWitrBinary(repoRoot) {
  const host = require("../witr/host");
  if (!host.isSupported()) {
    return { status: "skipped", error: "host unsupported" };
  }
  const name = host.resolveBinaryName();
  const target = path.join(repoRoot, "resources", "bin", name);
  if (fs.existsSync(target)) {
    return { status: "present", binaryPath: target };
  }

  if (shouldSkip()) {
    return { status: "skipped", error: "PORTPILOT_SKIP_AUTOCONFIG" };
  }

  // Reuse the existing downloader; it knows all platform targets and tags.
  try {
    const downloader = require("./downloadWitr");
    await downloader.downloadOne(process.platform, process.arch, repoRoot);
    if (fs.existsSync(target)) {
      return { status: "downloaded", binaryPath: target };
    }
    return { status: "error", error: "binary not found after download" };
  } catch (e) {
    return { status: "error", error: e.message };
  }
}

module.exports = {
  MCP_LABEL,
  SKIP_ENV,
  shouldSkip,
  isSupportedPlatform,
  detectClients,
  candidateFilesForClients,
  mcpConfigPath,
  syncMcpConfig,
  readMcpConfig,
  buildServerEntry,
  autoConfigure,
  ensureWitrBinary,
  candidateFiles,
  registerInConfigFile,
  isAlreadyRegistered,
};
