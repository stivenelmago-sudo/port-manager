/**
 * PortPilot - Webview HTML Generator
 *
 * Renders the multi-tab sidebar: Ports (existing) + Processes (NEW) +
 * Container details panel. Process details show ancestry tree, env vars,
 * cwd, sockets, source supervisor.
 */

const getStyles = require("./styles");
const getScript = require("./script");

function escape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate the complete webview HTML content
 * @param {Object} strings - Pre-resolved i18n strings (key -> string)
 * @returns {string} HTML content
 */
function getWebviewContent(strings = {}) {
  const s = Object.assign({
    searchPlaceholder: "",
    refresh: "Refresh",
    rangeScan: "Range Scan",
    bulkKill: "KILL Selected",
    range: "Range:",
    run: "Run",
    statsUsed: "Used",
    statsFree: "Free",
    statsTotal: "Total",
    empty: "No matching ports",
    colPort: "Port",
    colState: "State",
    colProcess: "Process",
    colPid: "PID",
    colAncestry: "Ancestry",
    colAction: "Action",
    stateListen: "LISTEN",
    stateFree: "FREE",
    kill: "KILL",
    confirm: "Confirm",
    cancel: "Cancel",
    langMenu: "🌐 Language",
    ancestryNone: "—",
    ancestryLoading: "loading…",
    witrMissing: "Process ancestry unavailable",
    witrPermission: "Run VS Code as Admin/sudo for full ancestry",
    statsAncestry: "with ancestry",
    // New strings for tabs + details
    tabPorts: "Ports",
    tabProcesses: "Processes",
    autoRefreshOn: "Auto-refresh ON",
    autoRefreshOff: "Auto-refresh OFF",
    detailsTitle: "Process Details",
    detailsClose: "Close",
    detailsAncestry: "Ancestry",
    detailsCwd: "Working Dir",
    detailsEnv: "Environment",
    detailsSockets: "Sockets",
    detailsSource: "Source",
    detailsStarted: "Started",
    detailsCommand: "Command",
    detailsUser: "User",
    detailsNoData: "Select a process to view details",
    detailsLoading: "Loading process details…",
    detailsNotAvailable: "Process details not available",
    emptyProcesses: "No processes found",
    colCpu: "CPU",
    colMemory: "Memory",
    colCommand: "Command",
    // Containers
    tabContainers: "Containers",
    emptyContainers: "No containers found",
    colRuntime: "Runtime",
    colImage: "Image",
    colStatus: "Status",
    colAction2: "Actions",
    actionStop: "Stop",
    actionRestart: "Restart",
    actionStart: "Start",
    actionPause: "Pause",
    actionLogs: "Logs",
    actionInspect: "Inspect",
    // Locks
    tabLocks: "Locks",
    emptyLocks: "No file locks found",
    colFd: "FD",
    colPath: "Path",
    colInode: "Inode",
    locksAllOpen: "Show all open files",
    // Process actions
    actionTerminate: "Terminate",
    actionResume: "Resume",
    actionRenice: "Renice",
    niceValue: "Nice value (-20 to 19)",
  }, strings);
  s._supported = strings._supported || [];

  const dir = s._lang === "ar" ? "rtl" : "ltr";

  return /*html*/ `<!DOCTYPE html>
<html lang="${escape(s._lang || "en")}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${getStyles()}</style>
</head>
<body>
  ${getTabs(s)}
  ${getToolbar(s)}
  ${getScanPanel(s)}
  <div class="stats" id="stats"></div>
  ${getTable(s)}
  ${getContainersPanel(s)}
  ${getLocksPanel(s)}
  <div class="empty" id="empty" style="display:none">${escape(s.empty)}</div>
  ${getDetailsPanel(s)}
  <div id="toastContainer"></div>
  <script>${getScript(s)}</script>
</body>
</html>`;
}

function getTabs(s) {
  return /*html*/ `
<div class="tabs" role="tablist">
  <button class="tab tab-active" data-tab="ports" role="tab" aria-selected="true">${escape(s.tabPorts)}</button>
  <button class="tab" data-tab="processes" role="tab" aria-selected="false">${escape(s.tabProcesses)}</button>
  <button class="tab" data-tab="containers" role="tab" aria-selected="false">${escape(s.tabContainers)}</button>
  <button class="tab" data-tab="locks" role="tab" aria-selected="false">${escape(s.tabLocks)}</button>
  <button class="tab-refresh" id="autoRefreshToggle" title="${escape(s.autoRefreshOn)}">
    <span class="dot dot-pulse"></span>
    <span id="autoRefreshLabel">${escape(s.autoRefreshOn)}</span>
  </button>
</div>`;
}

