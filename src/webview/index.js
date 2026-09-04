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
    bulkKill: "KILL Selected",
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
    // MCP tools tab
    tabTools: "Tools",
    mcpMasterLabel: "MCP server",
    mcpMasterOn: "Enabled",
    mcpMasterOff: "Disabled",
    mcpStatusRunning: "Active",
    mcpStatusStopped: "Stopped",
    mcpAutoconfigHint: "Auto-registered with VS Code, Cursor, Copilot, etc.",
    mcpCategoryRead: "Read",
    mcpCategoryWrite: "Write",
    mcpCategorySystem: "System",
    mcpDestructiveFlag: "destructive",
    mcpConfigPathHint: "Runtime config file",
    mcpServerVersionLabel: "Server version",
    mcpSelectAll: "Enable all",
    mcpDeselectAll: "Disable all",
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
  ${getLogoHeader()}
  ${getTabs(s)}
  ${getToolbar(s)}
  <div class="stats" id="stats"></div>
  ${getTable(s)}
  ${getContainersPanel(s)}
  ${getLocksPanel(s)}
  ${getMcpPanel(s)}
  <div class="empty" id="empty" style="display:none">${escape(s.empty)}</div>
  ${getDetailsPanel(s)}
  <div id="toastContainer"></div>
  <script>${getScript(s)}</script>
</body>
</html>`;
}

function getLogoHeader() {
  return /*html*/ `
<div class="sidebar-logo">
  <svg class="sidebar-logo-svg" width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-label="PortPilot" role="img">
    <defs>
      <linearGradient id="pp-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#00E676"/>
        <stop offset="100%" stop-color="#00B0FF"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="28" height="28" rx="7" fill="url(#pp-grad)"/>
    <circle cx="16" cy="16" r="9" fill="none" stroke="#0A0A0F" stroke-width="2.2"/>
    <path d="M11 16h10M16 11v10" stroke="#0A0A0F" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="11" cy="16" r="1.8" fill="#0A0A0F"/>
    <circle cx="21" cy="16" r="1.8" fill="#0A0A0F"/>
    <circle cx="16" cy="11" r="1.8" fill="#0A0A0F"/>
    <circle cx="16" cy="21" r="1.8" fill="#0A0A0F"/>
  </svg>
  <span class="sidebar-logo-text">
    <span class="sidebar-logo-title">PortPilot</span>
    <span class="sidebar-logo-sub">Port &amp; Process Manager</span>
  </span>
</div>`;
}

function getTabs(s) {
  return /*html*/ `
<div class="tabs" role="tablist">
  <button class="tab tab-active" data-tab="ports" role="tab" aria-selected="true">${escape(s.tabPorts)}</button>
  <button class="tab" data-tab="processes" role="tab" aria-selected="false">${escape(s.tabProcesses)}</button>
  <button class="tab" data-tab="containers" role="tab" aria-selected="false">${escape(s.tabContainers)}</button>
  <button class="tab" data-tab="locks" role="tab" aria-selected="false">${escape(s.tabLocks)}</button>
  <button class="tab" data-tab="mcp" role="tab" aria-selected="false">${escape(s.tabTools)}</button>
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

function getMcpPanel(s) {
  return /*html*/ `
<div id="mcpPanel" style="display:none">
  <div class="mcp-master" id="mcpMaster">
    <label class="mcp-master-switch">
      <input type="checkbox" id="mcpEnabledToggle" onchange="mcpToggleEnabled(this.checked)">
      <span class="mcp-master-label">${escape(s.mcpMasterLabel)}</span>
      <span class="mcp-master-state" id="mcpMasterState">${escape(s.mcpStatusRunning)}</span>
    </label>
    <div class="mcp-master-meta">
      <span class="mcp-meta-label">${escape(s.mcpServerVersionLabel)}:</span>
      <span class="mcp-meta-value" id="mcpVersionValue">—</span>
      <span class="mcp-meta-label">${escape(s.mcpConfigPathHint)}:</span>
      <span class="mcp-meta-value" id="mcpConfigPathValue">—</span>
    </div>
    <div class="mcp-master-actions">
      <button class="btn btn-sm" id="mcpSelectAllBtn">${escape(s.mcpSelectAll)}</button>
      <button class="btn btn-sm btn-outline" id="mcpDeselectAllBtn">${escape(s.mcpDeselectAll)}</button>
    </div>
  </div>
  <table id="mcpTable">
    <thead>
      <tr>
        <th style="width:48px">${escape(s._enabledLabel || "On")}</th>
        <th>${escape(s._toolLabel || "Tool")}</th>
        <th style="width:84px">${escape(s._categoryLabel || "Category")}</th>
        <th>${escape(s._flagsLabel || "Flags")}</th>
      </tr>
    </thead>
    <tbody id="mcpTbody"></tbody>
  </table>
  <div class="empty" id="mcpEmpty" style="display:none"></div>
</div>`;
}

