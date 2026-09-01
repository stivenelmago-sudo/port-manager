# Change Log

All notable changes to the "Port Manager" extension will be documented in this file.

## [1.1.0] - 2026-09-01

### Added
- **Multi-language support**: UI available in English, Español, 中文, हिन्दी, العربية, 日本語
- Automatic language detection from VS Code display language
- Manual language override via `portManager.language` setting
- New command `Port Manager: Set Language`
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
