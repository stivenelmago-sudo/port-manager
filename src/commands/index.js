/**
 * PortPilot - VS Code Commands
 */

const vscode = require("vscode");
const { getListeningPorts, killByPid, checkPortFree } = require("../core/portService");
const { PORT } = require("../core/constants");
const { t } = require("../i18n");

/**
 * Register all extension commands
 * @param {vscode.ExtensionContext} context
 */
function registerCommands(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("portManager.show", showPortsCommand),
    vscode.commands.registerCommand("portManager.checkPort", checkPortCommand),
    vscode.commands.registerCommand("portManager.killPort", killPortCommand)
  );
}

/**
 * Show listening ports in a QuickPick
 */
async function showPortsCommand() {
  const ports = getListeningPorts();

  if (ports.length === 0) {
    vscode.window.showInformationMessage(t("noPorts"));
    return;
  }

  const items = ports.map((p) => ({
    label: `:${p.port}`,
    description: `${p.process} (PID: ${p.pid})`,
    port: p.port,
    pid: p.pid,
    process: p.process,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: t("quickPickPlaceholder"),
  });

  if (!picked) return;

  const confirm = await vscode.window.showWarningMessage(
    t("killConfirm", picked.port, picked.process),
    { modal: true },
    t("killButton")
  );

  if (confirm === t("killButton")) {
    await killProcess(picked.pid, picked.port);
  }
}

/**
 * Check if a port is available
 */
async function checkPortCommand() {
  const input = await vscode.window.showInputBox({
    prompt: t("inputPromptCheck"),
    placeHolder: t("inputPlaceholderCheck"),
    validateInput: validatePortNumber,
  });

  if (!input) return;

  const port = parseInt(input, 10);
  const free = await checkPortFree(port);

  if (free) {
    vscode.window.showInformationMessage(t("portFree", port));
    return;
  }

  const ports = getListeningPorts();
  const found = ports.find((p) => p.port === port);
  const detail = found ? ` (${found.process}, PID: ${found.pid})` : "";

  const action = await vscode.window.showWarningMessage(
    t("portUsed", port, detail),
    t("killButton")
  );

  if (action === t("killButton") && found) {
    await killProcess(found.pid, port);
  }
}

/**
 * Kill port(s) by number input
 */
async function killPortCommand() {
  const input = await vscode.window.showInputBox({
    prompt: t("inputPromptKill"),
    placeHolder: t("inputPlaceholderKill"),
  });

  if (!input) return;

  const ports = getListeningPorts();
  const targets = parsePortInput(input, ports);

  if (targets.length === 0) {
    vscode.window.showWarningMessage(t("noMatchingPorts"));
    return;
  }

  const desc = targets.map((t) => `:${t.port} (${t.process})`).join(", ");
  const confirm = await vscode.window.showWarningMessage(
    t("bulkKillConfirm", targets.length, desc),
    { modal: true },
    t("killButton")
  );

  if (confirm !== t("killButton")) return;

  let ok = 0;
  let fail = 0;

  for (const tgt of targets) {
    try {
      killByPid(tgt.pid);
      ok++;
    } catch {
      fail++;
    }
  }

  vscode.window.showInformationMessage(t("bulkKillResult", ok, fail));
}

/**
 * Kill a process and show result message
 * @param {number} pid
 * @param {number} port
 */
async function killProcess(pid, port) {
  try {
    killByPid(pid);
    vscode.window.showInformationMessage(t("killed", port));
  } catch (e) {
    vscode.window.showErrorMessage(t("killFailed", e.message));
  }
}

/**
 * Validate port number input
 * @param {string} value
 * @returns {string|null} Error message or null
 */
function validatePortNumber(value) {
  const n = parseInt(value, 10);
  if (!n || n < PORT.MIN || n > PORT.MAX) {
    return t("validateRange", PORT.MIN, PORT.MAX);
  }
  return null;
}

/**
 * Parse comma-separated port input
 * @param {string} input
 * @param {Array} availablePorts
 * @returns {Array}
 */
function parsePortInput(input, availablePorts) {
  return input
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => n > 0)
    .map((n) => availablePorts.find((p) => p.port === n))
    .filter(Boolean);
}

module.exports = { registerCommands };
