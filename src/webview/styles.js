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

  /* Sidebar logo header */
  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--header-bg);
    position: relative;
    z-index: 12;
  }
  .sidebar-logo-svg {
    flex: 0 0 auto;
    border-radius: 6px;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.04);
  }
  .sidebar-logo-text {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
    min-width: 0;
  }
  .sidebar-logo-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: var(--fg);
  }
  .sidebar-logo-sub {
    font-size: 10px;
    opacity: 0.6;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    position: relative;
    top: 0;
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
    opacity: 1;
    font-weight: 500;
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

  /* Custom language dropdown — replaces the native <select> which can't be
     themed in webviews. Trigger mimics a button, the menu floats below it. */
  .lang-dropdown {
    position: relative;
    margin-left: auto;
  }
  .lang-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 8px;
    background: transparent;
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    transition: background 120ms, border-color 120ms;
  }
  .lang-trigger:hover { background: var(--hover); border-color: var(--input-border); }
  .lang-trigger.open {
    background: var(--hover);
    border-color: var(--accent);
  }
  .lang-globe {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--vscode-badge-foreground, #fff);
    font-size: 9px;
    line-height: 1;
  }
  .lang-trigger-label { font-weight: 500; }
  .lang-caret {
    font-size: 10px;
    opacity: 0.6;
    transition: transform 150ms;
  }
  .lang-trigger.open .lang-caret { transform: rotate(180deg); }

  .lang-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 180px;
    background: var(--vscode-editorWidget-background, var(--header-bg));
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
    padding: 4px;
    display: none;
    z-index: 30;
    animation: langMenuFade 140ms ease-out;
  }
  .lang-menu.open { display: block; }
  @keyframes langMenuFade {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .lang-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--fg);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background 100ms;
  }
  .lang-dropdown-item:hover { background: var(--hover); }
  .lang-dropdown-item.active { background: var(--input-bg); }
  .lang-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border);
    flex-shrink: 0;
  }
  .lang-dropdown-item.active .lang-dot { background: var(--accent); }
  .lang-label { flex: 1; }
  .lang-check {
    opacity: 0;
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
  }
  .lang-dropdown-item.active .lang-check { opacity: 1; }
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

  thead th {
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
    background: var(--bg);
  }

  thead {
    position: relative;
    top: 0;
    z-index: 11;
  }

  th:hover { opacity: 0.8; }
  th.sorted { opacity: 1; color: var(--accent); }

  /* Reorder: draggable headers; cursor indicates the affordance. */
  th[draggable="true"] { cursor: grab; }
  th[draggable="true"]:active { cursor: grabbing; }
  th.th-dragging { opacity: 0.5; outline: 1px dashed var(--accent); }
  th.drag-over { box-shadow: inset 0 -2px 0 var(--accent); }

  /* Resize handle on the right edge of each reorderable header. */
  .resize-handle {
    position: absolute;
    top: 0; right: 0; bottom: 0;
    width: 6px;
    cursor: col-resize;
    user-select: none;
  }
  .resize-handle:hover { background: var(--accent); opacity: 0.6; }
  thead th { position: relative; } /* anchor for the absolutely-positioned resize handle */
  body.resizing-col { cursor: col-resize !important; user-select: none; }
  body.resizing-col * { cursor: col-resize !important; }

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
    max-height: 65vh;
    background: var(--vscode-editorWidget-background, var(--bg));
    border-top: 1px solid var(--border);
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.45), 0 -1px 0 var(--accent);
    display: flex;
    flex-direction: column;
    z-index: 20;
    animation: slideUp 180ms ease-out;
  }
  @keyframes slideUp {
    from { transform: translateY(12px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, var(--header-bg), var(--bg));
  }
  .details-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .details-title {
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.2px;
  }
  .details-title-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: var(--accent);
    color: var(--vscode-badge-foreground, #fff);
    font-size: 11px;
    line-height: 1;
  }
  .details-title-pid {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    opacity: 0.55;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 999px;
  }
  .details-close {
    background: transparent;
    border: 1px solid transparent;
    color: var(--fg);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    width: 26px;
    height: 26px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: background 120ms, opacity 120ms;
  }
  .details-close:hover { opacity: 1; background: var(--input-border); }
  .details-body {
    overflow-y: auto;
    padding: 14px;
    flex: 1;
    scrollbar-width: thin;
  }
  .details-empty, .details-loading {
    text-align: center;
    padding: 36px 16px;
    opacity: 0.55;
    font-size: 12px;
  }
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .details-card {
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 120ms;
  }
  .details-card:hover { border-color: var(--input-border); }
  .details-section { display: flex; flex-direction: column; gap: 4px; }
  .details-section-wide { grid-column: 1 / -1; }
  .details-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    letter-spacing: 0.6px;
    opacity: 0.55;
    font-weight: 700;
    text-transform: capitalize;
  }
  .details-label::before {
    content: "";
    display: inline-block;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.9;
  }
  .details-value {
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
  }
  .details-code {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    line-height: 1.5;
    padding: 6px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    word-break: break-all;
    overflow-wrap: anywhere;
    color: var(--fg);
    opacity: 0.92;
  }
  .details-tree {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tree {
    list-style: none;
    padding-left: 14px;
    margin: 0;
    border-left: 1px dashed var(--border);
  }
  .tree li {
    position: relative;
    padding: 4px 0 4px 10px;
  }
  .tree li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 8px;
    height: 1px;
    background: var(--border);
  }
  .tree li:last-child::after {
    content: "";
    position: absolute;
    left: -1px;
    top: calc(50% + 1px);
    bottom: 0;
    width: 1px;
    background: var(--vscode-editorWidget-background, var(--bg));
  }
  .tree-node {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
  }
  .tree-name {
    font-weight: 500;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .tree-name.tree-root {
    color: var(--accent);
  }
  .tree-name.tree-current {
    color: var(--accent);
    font-weight: 600;
  }
  .tree-pid {
    font-size: 10px;
    opacity: 0.55;
    font-family: monospace;
  }
  .ancestry-none {
    font-size: 11px;
    opacity: 0.5;
    font-style: italic;
  }
  .env-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  .env-table tr:hover td { background: var(--input-bg); }
  .env-table td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--border);
    word-break: break-all;
    line-height: 1.4;
  }
  .env-table tr:last-child td { border-bottom: none; }
  .env-key {
    width: 32%;
    opacity: 0.65;
    font-weight: 500;
  }
  .env-val {
    font-family: inherit;
    opacity: 0.92;
  }
  .sockets {
    list-style: none;
    padding: 0;
    margin: 0;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .sockets li {
    padding: 4px 8px;
    display: flex;
    gap: 10px;
    align-items: center;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .socket-state {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--vscode-badge-foreground, #fff);
    opacity: 0.85;
  }
  .socket-state.state-listen { background: var(--vscode-charts-blue, #007acc); }
  .socket-state.state-established { background: var(--vscode-charts-green, #388a34); }
  .socket-state.state-time-wait,
  .socket-state.state-close-wait { background: var(--vscode-charts-yellow, #cca700); color: #1a1a1a; }

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

  /* MCP tools panel */
  .mcp-master {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 10px 12px;
    margin: 10px 12px 6px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mcp-master-switch {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    cursor: pointer;
  }
  .mcp-master-label { font-size: 13px; }
  .mcp-master-state {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    font-weight: 500;
  }
  .mcp-state-on { background: rgba(0, 200, 100, 0.15); color: #00c864; }
  .mcp-state-off { background: rgba(220, 60, 60, 0.15); color: #dc3c3c; }
  .mcp-master-meta {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr;
    gap: 4px 8px;
    font-size: 11px;
    opacity: 0.85;
  }
  .mcp-meta-label { opacity: 0.65; }
  .mcp-meta-value {
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-textLink-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mcp-master-actions { display: flex; gap: 6px; }
  #mcpTable { margin: 0 12px; }
  #mcpTable thead th { font-size: 11px; text-transform: uppercase; opacity: 0.65; }
  #mcpTable tbody tr.mcp-row-off { opacity: 0.45; }
  #mcpTable tbody tr.mcp-row-off .mcp-tool-name { text-decoration: line-through; }
  .mcp-tool-name {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
  }
  .mcp-cat {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .mcp-cat-read   { background: rgba(0, 150, 220, 0.18); color: #6cb6e8; }
  .mcp-cat-write  { background: rgba(220, 140, 0, 0.18); color: #e8a96c; }
  .mcp-cat-system { background: rgba(140, 140, 140, 0.18); color: #b8b8b8; }
  .mcp-flag-destructive { color: #dc3c3c; font-size: 13px; }
  /* iOS-style switch */
  .mcp-switch { position: relative; display: inline-block; width: 34px; height: 18px; }
  .mcp-switch input { opacity: 0; width: 0; height: 0; }
  .mcp-slider {
    position: absolute;
    inset: 0;
    background: var(--vscode-input-background, #444);
    border-radius: 999px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }
  .mcp-slider::before {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.15s ease;
  }
  .mcp-switch input:checked + .mcp-slider { background: #00c864; }
  .mcp-switch input:checked + .mcp-slider::before { transform: translateX(16px); }
  .mcp-switch input:disabled + .mcp-slider { opacity: 0.4; cursor: not-allowed; }

  /* Clickable PID / port buttons */
  .pid-btn {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    padding: 2px 6px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--fg);
    cursor: pointer;
    transition: border-color 100ms, color 100ms;
  }
  .pid-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .pid-btn:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: 1px;
  }

  /* Clickable port number (Open in browser) */
  .port-link {
    cursor: pointer;
    color: var(--accent);
    text-decoration: none;
    border-bottom: 1px dotted transparent;
    transition: border-color 100ms;
  }
  .port-link:hover { border-bottom-color: var(--accent); }

  /* Custom right-click context menu */
  .ctx-menu {
    position: fixed;
    z-index: 100;
    min-width: 180px;
    background: var(--vscode-editorWidget-background, var(--header-bg));
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 4px;
    animation: ctxMenuFade 120ms ease-out;
  }
  @keyframes ctxMenuFade {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ctx-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border: none;
    color: var(--fg);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    transition: background 80ms;
  }
  .ctx-item:hover { background: var(--hover); }
  .ctx-item:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
  .ctx-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 6px;
  }

  /* Locks panel — refined row layout */
  #locksTable {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  #locksTable thead th {
    padding: 7px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  #locksTable tbody tr {
    transition: background 100ms;
  }
  #locksTable tbody tr:hover { background: var(--hover); }
  #locksTable td { padding: 6px 12px; vertical-align: middle; }

  .lock-cell-type {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .lock-cell-path {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 0;
  }

  /* Type badges (FLOCK / POSIX / OFDLCK) */
  .badge.lock-type-flock {
    background: rgba(0, 122, 204, 0.18);
    color: #58a6ff;
    border: 1px solid rgba(88, 166, 255, 0.35);
  }
  .badge.lock-type-posix {
    background: rgba(204, 167, 0, 0.18);
    color: #f0c674;
    border: 1px solid rgba(240, 198, 116, 0.35);
  }
  .badge.lock-type-ofdlck {
    background: rgba(56, 138, 52, 0.22);
    color: #7ec97e;
    border: 1px solid rgba(126, 201, 126, 0.4);
  }
  .badge.lock-type-other {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
  }
  .lock-mode {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--fg);
    opacity: 0.55;
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-radius: 3px;
  }

  /* R/W badges inside path cell */
  .badge.lock-rw-write {
    background: rgba(255, 82, 82, 0.18);
    color: #ff7b7b;
    border: 1px solid rgba(255, 123, 123, 0.4);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .badge.lock-rw-read {
    background: rgba(0, 230, 118, 0.16);
    color: #6fdc8c;
    border: 1px solid rgba(111, 220, 140, 0.4);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .badge.lock-rw-unlck {
    background: var(--input-bg);
    color: var(--fg);
    opacity: 0.5;
    border: 1px solid var(--border);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .badge.lock-rw-none {
    display: none;
  }

  .lock-path {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .lock-pid {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    padding: 2px 6px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 3px;
    cursor: pointer;
  }
  .lock-pid:hover { border-color: var(--accent); color: var(--accent); }
  .lock-pid-btn {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    padding: 2px 6px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--fg);
    cursor: pointer;
    transition: border-color 100ms, color 100ms;
  }
  .lock-pid-btn:hover { border-color: var(--accent); color: var(--accent); }
  .lock-fd {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
    padding: 2px 6px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  .lock-inode {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
    opacity: 0.7;
  }
  .lock-missing {
    opacity: 0.3;
    font-size: 11px;
  }

  /* Stats chips for locks */
  .stat-chips {
    display: inline-flex;
    gap: 6px;
    margin-left: 4px;
  }
  .stat-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 10px;
    letter-spacing: 0.3px;
    opacity: 0.85;
  }
  .stat-chip strong { font-weight: 700; color: var(--accent); }
  .stat-chip.stat-rw-write strong { color: #ff7b7b; }
  .stat-chip.stat-rw-read strong { color: #6fdc8c; }
`;
};
