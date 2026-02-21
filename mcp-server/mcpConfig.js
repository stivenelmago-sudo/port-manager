/**
 * PortPilot MCP - Runtime Configuration
 *
 * The MCP server is a separate process, so it cannot query VS Code settings
 * directly. The extension writes its `portManager.mcp.enabled` and
 * `portManager.mcp.disabledTools` settings to a small JSON file in the
 * user's config dir; this module reads it on every tool call so toggles
 * take effect without a server restart.
 *
 * File locations (first existing wins, all overridable via env var):
 *   - PORTPILOT_MCP_CONFIG    absolute path to override
 *   - macOS:   ~/Library/Application Support/portpilot/mcp.json
 *   - Linux:   $XDG_CONFIG_HOME/portpilot/mcp.json or ~/.config/portpilot/mcp.json
 *   - Windows: %APPDATA%/portpilot/mcp.json
 *
 * Default config (when the file is missing) is `{enabled: true,
 * disabledTools: []}`.
 *
 * Caching is intentionally minimal: the server is short-lived (spawned per
 * MCP session), but for long-lived sessions we re-read on every check to
 * honour changes immediately.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULTS = Object.freeze({ enabled: true, disabledTools: [], version: "0.0.0" });

function defaultConfigPath() {
  if (process.env.PORTPILOT_MCP_CONFIG) return process.env.PORTPILOT_MCP_CONFIG;
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "portpilot", "mcp.json");
  }
  if (process.platform === "win32") {
    if (process.env.APPDATA) return path.join(process.env.APPDATA, "portpilot", "mcp.json");
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(xdg, "portpilot", "mcp.json");
}

function readConfig() {
  const file = defaultConfigPath();
  try {
    if (!fs.existsSync(file)) return { ...DEFAULTS, path: file, source: "defaults" };
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled !== false, // default true
      disabledTools: Array.isArray(parsed.disabledTools) ? parsed.disabledTools.slice() : [],
      version: typeof parsed.version === "string" ? parsed.version : "0.0.0",
      path: file,
      source: "file",
    };
  } catch {
    return { ...DEFAULTS, path: file, source: "defaults" };
  }
}

/**
 * Filter a list of tool specs against the current config. Returns:
 *   { tools: <filtered>, config, blocked: <tool names that were filtered out> }
 */
function applyToTools(allTools, config = readConfig()) {
  const blocked = [];
  if (!config.enabled) {
    return { tools: [], config, blocked: allTools.map((t) => t.name) };
  }
  const disabled = new Set(config.disabledTools || []);
  const tools = [];
  for (const t of allTools) {
    if (disabled.has(t.name)) {
      blocked.push(t.name);
      continue;
    }
    tools.push(t);
  }
  return { tools, config, blocked };
}

module.exports = { readConfig, applyToTools, defaultConfigPath, DEFAULTS };
