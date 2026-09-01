/**
 * PortPilot - Webview HTML Generator
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
    colAction: "Action",
    stateListen: "LISTEN",
    stateFree: "FREE",
    kill: "KILL",
    confirm: "Confirm",
    cancel: "Cancel",
    langMenu: "🌐 Language",
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
  ${getToolbar(s)}
  ${getScanPanel(s)}
  <div class="stats" id="stats"></div>
  ${getTable(s)}
  <div class="empty" id="empty" style="display:none">${escape(s.empty)}</div>
  <div id="toastContainer"></div>
  <script>${getScript(s)}</script>
</body>
</html>`;
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
  <button class="btn btn-outline" onclick="toggleScan()">${escape(s.rangeScan)}</button>
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
  return /*html*/ `
<table>
  <thead>
    <tr>
      <th style="width:36px">
        <input type="checkbox" id="selectAll" onchange="toggleAll(this.checked)">
      </th>
      <th data-sort="port" onclick="sortBy('port')" class="sorted">${escape(s.colPort)} ▲</th>
      <th data-sort="state" onclick="sortBy('state')">${escape(s.colState)}</th>
      <th data-sort="process" onclick="sortBy('process')">${escape(s.colProcess)}</th>
      <th data-sort="pid" onclick="sortBy('pid')">${escape(s.colPid)}</th>
      <th style="text-align:right">${escape(s.colAction)}</th>
    </tr>
  </thead>
  <tbody id="tbody"></tbody>
</table>`;
}

module.exports = { getWebviewContent };
