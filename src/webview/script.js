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
    actionCopy: strings.actionCopy || "Copy",
    copied: strings.copied || "Copied",
    copyPort: strings.copyPort || "Copy port",
    copyPid: strings.copyPid || "Copy PID",
    copyCommand: strings.copyCommand || "Copy command",
    copyPath: strings.copyPath || "Copy path",
    openInBrowser: strings.openInBrowser || "Open in browser",
    actionOpen: strings.actionOpen || "Open",
    detailsClose: strings.detailsClose || "Close",
    containerImage: strings.containerImage || "Image",
    containerState: strings.containerState || "State",
    containerCommand: strings.containerCommand || "Command",
    containerMounts: strings.containerMounts || "Mounts",
    containerNetworks: strings.containerNetworks || "Networks",
    containerEnv: strings.containerEnv || "Env (first 30)",
    scanResult: strings.scanResult || "Used / Free",
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
    detailsTitleContainer: strings.detailsTitleContainer || "Container Details",
    detailsTitleLock: strings.detailsTitleLock || "File Lock Details",
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
    tabContainers: strings.tabContainers || "Containers",
    emptyContainers: strings.emptyContainers || "No containers found",
    colRuntime: strings.colRuntime || "Runtime",
    colImage: strings.colImage || "Image",
    colStatus: strings.colStatus || "Status",
    colAction2: strings.colAction2 || "Actions",
    actionStop: strings.actionStop || "Stop",
    actionRestart: strings.actionRestart || "Restart",
    actionStart: strings.actionStart || "Start",
    actionPause: strings.actionPause || "Pause",
    actionLogs: strings.actionLogs || "Logs",
    actionInspect: strings.actionInspect || "Inspect",
    tabLocks: strings.tabLocks || "Locks",
    emptyLocks: strings.emptyLocks || "No file locks found",
    colFd: strings.colFd || "FD",
    colPath: strings.colPath || "Path",
    colInode: strings.colInode || "Inode",
    locksAllOpen: strings.locksAllOpen || "Show all open files",
    actionTerminate: strings.actionTerminate || "Terminate",
    actionResume: strings.actionResume || "Resume",
    actionRenice: strings.actionRenice || "Renice",
    niceValue: strings.niceValue || "Nice value (-20 to 19)",
  });

  return /*javascript*/ `
  const vscode = acquireVsCodeApi();
  const T = ${s};

  // Interpolate a localised template string (i18n function values are baked
  // into "{n}" placeholders at the host side; this helper substitutes the
  // runtime values left-to-right). For 0-arg templates the value is already
  // a finished string and the call is a no-op.
  function tpl(s, ...args) {
    if (typeof s !== "string") return String(s == null ? "" : s);
    let i = 0;
    return s.replace(/\{n(?:(\d+))?\}/g, (m, k) => {
      const idx = k ? parseInt(k, 10) - 1 : i++;
      return args[idx] != null ? String(args[idx]) : m;
    });
  }

  // ─── State ────────────────────────────────────────────────────────
  let ports = [];
  let processes = [];
  let containers = [];
  let containerRuntimes = [];
  let locks = [];
  let selected = new Set();
  let currentSort = { col: "port", dir: "asc" };
  let currentTab = "ports";
  let filter = "";
  let confirmingKill = null;
  let detailsPid = null;
  let detailsKind = "process";
  let detailsRuntime = null;
  let detailsLastData = null;
  let locksShowAllOpen = false;

  // Default column order per tab (matches the static header layout in
  // getTable). The user can drag <th> elements to reorder and drag the right
  // edge of a <th> to resize; the resulting order + widths are persisted in
  // localStorage so they survive webview reloads.
  const DEFAULT_COLUMNS = {
    ports:     ["port", "state", "process", "pid", "ancestry"],
    processes: ["process", "pid", "port2", "ancestry2", "cpu", "memory", "cmd"],
  };
  const COLUMN_LAYOUT_KEY = "portpilot.columnLayout.v1";
  const COLUMN_WIDTHS_KEY = "portpilot.columnWidths.v1";
  let columnLayout = loadColumnLayout();
  let columnWidths = loadColumnWidths();
  let lastResizeAt = 0;

  function loadColumnLayout() {
    try {
      const raw = JSON.parse(localStorage.getItem(COLUMN_LAYOUT_KEY) || "null");
      if (!raw || typeof raw !== "object") return cloneDefaults();
      return {
        ports: Array.isArray(raw.ports) && raw.ports.length ? raw.ports.slice() : cloneDefaults().ports,
        processes: Array.isArray(raw.processes) && raw.processes.length ? raw.processes.slice() : cloneDefaults().processes,
      };
    } catch {
      return cloneDefaults();
    }
  }
  function cloneDefaults() {
    return {
      ports: DEFAULT_COLUMNS.ports.slice(),
      processes: DEFAULT_COLUMNS.processes.slice(),
    };
  }
  function saveColumnLayout() {
    try { localStorage.setItem(COLUMN_LAYOUT_KEY, JSON.stringify(columnLayout)); } catch {}
  }
  function loadColumnWidths() {
    try {
      const raw = JSON.parse(localStorage.getItem(COLUMN_WIDTHS_KEY) || "null");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }
  function saveColumnWidths() {
    try { localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths)); } catch {}
  }

  // Auto-refresh state.
  const REFRESH_BASE_MS = 3000;
  const REFRESH_MAX_MS = 30000;
  let refreshTimer = null;
  let lastRefreshMs = 0;
  let autoRefreshEnabled = true;

  const elements = {
    tbody: () => document.getElementById("tbody"),
    stats: () => document.getElementById("stats"),
    detailsTitle: () => document.querySelector("#detailsPanel .details-title"),
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
        if (msg.witr && msg.witr.status && msg.witr.status !== "available" && msg.witr.hint) {
          showOnce(msg.witr.status, T.witrMissing + " — " + msg.witr.hint);
        }
        scheduleNextRefresh();
        break;
      case "containers":
        containers = msg.containers || [];
        containerRuntimes = msg.runtimes || [];
        if (currentTab === "containers") renderContainers();
        scheduleNextRefresh();
        break;
      case "containerDetails":
        renderContainerDetails(msg.runtime, msg.id, msg.data, msg.error);
        break;
      case "containerOutput":
        renderContainerOutput(msg.runtime, msg.id, msg.action, msg.output);
        break;
      case "locks":
        locks = msg.locks || [];
        if (currentTab === "locks") renderLocks();
        scheduleNextRefresh();
        break;
      case "processDetails":
        renderDetails(msg.pid, msg.data, msg.error);
        break;
      case "processActionResult":
        if (msg.ok) showToast(msg.action + " → pid " + msg.pid + ": OK", "success");
        else showToast(msg.action + " → pid " + msg.pid + ": " + msg.error, "error");
        break;
      case "killed":
        showToast(tpl(T.toastKilled, msg.port), "success");
        confirmingKill = null;
        selected.clear();
        if (currentTab === "ports") vscode.postMessage({ command: "refresh" });
        else if (currentTab === "processes") vscode.postMessage({ command: "refreshProcesses" });
        else if (currentTab === "containers") vscode.postMessage({ command: "refreshContainers" });
        else if (currentTab === "locks") vscode.postMessage({ command: "refreshLocks" });
        render();
        break;
      case "killError":
        showToast(tpl(T.toastKillFailed, msg.error), "error");
        confirmingKill = null;
        render();
        break;
      case "scanResult":
        showToast(T.scanResult + " " + msg.used + "/" + msg.free, "success");
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
    // Toggle main table vs side panels.
    elements.mainTable().style.display = tab === "ports" || tab === "processes" ? "" : "none";
    // Show / hide per-tab columns in the shared table.
    document.querySelectorAll("#mainTable thead th[data-tab]").forEach((th) => {
      th.style.display = th.dataset.tab === tab ? "" : "none";
    });
    const containersPanel = document.getElementById("containersPanel");
    const locksPanel = document.getElementById("locksPanel");
    if (containersPanel) containersPanel.style.display = tab === "containers" ? "block" : "none";
    if (locksPanel) locksPanel.style.display = tab === "locks" ? "block" : "none";
    elements.scanPanel().style.display = "none";
    elements.bulkKillBtn().style.display = "none";

    // Reset sort per tab
    if (tab === "ports") currentSort = { col: "port", dir: "asc" };
    else if (tab === "processes") currentSort = { col: "pid", dir: "asc" };
    else if (tab === "containers") currentSort = { col: "name", dir: "asc" };
    else if (tab === "locks") currentSort = { col: "pid", dir: "asc" };

    filter = "";
    elements.search().value = "";

    if (tab === "ports") {
      vscode.postMessage({ command: "refresh" });
      render();
    } else if (tab === "processes") {
      vscode.postMessage({ command: "refreshProcesses" });
      render();
    } else if (tab === "containers") {
      vscode.postMessage({ command: "refreshContainers" });
      renderContainers();
    } else if (tab === "locks") {
      vscode.postMessage({ command: "refreshLocks" });
      renderLocks();
    }
  }

  function renderContainers() {
    const list = filterAndSortContainers();
    const tbody = document.getElementById("containersTbody");
    const empty = document.getElementById("containersEmpty");
    if (!tbody) return;
    if (list.length === 0) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";
    tbody.innerHTML = list.map(renderContainerRow).join("");
  }

  function filterAndSortContainers() {
    let list = containers.filter((c) => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      return [c.name, c.image, c.runtime, c.status, c.state].join(" ").toLowerCase().includes(f);
    });
    list.sort((a, b) => {
      let cmp = 0;
      const col = currentSort.col;
      if (col === "runtime") cmp = a.runtime.localeCompare(b.runtime);
      else if (col === "name") cmp = a.name.localeCompare(b.name);
      else if (col === "image") cmp = a.image.localeCompare(b.image);
      else if (col === "state") cmp = a.state.localeCompare(b.state);
      else if (col === "status") cmp = a.status.localeCompare(b.status);
      return currentSort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }

  function renderContainerRow(c) {
    const stateClass = c.state.toLowerCase().includes("run") ? "badge-listen"
      : c.state.toLowerCase().includes("exit") ? "badge-free"
      : "badge-paused";
    const actions =
      '<span class="confirm-group">' +
        '<button class="btn btn-sm btn-danger" onclick="containerAction(\\'' + escapeHtml(c.runtime) + '\\',\\'' + escapeHtml(c.id) + '\\',\\'stop\\')">' + T.actionStop + '</button>' +
        '<button class="btn btn-sm" onclick="containerAction(\\'' + escapeHtml(c.runtime) + '\\',\\'' + escapeHtml(c.id) + '\\',\\'restart\\')">' + T.actionRestart + '</button>' +
        '<button class="btn btn-sm btn-outline" onclick="containerAction(\\'' + escapeHtml(c.runtime) + '\\',\\'' + escapeHtml(c.id) + '\\',\\'logs\\')">' + T.actionLogs + '</button>' +
        '<button class="btn btn-sm btn-outline" onclick="containerAction(\\'' + escapeHtml(c.runtime) + '\\',\\'' + escapeHtml(c.id) + '\\',\\'inspect\\')">' + T.actionInspect + '</button>' +
      '</span>';
    return (
      '<tr onclick="rowClicked(\\'' + escapeHtml(c.id) + '\\', event)">' +
        '<td><span class="badge badge-runtime">' + escapeHtml(c.runtime) + '</span></td>' +
        '<td>' + escapeHtml(c.name) + '</td>' +
        '<td class="command" title="' + escapeHtml(c.image) + '">' + escapeHtml(c.image) + '</td>' +
        '<td><span class="badge ' + stateClass + '">' + escapeHtml(c.state) + '</span></td>' +
        '<td>' + escapeHtml(c.status) + '</td>' +
        '<td style="text-align:right">' + actions + '</td>' +
      '</tr>'
    );
  }

  function renderLocks() {
    const list = locks.filter((l) => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      return [l.path, l.pid, l.fd, l.type].join(" ").toLowerCase().includes(f);
    });
    renderStats();
    list.sort((a, b) => {
      let cmp = 0;
      const col = currentSort.col;
      if (col === "type") cmp = (a.type || "").localeCompare(b.type || "");
      else if (col === "pid") cmp = (a.pid || 0) - (b.pid || 0);
      else if (col === "fd") cmp = (a.fd || "").localeCompare(b.fd || "");
      else if (col === "path") cmp = (a.path || "").localeCompare(b.path || "");
      else if (col === "inode") cmp = (a.inode || 0) - (b.inode || 0);
      return currentSort.dir === "asc" ? cmp : -cmp;
    });

    const tbody = document.getElementById("locksTbody");
    const empty = document.getElementById("locksEmpty");
    if (!tbody) return;
    if (list.length === 0) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";
    tbody.innerHTML = list.map(renderLockRow).join("");
  }

  function renderLockRow(l) {
    const type = (l.type || "-").toUpperCase();
    const typeClass = "lock-type-" + type.toLowerCase().replace(/[^a-z]/g, "");
    const rw = (l.rw || "").toUpperCase();
    const rwClass = rw === "WRITE" ? "lock-rw-write"
                  : rw === "READ" ? "lock-rw-read"
                  : rw === "UNLCK" ? "lock-rw-unlck"
                  : "lock-rw-none";
    const path = l.path || "";
    const pathDisplay = path && path !== "-" ? truncate(path, 70) : "-";
    const pidAttr = l.pid || 0;
    const pidDisplay = l.pid ? '<button type="button" class="lock-pid-btn" onclick="showLockDetails(' + pidAttr + ', event)" title="' + escapeHtml(T.copyPid) + '">' + l.pid + "</button>" : "-";
    const fdDisplay = l.fd != null
      ? '<span class="lock-fd">fd ' + escapeHtml(String(l.fd)) + "</span>"
      : '<span class="lock-missing">-</span>';
    const inodeDisplay = l.inode != null
      ? '<span class="lock-inode">' + escapeHtml(String(l.inode)) + "</span>"
      : '<span class="lock-missing">-</span>';
    const mode = l.mode || "";
    return (
      '<tr data-lock-row data-pid="' + pidAttr + '" data-path="' + escapeHtmlAttr(path) + '">' +
        '<td class="lock-cell-type">' +
          '<span class="badge ' + typeClass + '">' + escapeHtml(type) + "</span>" +
          (mode ? '<span class="lock-mode">' + escapeHtml(mode) + "</span>" : "") +
        "</td>" +
        '<td>' + pidDisplay + "</td>" +
        '<td>' + fdDisplay + "</td>" +
        '<td class="lock-cell-path">' +
          (rw ? '<span class="badge ' + rwClass + '">' + escapeHtml(rw) + "</span>" : "") +
          '<span class="lock-path" title="' + escapeHtml(path) + '">' + escapeHtml(pathDisplay) + "</span>" +
        "</td>" +
        '<td>' + inodeDisplay + "</td>" +
      "</tr>"
    );
  }

  // Lock row click → open the owning process's details panel.
  function showLockDetails(pid, evt) {
    if (evt) evt.stopPropagation();
    if (pid) openDetails(pid, "process");
  }

  // Minimal JS-string escaper for embedding into inline onclick attributes.
  function escapeHtmlAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function containerAction(runtime, id, action) {
    vscode.postMessage({ command: "containerAction", runtime, id, action });
  }

  function renderContainerDetails(runtime, id, data, error) {
    openDetails(id, "container");
    detailsRuntime = runtime;
    if (error || !data) {
      if (detailsLastData) return;
      elements.detailsBody().innerHTML =
        '<div class="details-empty">' + escapeHtml(T.detailsNotAvailable) + (error ? " (" + escapeHtml(error) + ")" : "") + "</div>";
      return;
    }
    detailsLastData = data;
    elements.detailsBody().innerHTML = renderContainerDetailsBody(data);
  }

  function renderContainerDetailsFromCache(runtime, id, data) {
    if (id !== detailsPid) return;
    if (!data) return;
    elements.detailsBody().innerHTML = renderContainerDetailsBody(data);
  }

  function renderContainerDetailsBody(data) {
    const mounts = (data.Mounts || []).map((m) => m.Source + " → " + (m.Destination || m.Target || "?")).join("<br>");
    const networks = Object.keys(data.NetworkSettings?.Networks || {}).join(", ");
    const env = Object.entries(data.Config?.Env || []).slice(0, 30).map(([k, v]) =>
      '<tr><td class="env-key">' + escapeHtml(k) + '</td><td class="env-val">' + escapeHtml(v) + "</td></tr>"
    ).join("");
    return '<div class="details-grid">' +
        '<div class="details-card details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.containerImage) + '</div>' +
          '<div class="details-code">' + escapeHtml(data.Config?.Image || "-") + "</div>" +
        "</div>" +
        '<div class="details-card details-section">' +
          '<div class="details-label">' + escapeHtml(T.containerState) + '</div>' +
          '<div class="details-value">' + escapeHtml(data.State?.Status || "-") + "</div>" +
        "</div>" +
        '<div class="details-card details-section">' +
          '<div class="details-label">' + escapeHtml(T.containerCommand) + '</div>' +
          '<div class="details-code">' + escapeHtml(JSON.stringify(data.Config?.Cmd || [])) + "</div>" +
        "</div>" +
        '<div class="details-card details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.containerMounts) + '</div>' +
          '<div class="details-code">' + (mounts || "-") + "</div>" +
        "</div>" +
        '<div class="details-card details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.containerNetworks) + '</div>' +
          '<div class="details-value">' + escapeHtml(networks || "-") + "</div>" +
        "</div>" +
        '<div class="details-card details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.containerEnv) + '</div>' +
          '<table class="env-table"><tbody>' + env + "</tbody></table>" +
        "</div>" +
      "</div>";
  }

  function renderContainerOutput(runtime, id, action, output) {
    openDetails(id, "container");
    elements.detailsBody().innerHTML =
      '<div class="details-section details-section-wide">' +
        '<div class="details-label">' + escapeHtml(action) + ' output for ' + escapeHtml(id) + '</div>' +
        '<pre class="details-code">' + escapeHtml(output || "(empty)") + '</pre>' +
      '</div>';
  }

  function processAction(pid, action, nice) {
    vscode.postMessage({ command: "processAction", pid, action, nice: nice ? parseInt(nice, 10) : null });
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
    const toggle = elements.autoRefreshToggle();
    toggle.classList.toggle("auto-off", !autoRefreshEnabled);
    toggle.title = autoRefreshEnabled ? T.autoRefreshOn : T.autoRefreshOff;
    toggle.setAttribute("aria-pressed", autoRefreshEnabled ? "true" : "false");
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
      else if (currentTab === "containers") vscode.postMessage({ command: "refreshContainers" });
      else if (currentTab === "locks") vscode.postMessage({ command: "refreshLocks" });
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
    // If a details panel is open, keep its body populated. We do not re-fetch
    // from the host on every refresh (that is expensive); instead the last
    // successful data is re-rendered if we have it cached. The renderDetails
    // call below is a no-op when no data is cached yet and detailsPid was set
    // moments ago — the openDetails() request is already in flight.
    if (detailsPid && detailsLastData) {
      if (detailsKind === "process") {
        renderDetailsFromCache(detailsPid, detailsLastData);
      } else if (detailsKind === "container") {
        renderContainerDetailsFromCache(detailsRuntime, detailsPid, detailsLastData);
      }
    }
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
        '<span><span class="dot" style="background:#FF5252"></span> ' + tpl(T.statsUsed, listenCount) + "</span>" +
        ancestrySpan +
        "<span>" + tpl(T.statsTotal, total) + "</span>";
    } else if (currentTab === "locks") {
      const total = locks.length;
      const byType = locks.reduce((acc, l) => {
        const k = (l.type || "?").toUpperCase();
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const byRw = locks.reduce((acc, l) => {
        const k = (l.rw || "?").toUpperCase();
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const typeChips = Object.entries(byType).map(([k, n]) =>
        '<span class="stat-chip">' + escapeHtml(k) + ' <strong>' + n + "</strong></span>"
      ).join("");
      const rwChips = Object.entries(byRw).map(([k, n]) =>
        '<span class="stat-chip stat-rw-' + k.toLowerCase() + '">' + escapeHtml(k) + ' <strong>' + n + "</strong></span>"
      ).join("");
      elements.stats().innerHTML =
        '<span>' + T.tabLocks + "</span>" +
        '<span>' + tpl(T.statsTotal, total) + "</span>" +
        (typeChips ? '<span class="stat-chips">' + typeChips + "</span>" : "") +
        (rwChips ? '<span class="stat-chips">' + rwChips + "</span>" : "");
    } else {
      const total = processes.length;
      elements.stats().innerHTML =
        "<span>" + T.tabProcesses + "</span>" +
        "<span>" + tpl(T.statsTotal, total) + "</span>";
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

    // Build a per-row cell map keyed by data-col. The row is then emitted in
    // the column order persisted by the user (columnLayout[currentTab]).
    const cellsByCol = {};
    if (isPort) {
      const isListen = p.state === "LISTEN";
      const badgeClass = isListen ? "badge-listen" : "badge-free";
      const badgeText = isListen ? T.stateListen : T.stateFree;
      cellsByCol.port = '<td class="port-num"><span class="port-link" onclick="openPortInBrowser(' + p.port + ', event)" title="' + escapeHtml(T.openInBrowser) + '">:' + p.port + "</span></td>";
      cellsByCol.state =
        '<td><span class="badge ' + badgeClass + '">' + badgeText + "</span></td>";
      cellsByCol.process =
        '<td class="process-name">' + escapeHtml(p.process || "-") + "</td>";
      cellsByCol.pid = '<td class="pid">' +
        (p.pid ? '<button type="button" class="pid-btn" onclick="copyPidFromRow(' + p.port + ', event)" title="' + escapeHtml(T.copyPid) + '">' + p.pid + "</button>" : "-") +
        "</td>";
      cellsByCol.ancestry = '<td class="ancestry">' + renderAncestry(p) + "</td>";
    } else {
      const cpu = p.cpu != null ? (p.cpu.toFixed(1) + "%") : "-";
      const mem = formatMemory(p.memory);
      const portLabel = p.port
        ? '<span class="port-num"><span class="port-link" onclick="openPortInBrowser(' + p.port + ', event)" title="' + escapeHtml(T.openInBrowser) + '">:' + p.port + "</span></span>"
        : "-";
      const ancestryHtml = p.ancestry
        ? '<span class="ancestry-chain" title="' + escapeHtml(p.ancestry) + '">' + escapeHtml(truncate(p.ancestry, 60)) + "</span>"
        : '<span class="ancestry-none">' + escapeHtml(T.ancestryNone) + "</span>";
      // port2 + ancestry2 are the duplicate column keys used by the processes
      // tab; they map to the same data as port/ancestry on ports but live in
      // separate <th> nodes so they can be ordered independently.
      cellsByCol.process =
        '<td class="process-name">' + escapeHtml(p.name || p.process || "-") + "</td>";
      cellsByCol.pid = '<td class="pid">' +
        (p.pid ? '<button type="button" class="pid-btn" onclick="copyPidByPid(' + p.pid + ', event)" title="' + escapeHtml(T.copyPid) + '">' + p.pid + "</button>" : "-") +
        "</td>";
      cellsByCol.port2 = '<td class="port-cell">' + portLabel + "</td>";
      cellsByCol.ancestry2 = '<td class="ancestry">' + ancestryHtml + "</td>";
      cellsByCol.cpu = '<td class="cpu">' + cpu + "</td>";
      cellsByCol.memory = '<td class="memory">' + mem + "</td>";
      cellsByCol.cmd =
        '<td class="command" title="' + escapeHtml(p.command || "") + '">' +
        escapeHtml(truncate(p.command || "", 60)) + "</td>";
    }

    // Fixed columns (select, action) flank the reorderable middle. The user-
    // configurable order is stored in columnLayout[currentTab].
    const order = (columnLayout[currentTab] || []).filter(
      (c) => c !== "select" && c !== "action"
    );
    let middle = "";
    for (const col of order) {
      if (cellsByCol[col]) middle += cellsByCol[col];
    }

    const actionHtml = renderActionButtons(p, isConfirming);
    // Click → open details for the owning PID. We pass the PID (not the port)
    // so the backend looks up the actual process via witr.
    const detailId = isPort ? p.pid || p.port : p.pid || port;

    return (
      '<tr class="' + (isSelected ? "selected" : "") + '" onclick="rowClicked(' + detailId + ', event)" oncontextmenu="showRowContextMenu(' + port + ', ' + (p.pid || "null") + ', event.clientX, event.clientY); return false;">' +
      '<td class="col-select"><input type="checkbox" ' + (isSelected ? "checked" : "") +
      ' onchange="togglePort(' + port + ')"></td>' +
      middle +
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
    btn.textContent = tpl(T.bulkKill, activeSelected.length);
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
  function rowClicked(id, evt) {
    // Ignore clicks on inputs/buttons — those have their own handlers.
    if (evt && evt.target && (evt.target.tagName === "BUTTON" || evt.target.tagName === "INPUT")) return;
    if (currentTab === "containers") {
      const c = containers.find((cc) => cc.id === id);
      if (c) vscode.postMessage({ command: "getContainerDetails", runtime: c.runtime, id });
    } else {
      openDetails(id);
    }
  }

  function openDetails(pid, kind = "process") {
    detailsPid = pid;
    detailsKind = kind;
    detailsLastData = null;
    elements.detailsPanel().style.display = "flex";
    elements.detailsTitle().textContent =
      kind === "container" ? T.detailsTitleContainer
      : kind === "lock" ? T.detailsTitleLock
      : T.detailsTitle;
    const pidBadge = document.getElementById("detailsPidBadge");
    if (pidBadge) {
      const showPid = kind === "process" && pid != null;
      pidBadge.style.display = showPid ? "" : "none";
      pidBadge.textContent = showPid ? T.pidPrefix + pid : "";
    }
    elements.detailsBody().innerHTML =
      '<div class="details-loading">' + escapeHtml(T.detailsLoading) + "</div>";
    if (kind === "process") {
      vscode.postMessage({ command: "getProcessDetails", pid });
    } else if (kind === "container") {
      const c = containers.find((cc) => cc.id === pid);
      if (c) vscode.postMessage({ command: "getContainerDetails", runtime: c.runtime, id: pid });
    }
  }

  // Wire locks toggle
  const locksAllOpenEl = document.getElementById("locksAllOpen");
  if (locksAllOpenEl) {
    locksAllOpenEl.addEventListener("change", (e) => {
      locksShowAllOpen = e.target.checked;
      renderLocks();
    });
  }

  function closeDetails() {
    detailsPid = null;
    detailsKind = "process";
    detailsRuntime = null;
    detailsLastData = null;
    const panel = elements.detailsPanel();
    if (panel) panel.style.display = "none";
    try {
      const titleEl = elements.detailsTitle && elements.detailsTitle();
      if (titleEl) titleEl.textContent = T.detailsTitle;
    } catch {}
  }

  function renderDetails(pid, data, error) {
    if (pid !== detailsPid) return;
    if (error || !data) {
      // Do not blow away previously-good data with a transient empty payload
      // (e.g. from a tab-switch race during refresh). Only render the error
      // state when we have no cached data to fall back on.
      if (detailsLastData) return;
      elements.detailsBody().innerHTML =
        '<div class="details-empty">' + escapeHtml(T.detailsNotAvailable) + (error ? " (" + escapeHtml(error) + ")" : "") + "</div>";
      return;
    }
    detailsLastData = data;
    elements.detailsBody().innerHTML = renderProcessDetailsBody(data);
  }

  function renderDetailsFromCache(pid, data) {
    if (pid !== detailsPid) return;
    if (!data) return;
    elements.detailsBody().innerHTML = renderProcessDetailsBody(data);
  }

  function renderProcessDetailsBody(data) {
    const ancestryHtml = renderAncestryTree(data.ancestry || []);
    const envHtml = renderEnvTable(data.environment || {});
    const socketsHtml = renderSocketsList(data.sockets || []);
    const safeStr = (v, fallback) => {
      if (v == null) return fallback;
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    };
    return '<div class="details-grid">' +
        '<div class="details-card details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.detailsAncestry) + "</div>" +
          ancestryHtml +
        "</div>" +
        '<div class="details-card details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsCommand) + "</div>" +
          '<div class="details-code">' + escapeHtml(safeStr(data.process || data.command, "-")) + "</div>" +
        "</div>" +
        '<div class="details-card details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsUser) + "</div>" +
          '<div class="details-value">' + escapeHtml(safeStr(data.user, "-")) + "</div>" +
        "</div>" +
        '<div class="details-card details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsStarted) + "</div>" +
          '<div class="details-value">' + escapeHtml(safeStr(data.started || data.start_time, "-")) + "</div>" +
        "</div>" +
        '<div class="details-card details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsSource) + "</div>" +
          '<div class="details-value">' + escapeHtml(safeStr(data.source, "-")) + "</div>" +
        "</div>" +
        '<div class="details-card details-section">' +
          '<div class="details-label">' + escapeHtml(T.detailsCwd) + "</div>" +
          '<div class="details-code">' + escapeHtml(safeStr(data.cwd || data.working_dir, "-")) + "</div>" +
        "</div>" +
        '<div class="details-card details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.detailsSockets) + "</div>" +
          socketsHtml +
        "</div>" +
        '<div class="details-card details-section-wide">' +
          '<div class="details-label">' + escapeHtml(T.detailsEnv) + "</div>" +
          envHtml +
        "</div>" +
      "</div>";
  }

  function renderAncestryTree(ancestry) {
    if (!ancestry || ancestry.length === 0) return '<div class="ancestry-none">' + escapeHtml(T.ancestryNone) + "</div>";
    const last = ancestry.length - 1;
    return '<ul class="tree">' + ancestry.map((node, i) => {
      const name = (node && (node.name || node.Command)) || "?";
      const pid = (node && (node.pid ?? node.PID)) || "";
      const cls = i === last ? "tree-current" : (i === 0 ? "tree-root" : "");
      return '<li><span class="tree-node">' +
        '<span class="tree-name ' + cls + '">' + escapeHtml(name) + '</span>' +
        (pid ? '<span class="tree-pid">pid ' + pid + "</span>" : "") +
        "</span></li>";
    }).join("") + "</ul>";
  }

  function renderEnvTable(env) {
    if (!env || typeof env !== "object") return '<div class="ancestry-none">-</div>';
    const keys = Object.keys(env);
    if (keys.length === 0) return '<div class="ancestry-none">-</div>';
    let html = '<table class="env-table"><tbody>';
    for (const k of keys) {
      const v = env[k] == null ? "" : (typeof env[k] === "object" ? JSON.stringify(env[k]) : String(env[k]));
      const display = v.length > 200 ? v.substring(0, 200) + "…" : v;
      html += '<tr><td class="env-key">' + escapeHtml(k) + '</td><td class="env-val">' + escapeHtml(display) + "</td></tr>";
    }
    html += "</tbody></table>";
    return html;
  }

  function renderSocketsList(sockets) {
    if (!sockets || sockets.length === 0) return '<div class="ancestry-none">-</div>';
    return '<ul class="sockets">' + sockets.map((s) => {
      if (!s || typeof s !== "object") return '<li>' + escapeHtml(String(s)) + "</li>";
      const port = s.port != null ? ":" + s.port : "";
      const addr = s.address || s.bind || s.local || "";
      const proto = s.protocol ? " " + s.protocol : "";
      const state = s.state || "";
      const label = (addr ? addr + port : JSON.stringify(s)) + proto;
      return '<li>' + escapeHtml(label) + (state ? ' <span class="socket-state state-' + escapeHtml(state.toLowerCase().replace(/\s+/g, "-")) + '">' + escapeHtml(state) + "</span>" : "") + "</li>";
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
    // Ignore sort clicks that fire immediately after a resize (mousedown on
    // the resize handle can bubble up to the <th>'s onclick in some browsers).
    if (Date.now() - lastResizeAt < 250) return;
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
    const src = currentTab === "ports" ? ports : processes;
    const targets = [...selected]
      .map((sel) => src.find((pp) => (pp.port || pp.pid) === sel))
      .filter(Boolean);
    if (targets.length === 0) return;
    // On the Ports tab, selected entries are port numbers; on the Processes
    // tab they are PIDs (since processes may not own a port). Send both arrays
    // so the host can dispatch the right kill operation per entry.
    const portTargets = targets
      .filter((t) => currentTab === "ports" && t.port != null)
      .map((t) => t.port);
    const pidTargets = targets
      .filter((t) => currentTab !== "ports" && t.pid != null)
      .map((t) => t.pid);
    vscode.postMessage({ command: "bulkKill", ports: portTargets, pids: pidTargets });
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

  function toggleLangMenu(evt) {
    if (evt) { evt.stopPropagation(); }
    const menu = document.getElementById("langMenu");
    const trigger = document.getElementById("langTrigger");
    if (!menu || !trigger) return;
    const open = menu.classList.toggle("open");
    trigger.classList.toggle("open", open);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeLangMenu() {
    const menu = document.getElementById("langMenu");
    const trigger = document.getElementById("langTrigger");
    if (menu) menu.classList.remove("open");
    if (trigger) {
      trigger.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    }
  }

  function pickLang(lang) {
    closeLangMenu();
    changeLang(lang);
  }

  document.addEventListener("click", (e) => {
    const dd = document.getElementById("langDropdown");
    if (dd && !dd.contains(e.target)) closeLangMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLangMenu();
  });

  function showToast(msg, type) {
    const container = elements.toastContainer();
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => showToast(T.copied + ": " + text, "success"),
          () => fallbackCopy(text),
        );
      } else {
        fallbackCopy(text);
      }
    } catch {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast(T.copied + ": " + text, "success");
    } catch (e) {
      showToast("Copy failed: " + e.message, "error");
    }
  }

  function copyPidFromElement(evt, pid) {
    if (!pid) return;
    evt.stopPropagation();
    copyText(String(pid));
  }

  function openPortInBrowser(port) {
    if (!port) return;
    vscode.postMessage({ command: "openExternal", uri: "http://localhost:" + port });
  }

  // ─── Context menu (right-click on a row) ─────────────────────────
  // The webview has no native right-click menu, so we build a minimal one.
  // Each action posts a message to the host or performs a webview-side action.
  let contextMenuEl = null;
  function showContextMenu(x, y, items) {
    hideContextMenu();
    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    menu.setAttribute("role", "menu");
    items.forEach((it) => {
      if (it.separator) {
        const sep = document.createElement("div");
        sep.className = "ctx-sep";
        menu.appendChild(sep);
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctx-item";
      btn.textContent = it.label;
      btn.setAttribute("role", "menuitem");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        hideContextMenu();
        try { it.action(); } catch (err) { showToast("Action failed: " + err.message, "error"); }
      });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    // Clamp to viewport
    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 4;
    const maxY = window.innerHeight - rect.height - 4;
    menu.style.left = Math.min(x, maxX) + "px";
    menu.style.top = Math.min(y, maxY) + "px";
    contextMenuEl = menu;
  }

  function hideContextMenu() {
    if (contextMenuEl && contextMenuEl.parentNode) contextMenuEl.remove();
    contextMenuEl = null;
  }

  document.addEventListener("click", hideContextMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideContextMenu(); });

  // Build the per-row context menu for the Ports/Processes tabs.
  function showRowContextMenu(port, pid, x, y) {
    const items = [];
    if (pid) {
      items.push({ label: T.copyPid + " (" + pid + ")", action: () => copyText(String(pid)) });
    }
    if (port) {
      items.push({ label: T.copyPort + " (:" + port + ")", action: () => copyText(String(port)) });
      items.push({ label: T.openInBrowser + " (:" + port + ")", action: () => openPortInBrowser(port) });
    }
    if (items.length === 0) return;
    showContextMenu(x, y, items);
  }

  function showLockContextMenu(pid, path, x, y) {
    const items = [];
    if (pid) items.push({ label: T.copyPid + " (" + pid + ")", action: () => copyText(String(pid)) });
    if (path) items.push({ label: T.copyPath, action: () => copyText(path) });
    if (pid) {
      items.push({ separator: true });
      items.push({
        label: "Show details",
        action: () => { openDetails(pid, "process"); },
      });
    }
    if (items.length === 0) return;
    showContextMenu(x, y, items);
  }

  // Convenience wrapper used by inline onclick on PID buttons in the
  // Processes tab (where pid is known directly).
  function copyPidFromElementByPort(port, evt) {
    evt.stopPropagation();
    const src = currentTab === "ports" ? ports : processes;
    const found = src.find((p) => p.port === port);
    if (found && found.pid) copyText(String(found.pid));
  }

  // ─── Column reorder + resize ────────────────────────────────────
  // Each reorderable/resizable <th> is draggable; the resize handle is a
  // right-edge <span> that captures horizontal drag without conflicting with
  // the reorder drag (which is initiated by grabbing the body of the cell).
  function initColumnInteractions() {
    const table = document.getElementById("mainTable");
    if (!table) return;

    // Apply persisted widths once on load (inline style wins over CSS).
    applyColumnWidths();
    syncColgroup();

    // --- Resize ---
    table.querySelectorAll("th .resize-handle").forEach((handle) => {
      handle.addEventListener("mousedown", (e) => beginResize(e, handle));
    });

    // --- Reorder via native HTML5 drag-and-drop ---
    let dragSrc = null;
    table.querySelectorAll("th[draggable='true']").forEach((th) => {
      th.addEventListener("dragstart", (e) => {
        dragSrc = th;
        th.classList.add("th-dragging");
        e.dataTransfer.effectAllowed = "move";
        // Some browsers require non-empty data to actually start the drag.
        try { e.dataTransfer.setData("text/plain", th.dataset.col || ""); } catch {}
      });
      th.addEventListener("dragend", () => {
        th.classList.remove("th-dragging");
        table.querySelectorAll("th.drag-over").forEach((el) => el.classList.remove("drag-over"));
        dragSrc = null;
      });
      th.addEventListener("dragover", (e) => {
        if (!dragSrc || dragSrc === th) return;
        e.preventDefault();
        th.classList.add("drag-over");
      });
      th.addEventListener("dragleave", () => th.classList.remove("drag-over"));
      th.addEventListener("drop", (e) => {
        e.preventDefault();
        th.classList.remove("drag-over");
        if (!dragSrc || dragSrc === th) return;
        reorderColumn(dragSrc, th);
      });
    });
  }

  function beginResize(e, handle) {
    e.preventDefault();
    e.stopPropagation();
    const th = handle.closest("th");
    if (!th) return;
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;
    const col = th.dataset.col;
    const onMove = (ev) => {
      const next = Math.max(40, Math.round(startWidth + (ev.clientX - startX)));
      th.style.width = next + "px";
      columnWidths[col] = next;
      syncColgroup();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("resizing-col");
      saveColumnWidths();
      lastResizeAt = Date.now();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.classList.add("resizing-col");
  }

  // Move srcCol so it ends up immediately before targetCol within the
  // current tab's reorderable list. Fixed columns (select, action) are not
  // touched.
  function reorderColumn(srcTh, targetTh) {
    const srcCol = srcTh.dataset.col;
    const targetCol = targetTh.dataset.col;
    if (!srcCol || !targetCol || srcCol === targetCol) return;
    if (srcCol === "select" || srcCol === "action") return;
    if (targetCol === "select" || targetCol === "action") return;

    const order = columnLayout[currentTab].slice();
    const srcIdx = order.indexOf(srcCol);
    if (srcIdx === -1) return;
    order.splice(srcIdx, 1);
    let insertAt = order.indexOf(targetCol);
    if (insertAt === -1) insertAt = order.length;
    order.splice(insertAt, 0, srcCol);
    columnLayout[currentTab] = order;
    saveColumnLayout();

    // Reorder the <th> nodes in the DOM to match. Find them by data-col.
    const headRow = document.querySelector("#mainTable thead tr");
    if (!headRow) return;
    const nodes = Array.from(headRow.children);
    const srcNode = nodes.find((n) => n.dataset && n.dataset.col === srcCol);
    const targetNode = nodes.find((n) => n.dataset && n.dataset.col === targetCol);
    if (!srcNode || !targetNode) return;
    headRow.insertBefore(srcNode, targetNode);
    syncColgroup();
    render();
  }

  function applyColumnWidths() {
    const table = document.getElementById("mainTable");
    if (!table) return;
    table.querySelectorAll("th[data-col]").forEach((th) => {
      const w = columnWidths[th.dataset.col];
      if (w) th.style.width = w + "px";
    });
  }

  // Keep the <colgroup> widths in sync with <th> widths so cells in <tbody>
  // match the column widths the user set.
  function syncColgroup() {
    const table = document.getElementById("mainTable");
    if (!table) return;
    let cg = document.getElementById("mainColgroup");
    if (!cg) return;
    const ths = table.querySelectorAll("thead th[data-col]");
    cg.innerHTML = Array.from(ths).map((th) => {
      const w = columnWidths[th.dataset.col] || th.getBoundingClientRect().width || "";
      return '<col data-col="' + th.dataset.col + '"' + (w ? ' style="width:' + w + 'px"' : "") + ">";
    }).join("");
  }

  // ─── Init ────────────────────────────────────────────────────────
  // Expose handlers used by inline onclick="..." attributes on dynamically
  // rendered rows / panels so the global lookup window.<name> resolves.
  // Without this, onclick attributes silently fail (function not defined).
  window.closeDetails = closeDetails;
  window.refresh = refresh;
  window.sortBy = sortBy;
  window.togglePort = togglePort;
  window.toggleAll = toggleAll;
  window.startKill = startKill;
  window.cancelKill = cancelKill;
  window.confirmKill = confirmKill;
  window.rowClicked = rowClicked;
  window.bulkKill = bulkKill;
  window.toggleScan = toggleScan;
  window.scanRange = scanRange;
  window.changeLang = changeLang;
  window.toggleLangMenu = toggleLangMenu;
  window.pickLang = pickLang;
  window.closeLangMenu = closeLangMenu;
  window.containerAction = containerAction;
  window.processAction = processAction;
  window.openPortInBrowser = openPortInBrowser;
  window.copyPidFromRow = copyPidFromElementByPort;
  window.copyPidByPid = copyPidFromElement;
  window.showRowContextMenu = showRowContextMenu;
  window.showLockContextMenu = showLockContextMenu;
  window.showLockDetails = showLockDetails;

  initColumnInteractions();

  // Lock row event delegation: context menu and PID click.
  // The rows use data-* attributes (not inline onclick) so paths containing
  // quotes / backslashes don't break the HTML or the surrounding template
  // literal that wraps the entire script.
  const locksTbody = document.getElementById("locksTbody");
  if (locksTbody) {
    locksTbody.addEventListener("contextmenu", (e) => {
      const tr = e.target.closest("tr[data-lock-row]");
      if (!tr) return;
      e.preventDefault();
      const pid = parseInt(tr.dataset.pid, 10) || 0;
      const path = tr.dataset.path || "";
      showLockContextMenu(pid, path, e.clientX, e.clientY);
    });
    locksTbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".lock-pid-btn");
      if (!btn) return;
      const tr = btn.closest("tr[data-lock-row]");
      if (!tr) return;
      const pid = parseInt(tr.dataset.pid, 10) || 0;
      if (pid) openDetails(pid, "process");
    });
  }

  // Wire the close button with addEventListener so it doesn't depend on
  // inline onclick resolving through window globals (some webview contexts
  // strip inline handlers via CSP). We stop propagation so the click doesn't
  // bubble to the row underneath (which would re-open the panel and feel
  // like a "loop" to the user).
  const closeBtn = document.getElementById("detailsCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeDetails();
  });
  // Stop clicks anywhere on the panel from re-triggering the row underneath.
  const detailsPanel = document.getElementById("detailsPanel");
  if (detailsPanel) {
    detailsPanel.addEventListener("click", (e) => e.stopPropagation());
    detailsPanel.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  vscode.postMessage({ command: "refresh" });
  scheduleNextRefresh(0);
`;
};