function getContainersPanel(s) {
  return /*html*/ `
<div id="containersPanel" style="display:none">
  <table id="containersTable">
    <thead>
      <tr>
        <th data-sort="runtime">${escape(s.colRuntime)}</th>
        <th data-sort="name">${escape(s.colProcess)}</th>
        <th data-sort="image">${escape(s.colImage)}</th>
        <th data-sort="state">${escape(s.colState)}</th>
        <th data-sort="status">${escape(s.colStatus)}</th>
        <th style="text-align:right">${escape(s.colAction2)}</th>
      </tr>
    </thead>
    <tbody id="containersTbody"></tbody>
  </table>
  <div class="empty" id="containersEmpty" style="display:none">${escape(s.emptyContainers)}</div>
</div>`;
}

function getLocksPanel(s) {
  return /*html*/ `
<div id="locksPanel" style="display:none">
  <label class="locks-toggle">
    <input type="checkbox" id="locksAllOpen"> ${escape(s.locksAllOpen)}
  </label>
  <table id="locksTable">
    <thead>
      <tr>
        <th data-sort="type">${escape(s.colState)}</th>
        <th data-sort="pid">${escape(s.colPid)}</th>
        <th data-sort="fd">${escape(s.colFd)}</th>
        <th data-sort="path">${escape(s.colPath)}</th>
        <th data-sort="inode">${escape(s.colInode)}</th>
      </tr>
    </thead>
    <tbody id="locksTbody"></tbody>
  </table>
  <div class="empty" id="locksEmpty" style="display:none">${escape(s.emptyLocks)}</div>
</div>`;
}

function getToolbar(s) {
  const langs = (s._supported || []);
  const currentLang = s._lang || "en";
  const langOptions = langs.map(l =>
    `<option value="${escape(l.code)}"${l.code === currentLang ? " selected" : ""}>${escape(l.label)}</option>`
  ).join("");
  return /*html*/ `
<div class="toolbar">
  <input type="text" id="search" placeholder="${escape(s.searchPlaceholder)}">
  <button class="btn" onclick="refresh()">${escape(s.refresh)}</button>
  <button class="btn btn-outline" id="rangeScanBtn" onclick="toggleScan()">${escape(s.rangeScan)}</button>
  <button class="btn btn-danger" id="bulkKillBtn" style="display:none" onclick="bulkKill()">${escape(s.bulkKill)}</button>
  <select class="btn btn-outline lang-select" id="langSelect" title="${escape(s.langMenu || "Language")}" onchange="changeLang(this.value)">
    ${langOptions}
  </select>
</div>`;
}

function getScanPanel(s) {
  return /*html*/ `
<div class="scan-panel" id="scanPanel" style="display:none">
  <label>${escape(s.range)}</label>
  <input type="number" id="scanFrom" value="3000">
  <span style="opacity:0.4">〜</span>
  <input type="number" id="scanTo" value="9999">
  <button class="btn btn-sm" onclick="scanRange()">${escape(s.run)}</button>
</div>`;
}

function getTable(s) {
  // The same table is used for both tabs; rows are rebuilt in JS based on the
  // active tab. We expose all column headers (some hidden via CSS for the
  // Processes tab).
  return /*html*/ `
<table id="mainTable">
  <thead>
    <tr>
      <th style="width:36px" class="col-select">
        <input type="checkbox" id="selectAll" onchange="toggleAll(this.checked)">
      </th>
      <th data-sort="port" data-tab="ports" onclick="sortBy('port')" class="sorted">${escape(s.colPort)} ▲</th>
      <th data-sort="state" data-tab="ports" onclick="sortBy('state')">${escape(s.colState)}</th>
      <th data-sort="process" data-tab="ports" onclick="sortBy('process')">${escape(s.colProcess)}</th>
      <th data-sort="pid" data-tab="ports" onclick="sortBy('pid')">${escape(s.colPid)}</th>
      <th data-sort="ancestry" data-tab="ports" onclick="sortBy('ancestry')">${escape(s.colAncestry)}</th>
      <th data-sort="port" data-tab="processes" onclick="sortBy('port')" style="display:none">${escape(s.colPort)}</th>
      <th data-sort="ancestry" data-tab="processes" onclick="sortBy('ancestry')" style="display:none">${escape(s.colAncestry)}</th>
      <th data-sort="cpu" data-tab="processes" onclick="sortBy('cpu')" style="display:none">${escape(s.colCpu)}</th>
      <th data-sort="memory" data-tab="processes" onclick="sortBy('memory')" style="display:none">${escape(s.colMemory)}</th>
      <th data-sort="cmd" data-tab="processes" onclick="sortBy('cmd')" style="display:none">${escape(s.colCommand)}</th>
      <th style="text-align:right" class="col-action">${escape(s.colAction)}</th>
    </tr>
  </thead>
  <tbody id="tbody"></tbody>
</table>`;
}

function getDetailsPanel(s) {
  return /*html*/ `
<div class="details-panel" id="detailsPanel" style="display:none">
  <div class="details-header">
    <span class="details-title">${escape(s.detailsTitle)}</span>
    <button class="details-close" onclick="closeDetails()">×</button>
  </div>
  <div class="details-body" id="detailsBody">
    <div class="details-empty">${escape(s.detailsNoData)}</div>
  </div>
</div>`;
}

module.exports = { getWebviewContent };
