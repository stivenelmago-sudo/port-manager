/**
 * PortPilot - Webview Provider
 */

const vscode = require("vscode");
const { getWebviewContent } = require("../webview");
const { getListeningPorts, getListeningPortsEnriched, killByPid } = require("../core/portService");
const { MESSAGE_TYPE, COMMAND } = require("../core/constants");
const { probe } = require("../witr");
const i18n = require("../i18n");

/**
 * Create the webview provider for the sidebar panel
 * @param {vscode.ExtensionContext} [ctx] - optional extension context; when omitted,
 *   WITR enrichment is disabled (used by tests).
 * @returns {Object} WebviewViewProvider
 */
function createWebviewProvider(ctx) {
  const witrAvailability = ctx ? probe(ctx) : { status: "skipped", hint: "no context" };

  return {
    resolveWebviewView(webviewView) {
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getWebviewContent(i18n.getWebviewStrings());

      webviewView.webview.onDidReceiveMessage((msg) => {
        handleMessage(msg, webviewView.webview, witrAvailability);
      });
    },
  };
}

/**
 * Handle messages from the webview
 * @param {Object} msg - Message from webview
 * @param {Object} webview - Webview instance
 * @param {Object} witrAvailability - { status, binaryPath?, hint? }
 */
function handleMessage(msg, webview, witrAvailability) {
  switch (msg.command) {
    case COMMAND.REFRESH:
      handleRefresh(webview, witrAvailability);
      break;

    case COMMAND.KILL:
      handleKill(msg, webview);
      break;

    case COMMAND.BULK_KILL:
      handleBulkKill(msg, webview);
      break;

    case COMMAND.SCAN:
      handleScan(msg, webview);
      break;

    case COMMAND.SET_LANGUAGE:
      handleSetLanguage(msg.lang);
      break;
  }
}

/**
 * Set the UI language from the webview dropdown
 * @param {string} lang
 */
async function handleSetLanguage(lang) {
  if (!lang || !i18n.SUPPORTED.includes(lang)) return;
  try {
    await vscode.workspace
      .getConfiguration()
      .update("portManager.language", lang, vscode.ConfigurationTarget.Global);
  } catch {
    // Configuration target may be unavailable in some contexts
  }
  i18n.setLanguage(lang);
  await vscode.commands.executeCommand("workbench.action.reloadWindow");
}

/**
 * Send current ports to the webview. Enriches with WITR ancestry when
 * the bundled binary is available; otherwise falls back to plain ports.
 * @param {Object} webview
 * @param {Object} witrAvailability
 */
async function handleRefresh(webview, witrAvailability) {
  let payload;
  if (witrAvailability && witrAvailability.status === "available" && witrAvailability.binaryPath) {
    try {
      const { ports, availability } = await getListeningPortsEnriched({
        witrBin: witrAvailability.binaryPath,
      });
      payload = {
        type: MESSAGE_TYPE.PORTS,
        ports,
        witr: { status: availability.status, enriched: availability.enriched || 0 },
      };
    } catch {
      payload = { type: MESSAGE_TYPE.PORTS, ports: getListeningPorts() };
    }
  } else {
    payload = {
      type: MESSAGE_TYPE.PORTS,
      ports: getListeningPorts(),
      witr: { status: witrAvailability.status, hint: witrAvailability.hint },
    };
  }
  webview.postMessage(payload);
}

/**
 * Kill a single process
 * @param {Object} msg
 * @param {Object} webview
 */
function handleKill(msg, webview) {
  try {
    killByPid(msg.pid);
    webview.postMessage({
      type: MESSAGE_TYPE.KILLED,
      port: msg.port,
    });
  } catch (e) {
    webview.postMessage({
      type: MESSAGE_TYPE.KILL_ERROR,
      error: e.message,
    });
  }
}

/**
 * Kill multiple processes
 * @param {Object} msg
 * @param {Object} webview
 */
function handleBulkKill(msg, webview) {
  const ports = getListeningPorts();
  let killed = 0;

  for (const targetPort of msg.ports) {
    const found = ports.find((p) => p.port === targetPort);
    if (found) {
      try {
        killByPid(found.pid);
        killed++;
      } catch {
        // Continue with other ports
      }
    }
  }

  webview.postMessage({
    type: MESSAGE_TYPE.KILLED,
    port: t("webview.bulkKilledLabel", killed),
  });
}

/**
 * Scan a port range
 * @param {Object} msg
 * @param {Object} webview
 */
function handleScan(msg, _webview) {
  const ports = getListeningPorts();
  const usedSet = new Set(ports.map((p) => p.port));

  let freeCount = 0;
  let usedCount = 0;

  for (let p = msg.from; p <= msg.to; p++) {
    if (usedSet.has(p)) {
      usedCount++;
    } else {
      freeCount++;
    }
  }
}

module.exports = { createWebviewProvider };
