/**
 * PortPilot - VS Code Extension
 *
 * View listening ports, check availability, and kill processes.
 * Works on macOS, Windows, and Linux.
 */

const vscode = require("vscode");
const { createWebviewProvider } = require("./providers/webviewProvider");
const { registerCommands } = require("./commands");
const i18n = require("./i18n");
const mcpProvider = require("./mcp/vscodeProvider");
const autoConfig = require("./mcp/autoConfig");

/**
 * Sync the current MCP settings (enabled + disabledTools) to the runtime
 * config file the spawned MCP server reads on every call.
 */
function syncMcpRuntimeConfig() {
  try {
    const cfg = vscode.workspace.getConfiguration("portManager.mcp");
    autoConfig.syncMcpConfig({
      enabled: cfg.get("enabled", true) !== false,
      disabledTools: cfg.get("disabledTools", []) || [],
      version: require("../package.json").version,
    });
  } catch (e) {
    console.warn(`[portpilot] syncMcpConfig failed: ${e.message}`);
  }
}

/**
 * Extension activation
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  i18n.init();

  // Register the MCP server with VS Code so its tools are auto-discovered
  // (1.101+). Also writes a portpilot entry into any known client config
  // files (Kilo, Claude Code, Claude Desktop) on a best-effort basis.
  mcpProvider.register(context);

  // Push current MCP settings to the runtime config file so a freshly
  // spawned server picks them up immediately.
  syncMcpRuntimeConfig();

  // Register sidebar webview provider
  const provider = createWebviewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("portManager.panel", provider)
  );

  // Register commands
  registerCommands(context);

  // Refresh UI on language change
  context.subscriptions.push({
    dispose: i18n.onLanguageChange(() => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    }),
  });

  // React to manual configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("portManager.language")) {
        i18n.setLanguage(i18n.detectLanguage());
      }
      if (e.affectsConfiguration("portManager.mcp")) {
        syncMcpRuntimeConfig();
      }
    })
  );

  // Optional: manual language override command
  context.subscriptions.push(
    vscode.commands.registerCommand("portManager.setLanguage", async () => {
      const langs = i18n.SUPPORTED.map((l) => ({
        label: l,
        description: l === i18n.getLanguage() ? i18n.tr("setLanguage.current") : "",
      }));
      const picked = await vscode.window.showQuickPick(langs, {
        placeHolder: i18n.tr("setLanguage.prompt"),
      });
      if (!picked) return;
      try {
        await vscode.workspace
          .getConfiguration()
          .update("portManager.language", picked.label, vscode.ConfigurationTarget.Global);
      } catch {
        // Configuration target may be unavailable in some contexts; continue anyway
      }
      i18n.setLanguage(picked.label);
      vscode.window.showInformationMessage(i18n.tr("setLanguage.changed", picked.label));
    })
  );
}

/**
 * Extension deactivation
 */
function deactivate() {}

module.exports = { activate, deactivate };
