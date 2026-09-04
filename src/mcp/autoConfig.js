/**
 * PortPilot - MCP Auto-Configuration
 *
 * Shared logic used by both the VS Code extension activation path and the
 * `npm` postinstall script. Registers the PortPilot MCP server in well-known
 * client config files (Kilo, Claude Code, Claude Desktop, VS Code workspace
 * mcp.json) and ensures the WITR ancestry binary is present for the current
 * host.
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

function candidateFiles(workspaceDir, platformOverride) {
  const home = os.homedir();
  const files = [];
  const platform = platformOverride || process.platform;
  const appData = process.env.APPDATA;

  // iOS / other unsupported hosts get nothing — there are no well-known
  // config locations on those platforms, and the MCP entry would point at
  // paths the user doesn't have.
  if (!isSupportedPlatform(platform)) {
    return files;
  }

  // VS Code workspace mcp.json (per-project)
  if (workspaceDir) {
    files.push(path.join(workspaceDir, ".vscode", "mcp.json"));
  }

  // VS Code user mcp.json (Stable + Insiders)
  if (platform === "win32") {
    if (appData) {
      files.push(path.join(appData, "Code", "User", "mcp.json"));
      files.push(path.join(appData, "Code - Insiders", "User", "mcp.json"));
    }
  } else if (platform === "darwin") {
    files.push(path.join(home, "Library", "Application Support", "Code", "User", "mcp.json"));
    files.push(path.join(home, "Library", "Application Support", "Code - Insiders", "User", "mcp.json"));
  } else if (platform === "linux" || platform === "freebsd") {
    files.push(path.join(home, ".config", "Code", "User", "mcp.json"));
    files.push(path.join(home, ".config", "Code - Insiders", "User", "mcp.json"));
  }

  // Kilo
  if (platform === "win32") {
    if (appData) files.push(path.join(appData, "Kilo", "mcp.json"));
  } else {
    files.push(path.join(home, ".config", "kilo", "mcp.json"));
    files.push(path.join(home, ".kilo", "mcp.json"));
  }

  // Claude Code (user-level, cross-platform JSON file)
  files.push(path.join(home, ".claude.json"));

  // Claude Desktop
  if (platform === "darwin") {
    files.push(path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"));
  } else if (platform === "win32") {
    if (appData) files.push(path.join(appData, "Claude", "claude_desktop_config.json"));
  } else {
    files.push(path.join(home, ".config", "Claude", "claude_desktop_config.json"));
  }

  return files;
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
  const files = candidateFiles(opts.workspaceDir, effectivePlatform);
  const results = [];

  for (const file of files) {
    const dir = path.dirname(file);
    // Skip files in directories we can't create (e.g. permission denied).
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      continue;
    }
    // Only touch files that look like they belong to a real install —
    // never create a fresh .vscode/mcp.json in an arbitrary cwd.
    const exists = fs.existsSync(file);
    const isWorkspaceMcp = file.endsWith(path.join(".vscode", "mcp.json"));
    if (!exists && isWorkspaceMcp && !opts.allowWorkspaceWrite) {
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
  buildServerEntry,
  autoConfigure,
  ensureWitrBinary,
  candidateFiles,
  registerInConfigFile,
  isAlreadyRegistered,
};
