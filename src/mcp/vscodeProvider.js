/**
 * PortPilot - VS Code MCP Definition Provider
 *
 * Registers the PortPilot MCP server with the editor via
 * `vscode.lm.registerMcpServerDefinitionProvider`. Once the extension is
 * installed, VS Code will automatically discover the server and surface its
 * tools in chat / agent mode without any user setup.
 *
 * This complements the on-disk config-file registration done by
 * `autoConfig.js`: the in-process provider is what the editor calls
 * directly, while the on-disk entries cover third-party clients (Kilo,
 * Claude Code, Claude Desktop) and workspaces that haven't installed the
 * extension.
 */

const path = require("path");
const vscode = require("vscode");
const autoConfig = require("./autoConfig");

const PROVIDER_ID = "portpilot.mcp-servers";

/**
 * Resolve the absolute path to mcp-server/index.js, preferring the path
 * inside this extension's installation directory. Falls back to a sibling
 * location for dev / link installs.
 */
function resolveMcpEntry(extensionPath) {
  const fs = require("fs");
  const base = extensionPath || path.resolve(__dirname, "..", "..");
  const candidates = [
    path.join(base, "mcp-server", "index.js"),
    path.join(base, "..", "mcp-server", "index.js"),
  ];
  for (const c of candidates) {
    try {
      fs.accessSync(c);
      return c;
    } catch {
      // try next
    }
  }
  // Best-effort: return the first candidate even if missing — the error
  // will surface in the editor as a clear "failed to start" message.
  return candidates[0];
}

/**
 * Register the MCP provider and run one-time on-disk auto-configuration so
 * third-party clients pick up the same server.
 *
 * @param {vscode.ExtensionContext} context
 */
function register(context) {
  const extensionPath = (context && context.extensionPath) || path.resolve(__dirname, "..", "..");
  const mcpEntry = resolveMcpEntry(extensionPath);
  let pkg = { version: "0.0.0" };
  try {
    pkg = require(path.join(extensionPath, "package.json"));
  } catch {
    // Dev/test paths may not have a package.json at the expected location;
    // default to 0.0.0 so the version metadata is still well-formed.
  }
  const nodeBin = process.execPath;

  // 1. In-process provider — auto-discovered by VS Code ≥1.101.
  try {
    if (vscode.lm && typeof vscode.lm.registerMcpServerDefinitionProvider === "function") {
      const disposable = vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
        async provideMcpServerDefinitions() {
          return [
            new vscode.McpStdioServerDefinition(
              "PortPilot",
              nodeBin,
              [mcpEntry],
              {},
              pkg.version
            ),
          ];
        },
      });
      context.subscriptions.push(disposable);
    }
  } catch (e) {
    // Older VS Code or restricted runtime — silently skip; the on-disk
    // config file written by autoConfigure is still functional.
    console.warn(`[portpilot] MCP provider registration skipped: ${e.message}`);
  }

  // 2. On-disk auto-config (one-shot per session, non-blocking).
  try {
    const workspaceDir = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;
    autoConfig.autoConfigure({
      mcpEntry,
      workspaceDir,
      allowWorkspaceWrite: true,
      verbose: false,
    });
  } catch (e) {
    console.warn(`[portpilot] autoConfigure failed: ${e.message}`);
  }
}

module.exports = { register, PROVIDER_ID, resolveMcpEntry };
