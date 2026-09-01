/**
 * PortPilot - Webview Styles
 */

module.exports = function getStyles() {
  return /*css*/ `
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border, #333);
    --accent: #00E676;
    --danger: #FF5252;
    --hover: var(--vscode-list-hoverBackground);
    --badge-listen-bg: #FF5252;
    --badge-listen-fg: #fff;
    --badge-free-bg: #00E676;
    --badge-free-fg: #003311;
    --header-bg: var(--vscode-sideBarSectionHeader-background, #1e1e2e);
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --input-border: var(--vscode-input-border, #444);
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--vscode-font-family, system-ui);
    font-size: 13px;
    padding: 0;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    position: sticky;
    top: 0;
    z-index: 11;
  }
  .tab {
    padding: 8px 14px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--fg);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    opacity: 0.7;
    transition: opacity 0.15s, border-color 0.15s;
  }
  .tab:hover { opacity: 1; }
  .tab-active {
    opacity: 1;
    border-bottom-color: var(--accent);
    font-weight: 600;
  }
  .tab-refresh {
    margin-left: auto;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--fg);
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0.7;
  }
  .tab-refresh:hover { opacity: 1; }
  .tab-refresh.auto-off .dot { background: var(--vscode-disabledForeground, #666); }
  .dot-pulse {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1); }
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    align-items: center;
    flex-wrap: wrap;
    position: sticky;
    top: 36px;
    background: var(--bg);
    z-index: 10;
  }

  .toolbar input[type="text"] {
    flex: 1;
    min-width: 120px;
    padding: 5px 10px;
    border-radius: 4px;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--input-fg);
    font-family: inherit;
    font-size: 12px;
    outline: none;
  }

  .toolbar input:focus { border-color: var(--accent); }

  /* Buttons */
  .btn {
    padding: 5px 12px;
    border-radius: 4px;
    border: none;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    background: var(--btn-bg);
    color: var(--btn-fg);
    white-space: nowrap;
  }

  .btn:hover { background: var(--btn-hover); }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover { opacity: 0.85; }

  .btn-outline {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg);
  }

  .btn-outline:hover { background: var(--hover); }

  .lang-select {
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    margin-left: auto;
  }
  .btn-sm { padding: 3px 8px; font-size: 11px; }

  /* Stats */
  .stats {
    display: flex;
    gap: 16px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    opacity: 0.7;
  }

  .stats span { display: flex; align-items: center; gap: 4px; }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  /* Table */
  table { width: 100%; border-collapse: collapse; }

  th {
    text-align: left;
    padding: 7px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.5;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    user-select: none;
    position: sticky;
    top: 72px;
    background: var(--bg);
    z-index: 5;
  }

  th:hover { opacity: 0.8; }
  th.sorted { opacity: 1; color: var(--accent); }

  td {
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
  }

  tr:hover td { background: var(--hover); }
  tr.selected td { background: rgba(0, 230, 118, 0.08); }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .badge-listen { background: var(--badge-listen-bg); color: var(--badge-listen-fg); }
  .badge-free { background: var(--badge-free-bg); color: var(--badge-free-fg); }

  /* Port display */
  .port-num {
    font-weight: 700;
    font-family: var(--vscode-editor-font-family, monospace);
  }

  .process-name { color: var(--accent); }

  .pid {
    opacity: 0.5;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
  }

  /* Kill button */
  .kill-btn {
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 11px;
    border: 1px solid var(--danger);
    background: transparent;
    color: var(--danger);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .kill-btn:hover { background: var(--danger); color: #fff; }

  .confirm-group { display: inline-flex; gap: 4px; }

  /* Empty state */
  .empty { text-align: center; padding: 40px; opacity: 0.4; }

  /* Toast notifications */
  .toast {
    position: fixed;
    bottom: 16px;
    right: 16px;
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    z-index: 100;
    animation: slideUp 0.3s ease;
  }

  .toast-success { background: var(--accent); color: #003311; }
  .toast-error { background: var(--danger); color: #fff; }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* Checkbox */
  input[type="checkbox"] { accent-color: var(--accent); }

  /* Scan panel */
  .scan-panel {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .scan-panel input[type="number"] {
    width: 80px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--input-fg);
    font-family: inherit;
    font-size: 12px;
  }

  .scan-panel label { font-size: 12px; opacity: 0.6; }

  /* Ancestry column */
  .ancestry {
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    opacity: 0.85;
  }
  .ancestry-chain {
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .ancestry-sup {
    color: var(--vscode-textLink-foreground, #4ec9b0);
    font-weight: 600;
  }
  .ancestry-sep { opacity: 0.5; }
  .ancestry-leaf {
    color: var(--vscode-editor-foreground);
    opacity: 0.85;
  }
  .ancestry-none {
    opacity: 0.35;
  }

  /* Toast warning variant */
  .toast-warn {
    background: var(--vscode-inputValidation-warningBackground, #5a4a00);
    color: var(--vscode-inputValidation-warningForeground, #fff);
    border-color: var(--vscode-inputValidation-warningBorder, #bfa000);
  }

  /* Stats */
  .stat-ancestry {
    color: var(--vscode-textLink-foreground, #4ec9b0);
    font-weight: 500;
  }

  /* Process details panel (slide-in from bottom) */
  .details-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 60vh;
    background: var(--vscode-editorWidget-background, var(--bg));
    border-top: 1px solid var(--border);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    z-index: 20;
  }
  .details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--header-bg);
  }
  .details-title {
    font-weight: 600;
    font-size: 13px;
  }
  .details-close {
    background: transparent;
    border: none;
    color: var(--fg);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 6px;
    opacity: 0.7;
  }
  .details-close:hover { opacity: 1; }
  .details-body {
    overflow-y: auto;
    padding: 12px;
    flex: 1;
  }
  .details-empty, .details-loading {
    text-align: center;
    padding: 32px 16px;
    opacity: 0.6;
    font-size: 12px;
  }
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .details-section { display: flex; flex-direction: column; gap: 4px; }
  .details-section-wide { grid-column: 1 / -1; }
  .details-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.6;
    font-weight: 600;
  }
  .details-code {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    padding: 4px 6px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 3px;
    word-break: break-all;
    overflow-wrap: anywhere;
  }
  .tree { list-style: none; padding-left: 16px; }
  .tree li {
    position: relative;
    padding: 2px 0;
  }
  .tree li::before {
    content: "└─";
    position: absolute;
    left: -14px;
    opacity: 0.4;
  }
  .tree-node {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }
  .tree-name { font-weight: 500; }
  .tree-pid { font-size: 10px; opacity: 0.5; font-family: monospace; }
  .env-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .env-table td {
    padding: 3px 6px;
    border-bottom: 1px solid var(--border);
    word-break: break-all;
  }
  .env-key { width: 30%; opacity: 0.7; }
  .env-val { font-family: inherit; }
  .sockets {
    list-style: none;
    padding: 0;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .sockets li {
    padding: 2px 0;
    display: flex;
    gap: 8px;
  }
  .socket-state { opacity: 0.6; }

  /* Processes tab — command column */
  .command {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 280px;
  }
  .cpu, .memory {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    text-align: right;
  }
  tr { cursor: pointer; }

  /* Runtime badge (docker, podman, k8s, etc.) */
  .badge-runtime {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 8px;
  }
  .badge-paused {
    background: var(--vscode-charts-yellow, #cca700);
    color: #1a1a1a;
  }

  /* Locks toggle */
  .locks-toggle {
    display: block;
    padding: 8px 12px;
    font-size: 12px;
    opacity: 0.85;
    cursor: pointer;
  }
`;
};
