/**
 * PortPilot - Webview Provider
 */

const vscode = require("vscode");
const { getWebviewContent } = require("../webview");
const {
  getListeningPorts, getListeningPortsEnriched,
  killByPid, killGraceful,
  terminateByPid, pauseByPid, resumeByPid, renice,
} = require("../core/portService");
const { listContainers, inspectContainer, runtimeAction } = require("../core/containerService");
const { listLocks, listInterestingFds } = require("../core/lockService");
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
  switch (msg.command) {
    case COMMAND.REFRESH:
      await handleRefresh(webview, witrAvailability);
      break;
    case COMMAND.REFRESH_PROCESSES:
      await handleRefreshProcesses(webview, witrAvailability);
      break;
    case COMMAND.REFRESH_CONTAINERS:
      await handleRefreshContainers(webview);
      break;
    case COMMAND.REFRESH_LOCKS:
      await handleRefreshLocks(webview);
      break;
    case COMMAND.GET_PROCESS_DETAILS:
      await handleProcessDetails(webview, msg.pid, witrAvailability);
      break;
    case COMMAND.GET_CONTAINER_DETAILS:
      await handleContainerDetails(webview, msg.runtime, msg.id);
      break;
    case COMMAND.CONTAINER_ACTION:
      await handleContainerAction(webview, msg.runtime, msg.id, msg.action);
      break;
    case COMMAND.PROCESS_ACTION:
      await handleProcessAction(webview, msg.pid, msg.action, msg.nice);
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
  // WITR (the bundled v0.3.3 binary) has no "list all processes" mode — invoking
  // it with no target opens an interactive TUI instead of emitting JSON. So
  // derive the Processes tab rows from listening ports, enriched with witr
  // ancestry data when available. cpu/memory/command stay blank unless a
  // future WITR release (or another tool) provides them.
  let ports = [];
  let witrStatus = witrAvailability ? witrAvailability.status : "skipped";
  let witrHint = witrAvailability ? witrAvailability.hint : undefined;
  try {
    if (witrAvailability && witrAvailability.status === "available" && witrAvailability.binaryPath) {
      const { ports: enriched, availability } = await getListeningPortsEnriched({
        witrBin: witrAvailability.binaryPath,
      });
      ports = enriched;
      // Propagate witr's own status/hint so the webview can show the real
      // reason if enrichment failed (permission denied, binary error, etc.)
      // instead of silently masking it behind plain listening-port data.
      if (availability && availability.status && availability.status !== "available") {
        witrStatus = availability.status;
        witrHint = availability.hint || witrHint;
      }
    } else {
      ports = getListeningPorts();
    }
  } catch (e) {
    ports = getListeningPorts();
    witrStatus = "error";
    witrHint = e && e.message ? e.message : witrHint;
  }

  // Deduplicate by pid — one process can hold several ports. Keep the first
  // port for reference so the user still sees which port(s) the process owns.
  const byPid = new Map();
  for (const p of ports) {
    if (!p || !p.pid) continue;
    if (!byPid.has(p.pid)) {
      byPid.set(p.pid, {
        pid: p.pid,
        name: p.process || "?",
        port: p.port,
        ancestry: p.witr && p.witr.chain ? p.witr.chain : "",
        source: p.witr && p.witr.leafName ? p.witr.leafName : "",
        command: "",
        cpu: 0,
        memory: 0,
      });
    }
  }

  const witrMsg = { status: witrStatus };
  if (witrHint) witrMsg.hint = witrHint;
  webview.postMessage({
    type: "processes",
    processes: Array.from(byPid.values()),
    witr: witrMsg,
  });
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
    const p = raw.Process || {};
    // Normalize WITR's PascalCase + nested shapes into the simple camelCase
    // contract the webview expects, so the renderers never receive a raw
    // object/array and have to stringify it (which produces "[object Object]").
    const ancestry = (raw.Ancestry || []).map((node) => ({
      name: (node && (node.Command || node.name)) || "?",
      pid: (node && (node.PID ?? node.pid)) ?? null,
    }));
    const source = raw.Source && typeof raw.Source === "object"
      ? (raw.Source.Description || raw.Source.Name || raw.Source.Type || "")
      : (raw.Source || "");
    const sockets = (raw.SocketInfo || []).map((s) => ({
      address: s && (s.Address || s.address || s.bind || ""),
      port: s && (s.Port ?? s.port),
      state: s && (s.State || s.state || ""),
      protocol: s && (s.Protocol || s.protocol || ""),
    }));
    const environment = (raw.FileContext && raw.FileContext.environment)
      || raw.Environment
      || {};
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
      ancestry,
      source,
      sockets,
      warnings: raw.Warnings || [],
      environment,
    };
    webview.postMessage({ type: "processDetails", pid, data });
  } catch (e) {
    webview.postMessage({ type: "processDetails", pid, error: e.message });
  }
}

async function handleRefreshContainers(webview) {
  try {
    const { containers, runtimes } = await listContainers();
    webview.postMessage({ type: "containers", containers, runtimes });
  } catch (e) {
    webview.postMessage({ type: "containers", containers: [], runtimes: [], error: e.message });
  }
}

async function handleRefreshLocks(webview) {
  try {
    const locks = await listLocks();
    webview.postMessage({ type: "locks", locks });
  } catch (e) {
    webview.postMessage({ type: "locks", locks: [], error: e.message });
  }
}

async function handleContainerDetails(webview, runtime, id) {
  try {
    const data = await inspectContainer(runtime, id);
    webview.postMessage({ type: "containerDetails", runtime, id, data });
  } catch (e) {
    webview.postMessage({ type: "containerDetails", runtime, id, error: e.message });
  }
}

async function handleContainerAction(webview, runtime, id, action) {
  try {
    let payload = null;
    if (action === "logs" || action === "inspect") {
      payload = await runtimeAction(runtime, id, action);
      webview.postMessage({ type: "containerOutput", runtime, id, action, output: payload || "" });
    } else {
      await runtimeAction(runtime, id, action);
      vscode.window.showInformationMessage(`Container ${action}: ${id}`);
      // Refresh the container list.
      const { containers, runtimes } = await listContainers();
      webview.postMessage({ type: "containers", containers, runtimes });
    }
  } catch (e) {
    vscode.window.showErrorMessage(`Container ${action} failed: ${e.message}`);
  }
}

async function handleProcessAction(webview, pid, action, nice) {
  try {
    let result;
    switch (action) {
      case "terminate": result = terminateByPid(pid); break;
      case "pause":    result = pauseByPid(pid); break;
      case "resume":   result = resumeByPid(pid); break;
      case "renice":   result = renice(pid, nice); break;
      default: throw new Error(`Unknown process action: ${action}`);
    }
    webview.postMessage({ type: "processActionResult", pid, action, ok: true, result });
  } catch (e) {
    webview.postMessage({ type: "processActionResult", pid, action, ok: false, error: e.message });
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
        // continue
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
