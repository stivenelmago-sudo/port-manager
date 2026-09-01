/**
 * PortPilot - Webview Client Script
 */

module.exports = function getScript(strings = {}) {
  const s = JSON.stringify({
    statsUsed: strings.statsUsed || "Used",
    statsTotal: strings.statsTotal || "Total",
    colPort: strings.colPort || "Port",
    colState: strings.colState || "State",
    colProcess: strings.colProcess || "Process",
    colPid: strings.colPid || "PID",
    colAction: strings.colAction || "Action",
    stateListen: strings.stateListen || "LISTEN",
    stateFree: strings.stateFree || "FREE",
    kill: strings.kill || "KILL",
    confirm: strings.confirm || "Confirm",
    cancel: strings.cancel || "Cancel",
    empty: strings.empty || "No matching ports",
    toastKilled: strings.toastKilled || "was killed",
    toastKillFailed: strings.toastKillFailed || "Kill failed",
    toastScan: strings.toastScan || "Used / Free",
    bulkKill: strings.bulkKill || "KILL Selected",
    refresh: strings.refresh || "Refresh",
    rangeScan: strings.rangeScan || "Range Scan",
  });

  return /*javascript*/ `
  const vscode = acquireVsCodeApi();
  const T = ${s};

  // State
  let ports = [];
  let selected = new Set();
  let currentSort = { col: "port", dir: "asc" };
  let filter = "";
  let confirmingKill = null;

  // DOM Elements
  const elements = {
    tbody: () => document.getElementById("tbody"),
    stats: () => document.getElementById("stats"),
    empty: () => document.getElementById("empty"),
    search: () => document.getElementById("search"),
    scanPanel: () => document.getElementById("scanPanel"),
    scanFrom: () => document.getElementById("scanFrom"),
    scanTo: () => document.getElementById("scanTo"),
    bulkKillBtn: () => document.getElementById("bulkKillBtn"),
    toastContainer: () => document.getElementById("toastContainer"),
    selectAll: () => document.getElementById("selectAll"),
  };

  // Message handler from VS Code
  window.addEventListener("message", (event) => {
    const msg = event.data;

    switch (msg.type) {
      case "ports":
        ports = msg.ports;
        render();
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

  // Render the port table
  function render() {
    const list = filterAndSort();
    renderStats();
    renderTable(list);
    updateBulkKillButton();
    updateSortIndicators();
  }

  function filterAndSort() {
    let list = ports.filter((p) => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      return (
        String(p.port).includes(f) ||
        (p.process || "").toLowerCase().includes(f)
      );
    });

    list.sort((a, b) => {
      let cmp = 0;
      const col = currentSort.col;

      if (col === "port") cmp = a.port - b.port;
      else if (col === "state") cmp = (a.state || "").localeCompare(b.state || "");
      else if (col === "process") cmp = (a.process || "").localeCompare(b.process || "");
      else if (col === "pid") cmp = (a.pid || 0) - (b.pid || 0);

      return currentSort.dir === "asc" ? cmp : -cmp;
    });

    return list;
  }

  function renderStats() {
    const listenCount = ports.filter((p) => p.state === "LISTEN").length;
    const total = ports.length;

    elements.stats().innerHTML =
      '<span><span class="dot" style="background:#FF5252"></span> ' + T.statsUsed + " " + listenCount + "</span>" +
      "<span>" + T.statsTotal + " " + total + "</span>";
  }

  function renderTable(list) {
    const tbody = elements.tbody();

    if (list.length === 0) {
      tbody.innerHTML = "";
      elements.empty().style.display = "block";
      return;
    }

    elements.empty().style.display = "none";
    tbody.innerHTML = list.map(renderRow).join("");
  }

  function renderRow(p) {
    const isSelected = selected.has(p.port);
    const isListen = p.state === "LISTEN";
    const badgeClass = isListen ? "badge-listen" : "badge-free";
    const badgeText = isListen ? T.stateListen : T.stateFree;
    const isConfirming = confirmingKill === p.port;

    const actionHtml = isListen ? renderActionButtons(p, isConfirming) : "";

    return (
      '<tr class="' + (isSelected ? "selected" : "") + '">' +
      "<td><input type=\\"checkbox\\" " + (isSelected ? "checked" : "") +
      ' onchange="togglePort(' + p.port + ')"></td>' +
      '<td class="port-num">:' + p.port + "</td>" +
      '<td><span class="badge ' + badgeClass + '">' + badgeText + "</span></td>" +
      '<td class="process-name">' + (p.process || "-") + "</td>" +
      '<td class="pid">' + (p.pid || "-") + "</td>" +
      '<td style="text-align:right">' + actionHtml + "</td>" +
      "</tr>"
    );
  }

  function renderActionButtons(p, isConfirming) {
    if (isConfirming) {
      return (
        '<span class="confirm-group">' +
        '<button class="btn btn-sm btn-danger" onclick="confirmKill(' + p.port + "," + p.pid + ')">' + T.confirm + '</button>' +
        '<button class="btn btn-sm btn-outline" onclick="cancelKill()">' + T.cancel + '</button>' +
        "</span>"
      );
    }
    return '<button class="kill-btn" onclick="startKill(' + p.port + ')">' + T.kill + '</button>';
  }

  function updateBulkKillButton() {
    const activeSelected = [...selected].filter((p) =>
      ports.find((pp) => pp.port === p && pp.state === "LISTEN")
    );
    const btn = elements.bulkKillBtn();
    btn.style.display = activeSelected.length > 0 ? "inline-block" : "none";
    btn.textContent = T.bulkKill + " (" + activeSelected.length + ")";
  }

  function updateSortIndicators() {
    const labels = {
      port: T.colPort,
      state: T.colState,
      process: T.colProcess,
      pid: T.colPid,
    };
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      const col = th.dataset.sort;
      th.classList.toggle("sorted", col === currentSort.col);

      if (col === currentSort.col) {
        th.textContent =
          labels[col] +
          (currentSort.dir === "asc" ? " ▲" : " ▼");
      } else {
        th.textContent = labels[col] || th.textContent.replace(/ [▲▼]$/, "");
      }
    });
  }

  // Event handlers
  elements.search().addEventListener("input", (e) => {
    filter = e.target.value;
    render();
  });

  function refresh() {
    vscode.postMessage({ command: "refresh" });
  }

  function sortBy(col) {
    if (currentSort.col === col) {
      currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
    } else {
      currentSort = { col, dir: "asc" };
    }
    render();
  }

  function togglePort(port) {
    if (selected.has(port)) {
      selected.delete(port);
    } else {
      selected.add(port);
    }
    render();
  }

  function toggleAll(checked) {
    if (checked) {
      ports.forEach((p) => selected.add(p.port));
    } else {
      selected.clear();
    }
    render();
  }

  function startKill(port) {
    confirmingKill = port;
    render();
  }

  function cancelKill() {
    confirmingKill = null;
    render();
  }

  function confirmKill(port, pid) {
    vscode.postMessage({ command: "kill", port, pid });
  }

  function bulkKill() {
    const targets = [...selected].filter((p) =>
      ports.find((pp) => pp.port === p && pp.state === "LISTEN")
    );
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

  function showToast(msg, type) {
    const container = elements.toastContainer();
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // Initial load
  vscode.postMessage({ command: "refresh" });
`;
};