function getToolbar(s) {
  const langs = (s._supported || []);
  const currentLang = s._lang || "en";
  const current = langs.find((l) => l.code === currentLang) || langs[0] || { code: "en", label: "English" };
  const langItems = langs.map(l =>
    `<button type="button" class="lang-dropdown-item${l.code === currentLang ? " active" : ""}" data-lang="${escape(l.code)}" onclick="pickLang('${escape(l.code)}')">` +
      '<span class="lang-dot" aria-hidden="true"></span>' +
      '<span class="lang-label">' + escape(l.label) + '</span>' +
      '<span class="lang-check" aria-hidden="true">✓</span>' +
    '</button>'
  ).join("");
  return /*html */ `
<div class="toolbar">
  <input type="text" id="search" placeholder="${escape(s.searchPlaceholder || "Search by port / process name...")}" />
  <button class="btn" onclick="refresh()">${escape(s.refresh)}</button>
  <button class="btn btn-danger" id="bulkKillBtn" style="display:none" onclick="bulkKill()">${escape(s.bulkKill)}</button>
  <div class="lang-dropdown" id="langDropdown">
    <button type="button" class="lang-trigger" id="langTrigger" onclick="toggleLangMenu(event)" title="${escape(s.langMenu || "Language")}" aria-haspopup="listbox" aria-expanded="false">
      <span class="lang-globe" aria-hidden="true">⌖</span>
      <span class="lang-trigger-label">${escape(current.label)}</span>
      <span class="lang-caret" aria-hidden="true">▾</span>
    </button>
    <div class="lang-menu" id="langMenu" role="listbox">
      ${langItems}
    </div>
  </div>
</div>`;
}

function getTable(s) {
  // Shared table across Ports + Processes tabs. Each <th> carries a stable
  // data-col key used by the client to reorder and resize columns
  // (persisted in localStorage). Fixed columns (select, action) are not
  // draggable / resizable.
  const resizeHandle = '<span class="resize-handle" draggable="false" aria-hidden="true"></span>';
  const th = (col, sortKey, tab, label, extra) =>
    `<th data-col="${col}" data-sort="${sortKey}" data-tab="${tab}" draggable="true" onclick="sortBy('${sortKey}')"${extra ? " " + extra : ""}>${label}${resizeHandle}</th>`;
  return /*html*/ `
<table id="mainTable">
  <colgroup id="mainColgroup"></colgroup>
  <thead>
    <tr>
      <th data-col="select" class="col-select" style="width:36px">
        <input type="checkbox" id="selectAll" onchange="toggleAll(this.checked)">
      </th>
      ${th("port",     "port",     "ports",     escape(s.colPort) + ' \u25B2', 'class="sorted"')}
      ${th("state",    "state",    "ports",     escape(s.colState))}
      ${th("process",  "process",  "ports",     escape(s.colProcess))}
      ${th("pid",      "pid",      "ports",     escape(s.colPid))}
      ${th("ancestry", "ancestry", "ports",     escape(s.colAncestry))}
      ${th("port2",    "port",     "processes", escape(s.colPort), 'style="display:none"')}
      ${th("ancestry2","ancestry", "processes", escape(s.colAncestry), 'style="display:none"')}
      ${th("cpu",      "cpu",      "processes", escape(s.colCpu), 'style="display:none"')}
      ${th("memory",   "memory",   "processes", escape(s.colMemory), 'style="display:none"')}
      ${th("cmd",      "cmd",      "processes", escape(s.colCommand), 'style="display:none"')}
      <th data-col="action" style="text-align:right" class="col-action">${escape(s.colAction)}</th>
    </tr>
  </thead>
  <tbody id="tbody"></tbody>
</table>`;
}

function getDetailsPanel(s) {
  return /*html*/ `
<div class="details-panel" id="detailsPanel" style="display:none">
  <div class="details-header">
    <span class="details-header-left">
      <span class="details-title-icon" aria-hidden="true">▶</span>
      <span class="details-title" id="detailsTitle">${escape(s.detailsTitle)}</span>
      <span class="details-title-pid" id="detailsPidBadge" style="display:none"></span>
    </span>
    <button class="details-close" id="detailsCloseBtn" type="button" aria-label="${escape(s.detailsClose)}">×</button>
  </div>
  <div class="details-body" id="detailsBody">
    <div class="details-empty">${escape(s.detailsNoData)}</div>
  </div>
</div>`;
}

module.exports = { getWebviewContent };
