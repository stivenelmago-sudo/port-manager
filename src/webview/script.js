/**
 * PortPilot - Webview Client Script
 *
 * Multi-tab UI:
 *   - Ports tab: listening ports with ancestry (existing)
 *   - Processes tab: all running processes (NEW, sourced via witr --json)
 *   - Auto-refresh: 3s adaptive cadence with focus-aware pause (NEW)
 *   - Details panel: ancestry tree + env + cwd + sockets (NEW)
 */

module.exports = function getScript(strings = {}) {
  const s = JSON.stringify({
    statsUsed: strings.statsUsed || "Used",
    statsTotal: strings.statsTotal || "Total",
    colPort: strings.colPort || "Port",
    colState: strings.colState || "State",
    colProcess: strings.colProcess || "Process",
    colPid: strings.colPid || "PID",
    colAncestry: strings.colAncestry || "Ancestry",
    colAction: strings.colAction || "Action",
    stateListen: strings.stateListen || "LISTEN",
    stateFree: strings.stateFree || "FREE",
    kill: strings.kill || "KILL",
    confirm: strings.confirm || "Confirm",
    cancel: strings.cancel || "Cancel",
    empty: strings.empty || "No matching ports",
    emptyProcesses: strings.emptyProcesses || "No processes found",
    toastKilled: strings.toastKilled || "was killed",
    toastKillFailed: strings.toastKillFailed || "Kill failed",
    toastScan: strings.toastScan || "Used / Free",
    bulkKill: strings.bulkKill || "KILL Selected",
    refresh: strings.refresh || "Refresh",
    rangeScan: strings.rangeScan || "Range Scan",
    ancestryNone: strings.ancestryNone || "—",
    ancestryLoading: strings.ancestryLoading || "loading…",
    witrMissing: strings.witrMissing || "Process ancestry unavailable",
    witrPermission: strings.witrPermission || "Run VS Code as Admin/sudo for full ancestry",
    statsAncestry: strings.statsAncestry || "with ancestry",
    tabPorts: strings.tabPorts || "Ports",
    tabProcesses: strings.tabProcesses || "Processes",
    autoRefreshOn: strings.autoRefreshOn || "Auto-refresh ON",
    autoRefreshOff: strings.autoRefreshOff || "Auto-refresh OFF",
    detailsTitle: strings.detailsTitle || "Process Details",
    detailsAncestry: strings.detailsAncestry || "Ancestry",
    detailsCwd: strings.detailsCwd || "Working Dir",
    detailsEnv: strings.detailsEnv || "Environment",
    detailsSockets: strings.detailsSockets || "Sockets",
    detailsSource: strings.detailsSource || "Source",
    detailsStarted: strings.detailsStarted || "Started",
    detailsCommand: strings.detailsCommand || "Command",
    detailsUser: strings.detailsUser || "User",
    detailsNoData: strings.detailsNoData || "Select a process to view details",
    detailsLoading: strings.detailsLoading || "Loading process details…",
    detailsNotAvailable: strings.detailsNotAvailable || "Process details not available",
    colCpu: strings.colCpu || "CPU",
    colMemory: strings.colMemory || "Memory",
    colCommand: strings.colCommand || "Command",
  });

  return /*javascript*/ `
  const vscode = acquireVsCodeApi();
  const T = ${s};

  // ─── State ────────────────────────────────────────────────────────
  let ports = [];
  let processes = [];
  let selected = new Set();
  let currentSort = { col: "port", dir: "asc" };
  let currentTab = "ports";
  let filter = "";
  let confirmingKill = null;
  let detailsPid = null;

  // Auto-refresh state.
  const REFRESH_BASE_MS = 3000;
  const REFRESH_MAX_MS = 30000;
  let refreshTimer = null;
  let lastRefreshMs = 0;
  let autoRefreshEnabled = true;

  const elements = {
    tbody: () => document.getElementById("tbody"),
    stats: () => document.getElementById("stats"),
    empty: () => document.getElementById("empty"),
    search: () => document.getElementById("search"),
    scanPanel: () => document.getElementById("scanPanel"),
    bulkKillBtn: () => document.getElementById("bulkKillBtn"),
    toastContainer: () => document.getElementById("toastContainer"),
    selectAll: () => document.getElementById("selectAll"),
    autoRefreshToggle: () => document.getElementById("autoRefreshToggle"),
    autoRefreshLabel: () => document.getElementById("autoRefreshLabel"),
    detailsPanel: () => document.getElementById("detailsPanel"),
    detailsBody: () => document.getElementById("detailsBody"),
    mainTable: () => document.getElementById("mainTable"),
  };

  // ─── Message handler ─────────────────────────────────────────────
  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "ports":
        ports = msg.ports || [];
        if (currentTab === "ports") render();
        if (msg.witr && msg.witr.status && msg.witr.status !== "available" && msg.witr.hint) {
          showOnce(msg.witr.status, T.witrMissing + " — " + msg.witr.hint);
        }
        scheduleNextRefresh();
        break;
      case "processes":
        processes = msg.processes || [];
        if (currentTab === "processes") render();
        scheduleNextRefresh();
        break;
      case "processDetails":
        renderDetails(msg.pid, ok ? null : msg.data, msg.error);
        break;
      case "killed":
        showToast(":" + msg.port + " " + T.toastKilled, "success");
        confirmingKill = null;
        if (typeof msg.port === "number") selected.delete(msg.port);
        vscode.postMessage({ command: "refresh" });
        break;
      case "killError":
        showToast(T.toastKillFailed + ": " + msg.error, "error");
        confirmingKill = null;
        render();
        break;
      case "scanResult":
        showToast(T.toastScan.replace("{used}", msg.used).replace("{free}", msg.free), "success");
        break;
    }
  });

  // ─── Tabs ────────────────────────────────────────────────────────
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  function switchTab(tab) {
    if (tab === currentTab) return;
    currentTab = tab;
    selected = new Set();
    confirmingKill = null;
    closeDetails();
    document.querySelectorAll(".tab").forEach((b) => {
      const active = b.dataset.tab === tab;
      b.classList.toggle("tab-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    // Show/hide column headers by tab
    document.querySelectorAll("th[data-tab]").forEach((th) => {
      th.style.display = th.dataset.tab === tab ? "" : "none";
    });
    // Reset sort per tab
    currentSort = { col: tab === "ports" ? "port" : "pid", dir: "asc" };
    filter = "";
    elements.search().value = "";
    if (tab === "ports") {
      vscode.postMessage({ command: "refresh" });
    } else if (tab === "processes") {
      vscode.postMessage({ command: "refreshProcesses" });
    }
    render();
  }

  // ─── Auto-refresh ────────────────────────────────────────────────
  elements.autoRefreshToggle().addEventListener("click", () => {
    autoRefreshEnabled = !autoRefreshEnabled;
    updateAutoRefreshUi();
    if (autoRefreshEnabled) scheduleNextRefresh(0);
    else if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  });

  function updateAutoRefreshUi() {
    elements.autoRefreshLabel().textContent = autoRefreshEnabled ? T.autoRefreshOn : T.autoRefreshOff;
    elements.autoRefreshToggle().classList.toggle("auto-off", !autoRefreshEnabled);
  }

  function scheduleNextRefresh(delayMs) {
    if (!autoRefreshEnabled) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    if (document.hidden) { refreshTimer = null; return; }
    const ms = (typeof delayMs === "number")
      ? delayMs
      : Math.min(REFRESH_MAX_MS, Math.max(REFRESH_BASE_MS, lastRefreshMs * 4));
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (!autoRefreshEnabled || document.hidden) return;
      if (currentTab === "ports") vscode.postMessage({ command: "refresh" });
      else if (currentTab === "processes") vscode.postMessage({ command: "refreshProcesses" });
    }, ms);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleNextRefresh(0);
    else if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  });

  const shownHints = new Set();
  function showOnce(key, message) {
    if (shownHints.has(key)) return;
    shownHints.add(key);
    showToast(message, "warn");
  }

  // ─── Render ──────────────────────────────────────────────────────
  function render() {
    const list = filterAndSort();
    renderStats();
    renderTable(list);
    updateBulkKillButton();
    updateSortIndicators();
    // If a details panel was open, refresh its content
    if (detailsPid && currentTab !== "ports") renderDetails(detailsPid, null, null);
  }

  function filterAndSort() {
    const src = currentTab === "ports" ? ports : processes;
    const isPort = currentTab === "ports";

    let list = src.filter((p) => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      const ancestryText = (p.witr && p.witr.chain) ? p.witr.chain : "";
      const haystack = isPort
        ? [String(p.port), p.process || "", ancestryText].join(" ").toLowerCase()
        : [String(p.pid), p.name || p.process || "", p.command || "", p.source || ""].join(" ").toLowerCase();
      return haystack.includes(f);
    });

    list.sort((a, b) => {
      let cmp = 0;
      const col = currentSort.col;
      if (col === "port") cmp = (a.port || 0) - (b.port || 0);
      else if (col === "state") cmp = (a.state || "").localeCompare(b.state || "");
      else if (col === "process") cmp = (a.process || a.name || "").localeCompare(b.process || b.name || "");
      else if (col === "pid") cmp = (a.pid || 0) - (b.pid || 0);
      else if (col === "ancestry") {
        const ax = (a.witr && a.witr.chain) || "";
        const bx = (b.witr && b.witr.chain) || "";
        cmp = ax.localeCompare(bx);
      }
      else if (col === "cpu") cmp = (a.cpu || 0) - (b.cpu || 0);
      else if (col === "memory") cmp = (a.memory || 0) - (b.memory || 0);
      else if (col === "cmd") cmp = (a.command || "").localeCompare(b.command || "");
      return currentSort.dir === "asc" ? cmp : -cmp;
    });

    return list;
  }

  function renderStats() {
    if (currentTab === "ports") {
      const listenCount = ports.filter((p) => p.state === "LISTEN").length;
      const total = ports.length;
      const withAncestry = ports.filter((p) => p.witr && p.witr.chain).length;
      const ancestrySpan = withAncestry > 0
        ? '<span title="' + withAncestry + ' port(s) with ancestry" class="stat-ancestry">🔗 ' + withAncestry + " " + T.statsAncestry + "</span>"
        : "";
      elements.stats().innerHTML =
        '<span><span class="dot" style="background:#FF5252"></span> ' + T.statsUsed + " " + listenCount + "</span>" +
        ancestrySpan +
        "<span>" + T.statsTotal + " " + total + "</span>";
    } else {
      const total = processes.length;
      elements.stats().innerHTML =
        "<span>" + T.tabProcesses + "</span>" +
        "<span>" + T.statsTotal + " " + total + "</span>";
    }
  }

  function renderTable(list) {
    const tbody = elements.tbody();
    if (list.length === 0) {
      tbody.innerHTML = "";
      elements.empty().textContent = currentTab === "ports" ? T.empty : T.emptyProcesses;
      elements.empty().style.display = "block";
      return;
    }
    elements.empty().style.display = "none";
    tbody.innerHTML = list.map(renderRow).join("");
  }

  function renderRow(p) {
    const isPort = currentTab === "ports";
    const port = p.port || p.pid;
    const isSelected = selected.has(port);
    const isConfirming = confirmingKill === port;

    let cells = "";
    if (isPort) {
      const isListen = p.state === "LISTEN";
      const badgeClass = isListen ? "badge-listen" : "badge-free";
      const badgeText = isListen ? T.stateListen : T.stateFree;
      const ancestryHtml = renderAncestry(p);
      cells =
        '<td class="port-num">:' + p.port + "</td>" +
        '<td><span class="badge ' + badgeClass + '">' + badgeText + "</span></td>" +
        '<td class="process-name">' + escapeHtml(p.process || "-") + "</td>" +
        '<td class="pid">' + (p.pid || "-") + "</td>" +
        '<td class="ancestry">' + ancestryHtml + "</td>";
    } else {
      const cpu = p.cpu != null ? (p.cpu.toFixed(1) + "%") : "-";
      const mem = formatMemory(p.memory);
      cells =
        '<td class="process-name">' + escapeHtml(p.name || p.process || "-") + "</td>" +
        '<td class="pid">' + (p.pid || "-") + "</td>" +
        '<td class="cpu">' + cpu + "</td>" +
        '<td class="memory">' + mem + "</td>" +
        '<td class="command" title="' + escapeHtml(p.command || "") + '">' + escapeHtml(truncate(p.command || "", 60)) + "</td>";
    }

    const actionHtml = renderActionButtons(p, isConfirming);

    return (
      '<tr class="' + (isSelected ? "selected" : "") + '" onclick="rowClicked(' + port + ', event)">' +
      '<td class="col-select"><input type="checkbox" ' + (isSelected ? "checked" : "") +
      ' onchange="togglePort(' + port + ')"></td>' +
      cells +
      '<td class="col-action" style="text-align:right">' + actionHtml + "</td>" +
      "</tr>"
    );
  }

  function renderAncestry(p) {
    if (!p.witr || !p.witr.chain) {
      return '<span class="ancestry-none">' + escapeHtml(T.ancestryNone) + "</span>";
    }
    const chain = p.witr.chain;
    const supervisor = p.witr.supervisor || "";
    const title = supervisor ? 'title="' + escapeHtml(supervisor) + '"' : "";
    return (
      '<span class="ancestry-chain" ' + title + ">" +
      '<span class="ancestry-sup">' + escapeHtml(supervisor || chain.split("→")[0].trim()) + "</span>" +
      '<span class="ancestry-sep"> → </span>' +
      '<span class="ancestry-leaf">' + escapeHtml(p.witr.leafName || chain.split("→").pop().trim()) + "</span>" +
      "</span>"
    );
  }

  function renderActionButtons(p, isConfirming) {
    const port = p.port || p.pid;
    if (isConfirming) {
      return (
        '<span class="confirm-group">' +
        '<button class="btn btn-sm btn-danger" onclick="confirmKill(' + port + "," + p.pid + ')">' + T.confirm + '</button>' +
        '<button class="btn btn-sm btn-outline" onclick="cancelKill()">' + T.cancel + '</button>' +
        "</span>"
      );
    }
    return '<button class="kill-btn" onclick="startKill(' + port + ')">' + T.kill + '</button>';
  }

  function updateBulkKillButton() {
    const activeSelected = [...selected].filter((p) => {
      const src = currentTab === "ports" ? ports : processes;
      return src.find((pp) => (pp.port || pp.pid) === p);
    });
    const btn = elements.bulkKillBtn();
    btn.style.display = activeSelected.length > 0 ? "inline-block" : "none";
    btn.textContent = T.bulkKill + " (" + activeSelected.length + ")";
  }

  function updateSortIndicators() {
    const labels = {
      port: T.colPort, state: T.colState, process: T.colProcess,
      pid: T.colPid, ancestry: T.colAncestry, cpu: T.colCpu,
      memory: T.colMemory, cmd: T.colCommand,
    };
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      if (th.style.display === "none") { th.textContent = labels[th.dataset.sort] || ""; return; }
      const col = th.dataset.sort;
      th.classList.toggle("sorted", col === currentSort.col);
      th.textContent = (labels[col] || th.textContent) + (col === currentSort.col ? (currentSort.dir === "asc" ? " ▲" : " ▼") : "");
    });
  }

  // ─── Process Details panel ──────────────────────────────────────
  function rowClicked(port, evt) {
    // Ignore clicks on inputs/buttons — those have their own handlers.
    if (evt && evt.target && (evt.target.tagName === "BUTTON" || evt.target.tagName === "INPUT")) return;
    const pid = port; // In our model, rowClicked receives (port_or_pid, evt)
    openDetails(pid);
  }

  function openDetails(pid) {
    detailsPid = pid;
    elements.detailsPanel().style.display = "flex";
    elements.detailsBody().innerHTML =
      '<div class="details-loading">' + escapeHtml(T.detailsLoading) + "</div>";
    vscode.postMessage({ command: "getProcessDetails", pid });
  }

  function closeDetails() {
    detailsPid = null;
    elements.detailsPanel().style.display = "none";
  }

  function renderDetails(pid, data, error) {
    if (pid !== detailsPid) return;
    if (error || !data) {
      elements.detailsBody().innerHTML =
        '<div class="details-empty">' + escapeHtml(T.detailsNotAvailable) + (error ? " (" + escapeHtml(error) + ")" : "") + "</div>";
      return;
    }
    const ancestryHtml = renderAncestryTree(data.ancestry || []);
    const envHtml = renderEnvTable(data.environment || {});
    const socketsHtml = renderSocketsList(data.sockets || []);
    const html =
      '<div class="details-grid">' +
        '<div class="details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsAncestry) + "</div>" +
          ancestryHtml +
        "</div>" +
        '<div class="details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsCommand) + "</div>" +
          '<div class="details-code">' + escapeHtml(data.process || data.command || "-") + "</div>" +
        "</div>" +
        '<div class="details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsUser) + "</div>" +
          '<div>' + escapeHtml(data.user || "-") + "</div>" +
        "</div>" +
        '<div class="details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsStarted) + "</div>" +
          '<div>' + escapeHtml(data.started || data.start_time || "-") + "</div>" +
        "</div>" +
        '<div class="details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsSource) + "</div>" +
          '<div>' + escapeHtml(data.source || "-") + "</div>" +
        "</div>" +
        '<div class="details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsCwd) + "</div>" +
          '<div class="details-code">' + escapeHtml(data.cwd || data.working_dir || "-") + "</div>" +
        "</div>" +
        '<div class="details-section details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.detailsSockets) + "</div>" +
          socketsHtml +
        "</div>" +
        '<div class="details-section details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.detailsEnv) + "</div>" +
          envHtml +
        "</div>" +
      "</div>";
    elements.detailsBody().innerHTML = html;
  }

  function renderAncestryTree(ancestry) {
    if (!ancestry || ancestry.length === 0) return '<div class="ancestry-none">' + escapeHtml(T.ancestryNone) + "</div>";
    return '<ul class="tree">' + ancestry.map((node, i) => {
      const name = node.name || node;
      const pid = node.pid || "";
      return '<li><span class="tree-node">' +
        '<span class="tree-name">' + escapeHtml(name) + '</span>' +
        (pid ? '<span class="tree-pid">pid ' + pid + "</span>" : "") +
        "</span></li>";
    }).join("") + "</ul>";
  }

  function renderEnvTable(env) {
    const keys = Object.keys(env || {});
    if (keys.length === 0) return '<div class="ancestry-none">-</div>';
    let html = '<table class="env-table"><tbody>';
    for (const k of keys) {
      const v = String(env[k]);
      const display = v.length > 200 ? v.substring(0, 200) + "…" : v;
      html += '<tr><td class="env-key">' + escapeHtml(k) + '</td><td class="env-val">' + escapeHtml(display) + "</td></tr>";
    }
    html += "</tbody></table>";
    return html;
  }

  function renderSocketsList(sockets) {
    if (!sockets || sockets.length === 0) return '<div class="ancestry-none">-</div>';
    return '<ul class="sockets">' + sockets.map((s) => {
      const addr = s.address || s.bind || s.local || JSON.stringify(s);
      const state = s.state || "";
      return '<li>' + escapeHtml(addr) + (state ? ' <span class="socket-state">' + escapeHtml(state) + "</span>" : "") + "</li>";
    }).join("") + "</ul>";
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function truncate(s, n) { return s.length > n ? s.substring(0, n - 1) + "…" : s; }

  function formatMemory(bytes) {
    if (bytes == null) return "-";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(1) + "G";
    if (mb >= 1) return mb.toFixed(0) + "M";
    return (bytes / 1024).toFixed(0) + "K";
  }

  // ─── Event handlers ──────────────────────────────────────────────
  elements.search().addEventListener("input", (e) => { filter = e.target.value; render(); });

  function refresh() { vscode.postMessage({ command: "refresh" }); }

  function sortBy(col) {
    if (currentSort.col === col) currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
    else currentSort = { col, dir: "asc" };
    render();
  }

  function togglePort(port) {
    if (selected.has(port)) selected.delete(port);
    else selected.add(port);
    render();
  }

  function toggleAll(checked) {
    const src = currentTab === "ports" ? ports : processes;
    if (checked) src.forEach((p) => selected.add(p.port || p.pid));
    else selected.clear();
    render();
  }

  function startKill(port) { confirmingKill = port; render(); }
  function cancelKill() { confirmingKill = null; render(); }
  function confirmKill(port, pid) { vscode.postMessage({ command: "kill", port, pid }); }

  function bulkKill() {
    const targets = [...selected].filter((p) => {
      const src = currentTab === "ports" ? ports : processes;
      return src.find((pp) => (pp.port || pp.pid) === p);
    });
    if (targets.length === 0) return;
    vscode.postMessage({ command: "bulkKill", ports: targets });
    selected.clear();
  }

  function toggleScan() {
    const panel = elements.scanPanel();
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  }

  function scanRange() {
    const from = parseInt(elements.scanFrom().value) || 3000;
    const to = parseInt(elements.scanTo().value) || 9999;
    vscode.postMessage({ command: "scan", from, to });
  }

  function changeLang(lang) { if (lang) vscode.postMessage({ command: "setLanguage", lang }); }

  function showToast(msg, type) {
    const container = elements.toastContainer();
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ─── Init ────────────────────────────────────────────────────────
  vscode.postMessage({ command: "refresh" });
  scheduleNextRefresh(0);
`;
};
