# Change Log

All notable changes to the "PortPilot" extension will be documented in this file.

**Maintainer:** [Cristopher Martinez (@cristopher-dev)](https://github.com/cristopher-dev) — [cristopher-dev.com](https://cristopher-dev.com/) · [LinkedIn](https://www.linkedin.com/in/cristopher-dev)
**Fork upstream:** [saisai-web/portpilot](https://github.com/saisai-web/portpilot) · **This fork:** [cristopher-dev/port-manager](https://github.com/cristopher-dev/port-manager)

## [Unreleased] - 2026-09-01

### Added
- **WITR process ancestry enrichment** (bundled binary, zero-config)
  - New "Ancestry" column in the sidebar table shows the parent supervisor chain
    for every listening port (e.g. `systemd → pm2 → node`).
  - Stats bar shows how many ports have ancestry resolved (🔗 icon).
  - New command palette entry **PortPilot: Show Process Ancestry** (`portManager.showAncestry`,
    icon `$(debug-disconnect)`) opens a Quick Pick with the full chain per port.
  - New settings:
    - `portManager.witr.enabled` (default `true`) — disable enrichment globally.
    - `portManager.witr.binaryPath` — override the bundled binary with your own.
  - Per-platform VSIX with the matching WITR static binary bundled inside
    (~2.7 MB per VSIX, ~7 MB binary on disk per platform).
  - New `scripts/download-witr.js` downloads all 6 binaries from upstream
    releases (handles Windows `.zip` extraction).
  - New `scripts/build-platform.js` builds a single per-platform VSIX.
  - `scripts/witr-smoke-test.js` includes an end-to-end integration test
    that opens a real port and runs `witr --port <n> --short` against it.
  - GitHub Actions: `.github/workflows/ci.yml` (lint+validate+test on every PR)
    and `.github/workflows/release.yml` (matrix build + publish on tag).
  - Graceful degradation: missing binary, unsupported platform (e.g. iOS),
    permission-denied (exit code 3), or any error produces a one-time toast
    with an actionable hint — never breaks the port list.
  - Result cache with 3s TTL in `witr/runner.js` prevents spawning `witr` on
    every render cycle when the user toggles refresh rapidly.
  - 3 new i18n keys per locale (`colAncestry`, `ancestryNone`,
    `witrMissing`, `witrPermission`, `statsAncestry`) translated into
    en/es/zh/hi/ar/ja.

### Changed
- `PUBLISH.sh` rewritten from Japanese documentation-only into an executable
  script that downloads WITR, builds 6 VSIX, and optionally publishes each.
- `scripts/download-witr.js` now handles Windows `.zip` assets via `unzip`.
- `.vscodeignore` simplified — per-platform binary exclusion is handled by
  `build-platform.js` deleting non-matching binaries before packaging.
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
