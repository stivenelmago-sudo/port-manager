/**
 * PortPilot - Webview Provider
 */

const vscode = require("vscode");
const { getWebviewContent } = require("../webview");
const { getListeningPorts, getListeningPortsEnriched, killByPid, killGraceful } = require("../core/portService");
const { MESSAGE_TYPE, COMMAND } = require("../core/constants");
const { probe } = require("../witr");
const i18n = require("../i18n");

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

async function handleMessage(msg, webview, witrAvailability) {
  const t0 = Date.now();
  switch (msg.command) {
    case COMMAND.REFRESH:
      await handleRefresh(webview, witrAvailability);
      break;
    case "refreshProcesses":
      await handleRefreshProcesses(webview, witrAvailability);
      break;
    case "getProcessDetails":
      await handleProcessDetails(webview, msg.pid, witrAvailability);
      break;
    case COMMAND.KILL:
      await handleKill(msg, webview);
      break;
    case COMMAND.BULK_KILL:
      await handleBulkKill(msg, webview);
      break;
    case COMMAND.SCAN:
      handleScan(msg, webview);
      break;
    case COMMAND.SET_LANGUAGE:
      handleSetLanguage(msg.lang);
      break;
  }
  const dt = Date.now() - t0;
  // Echo back timing so the webview can adjust the auto-refresh cadence.
  webview.postMessage({ type: "_refreshMs", ms: dt });
}

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

async function handleRefreshProcesses(webview, witrAvailability) {
  if (!witrAvailability || witrAvailability.status !== "available" || !witrAvailability.binaryPath) {
    webview.postMessage({ type: "processes", processes: [], witr: { status: witrAvailability.status } });
    return;
  }
  try {
    const { runner } = require("../witr");
    const raw = await runner.listProcesses(witrAvailability.binaryPath);
    // Normalize WITR's process shape to what the webview expects.
    const processes = raw.map((p) => ({
      pid: p.pid || p.process?.pid,
      name: p.name || p.process?.name || p.process?.command?.split(" ")[0] || "?",
      command: p.command || p.process?.command || "",
      user: p.user || p.process?.user || "",
      cpu: p.cpu || p.resource?.cpu || 0,
      memory: p.memory || p.resource?.memory || 0,
      source: p.source || "",
      started: p.started || p.start_time || "",
    })).filter((p) => p.pid);
    webview.postMessage({ type: "processes", processes, witr: { status: "available", count: processes.length } });
  } catch (e) {
    webview.postMessage({ type: "processes", processes: [], witr: { status: "error", hint: e.message } });
  }
}

async function handleProcessDetails(webview, pid, witrAvailability) {
  if (!pid) return;
  if (!witrAvailability || witrAvailability.status !== "available" || !witrAvailability.binaryPath) {
    webview.postMessage({ type: "processDetails", pid, error: witrAvailability.hint || "witr unavailable" });
    return;
  }
  try {
    const { runner } = require("../witr");
    const raw = await runner.getProcessDetails(witrAvailability.binaryPath, pid);
    if (!raw) {
      webview.postMessage({ type: "processDetails", pid, error: "no data" });
      return;
    }
    // Normalize WITR's PascalCase JSON into the camelCase shape the webview expects.
    const p = raw.Process || {};
    const data = {
      pid: p.PID,
      ppid: p.PPID,
      name: raw.ResolvedTarget || p.Command,
      command: p.Cmdline || p.Command,
      user: p.User,
      cwd: p.WorkingDir,
      started: p.StartedAt,
      cpu: p.CPUPercent,
      memory: p.MemoryRSS,
      gitRepo: p.GitRepo,
      gitBranch: p.GitBranch,
      container: p.Container,
      service: p.Service,
      ancestry: raw.Ancestry || [],
      source: raw.Source,
      sockets: raw.SocketInfo || [],
      warnings: raw.Warnings || [],
      environment: raw.FileContext?.environment || raw.Environment || {},
    };
    webview.postMessage({ type: "processDetails", pid, data });
  } catch (e) {
    webview.postMessage({ type: "processDetails", pid, error: e.message });
  }
}

async function handleKill(msg, webview) {
  try {
    const result = await killGraceful(msg.pid);
    webview.postMessage({
      type: MESSAGE_TYPE.KILLED,
      port: msg.port,
      signal: result.signal,
      escalated: result.escalated,
    });
  } catch (e) {
    webview.postMessage({
      type: MESSAGE_TYPE.KILL_ERROR,
      error: e.message,
    });
  }
}

async function handleBulkKill(msg, webview) {
  const ports = getListeningPorts();
  let killed = 0;
  let escalated = 0;
  for (const targetPort of msg.ports) {
    const found = ports.find((p) => p.port === targetPort);
    if (found) {
      try {
        const result = await killGraceful(found.pid);
        killed++;
        if (result.escalated) escalated++;
      } catch {
        // Continue with other ports
      }
    }
  }
  webview.postMessage({
    type: MESSAGE_TYPE.KILLED,
    port: i18n.tr("webview.bulkKilledLabel", killed) + (escalated ? ` (${escalated} escalated)` : ""),
  });
}

function handleScan(msg, _webview) {
  const ports = getListeningPorts();
  const usedSet = new Set(ports.map((p) => p.port));
  let freeCount = 0;
  let usedCount = 0;
  for (let p = msg.from; p <= msg.to; p++) {
    if (usedSet.has(p)) usedCount++;
    else freeCount++;
  }
  vscode.window.showInformationMessage(
    i18n.tr("webview.toastScan", usedCount, freeCount)
  );
}

async function handleSetLanguage(lang) {
  if (!lang || !i18n.SUPPORTED.includes(lang)) return;
  try {
    await vscode.workspace
      .getConfiguration()
      .update("portManager.language", lang, vscode.ConfigurationTarget.Global);
  } catch {
    // ignore
  }
  i18n.setLanguage(lang);
  await vscode.commands.executeCommand("workbench.action.reloadWindow");
}

module.exports = { createWebviewProvider };
