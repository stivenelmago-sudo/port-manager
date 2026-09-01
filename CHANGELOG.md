# Change Log

All notable changes to the "PortPilot" extension will be documented in this file.

**Maintainer:** [Cristopher Martinez (@cristopher-dev)](https://github.com/cristopher-dev) — [cristopher-dev.com](https://cristopher-dev.com/) · [LinkedIn](https://www.linkedin.com/in/cristopher-dev)
**Fork upstream:** [saisai-web/portpilot](https://github.com/saisai-web/portpilot) · **This fork:** [cristopher-dev/port-manager](https://github.com/cristopher-dev/port-manager)

## [Unreleased] - 2026-09-01

### Added
- **WITR process ancestry enrichment** (bundled binary, zero-config)
  - New "Ancestry" column in the sidebar table shows the parent supervisor chain
    for every listening port (e.g. `systemd → pm2 → node`).
  - New command palette entry **PortPilot: Show Process Ancestry** (`portManager.showAncestry`)
    opens a Quick Pick with the full chain per port.
  - New settings: `portManager.witr.enabled` (default `true`) and
    `portManager.witr.binaryPath` (override the bundled path).
  - New `scripts/download-witr.js` and `scripts/build-platform.js` for CI to
    bundle the matching WITR static binary per (platform, arch) — see
    `resources/bin/README.md`.
  - Graceful degradation: missing/unsupported binary, exit code 3 (permission
    denied), or any error produces a one-time toast with an actionable hint
    instead of breaking the port list.

### Changed
- Sync maintainer metadata to profile (@cristopher-dev)
  - `package.json` → `author`, `repository`, `bugs`, `homepage` now point to the fork
  - Publisher (`port-manager-saiki`) kept on the Marketplace listing

## [1.1.0] - 2026-09-01

### Added
- **Multi-language support**: UI available in English, Español, Chinese, हिन्दी, العربية, 日本語
- Automatic language detection from VS Code display language
- Manual language override via `portManager.language` setting
- New command `PortPilot: Set Language`
- Right-to-left (RTL) layout for Arabic
- `package.nls.*.json` files for native VS Code localization of commands and views

### Fixed
- Stats counter showed a "Free" count that was always 0 (only listening ports are listed); removed misleading counter

## [1.0.0] - 2025-02-21

### Added
- Sidebar webview panel showing all listening TCP ports
- Real-time search filtering by port number and process name
- Sortable columns (port, state, process, PID)
- One-click kill with confirmation dialog
- Bulk select and kill multiple ports
- Range scan to check port availability in a range
- Command palette: Show Listening Ports (Quick Pick with kill)
- Command palette: Check Port Availability
- Command palette: Kill Port (supports comma-separated bulk input)
- Cross-platform support: macOS (`lsof`), Linux (`lsof`/`ss`), Windows (`netstat`/`tasklist`)
- Automatic VS Code theme adaptation (dark, light, high contrast)
