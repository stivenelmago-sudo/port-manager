/**
 * Port Manager - VS Code Extension
 *
 * View listening ports, check availability, and kill processes.
 * Works on macOS, Windows, and Linux.
 */

const vscode = require("vscode");
const { createWebviewProvider } = require("./webviewProvider");
const { registerCommands } = require("./commands");
const i18n = require("./i18n");

/**
 * Extension activation
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  i18n.init();

  // Register sidebar webview provider
  const provider = createWebviewProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("portManager.panel", provider)
  );

  // Register commands
  registerCommands(context);

  // Refresh UI on language change
  context.subscriptions.push(
    i18n.onLanguageChange(() => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    })
  );

  // React to manual configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("portManager.language")) {
        i18n.setLanguage(i18n.detectLanguage());
      }
    })
  );

  // Optional: manual language override command
  context.subscriptions.push(
    vscode.commands.registerCommand("portManager.setLanguage", async () => {
      const langs = i18n.SUPPORTED.map((l) => ({
        label: l,
        description: l === i18n.getLanguage() ? "current" : "",
      }));
      const picked = await vscode.window.showQuickPick(langs, {
        placeHolder: "Select language",
      });
      if (picked) {
        await vscode.workspace
          .getConfiguration()
          .update("portManager.language", picked.label, vscode.ConfigurationTarget.Global);
        i18n.setLanguage(picked.label);
        vscode.window.showInformationMessage(
          `Language: ${picked.label} (reload window)`
        );
      }
    })
  );
}

/**
 * Extension deactivation
 */
function deactivate() {}

module.exports = { activate, deactivate };
