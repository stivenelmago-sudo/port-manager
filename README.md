# ⚡ PortPilot

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/port-manager-saiki.portpilot?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=port-manager-saiki.portpilot)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/port-manager-saiki.portpilot?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=port-manager-saiki.portpilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

---

## ⭐ Smash that Star button — let's make some noise!

> This little extension runs on coffee, late nights, and **GitHub stars**. ☕
> Every star you give makes a stuck port magically free itself somewhere in the world. 🌍✨
> So go ahead — **[hit that ⭐ here](https://github.com/saisai-web/portpilot)** and help us hit the front page!

**🤝 Pull Requests are super welcome!**
Found a bug? Got a wild idea? [Open a PR](https://github.com/saisai-web/portpilot/pulls) — we don't bite. (The ports might, but we promise *we* don't.) 🔌

**👋 Let's connect & grow together!**
Always looking for new friends — I follow back! [Follow me on GitHub](https://github.com/saisai-web), drop a hello, and let's vibe. Mutual follows = mutual good vibes. 🚀

---

**View listening ports, check availability, and kill processes — all inside VS Code.**

No more switching to a terminal to find out what's hogging port 3000. PortPilot gives you a dedicated sidebar panel and quick commands to manage your local ports without leaving your editor.
<img width="851" height="776" alt="スクリーンショット 2026-02-21 11 28 19" src="https://github.com/user-attachments/assets/8cc76ccd-96a3-4cb0-a727-0a54fa258896" />


## Features

### 🔌 Sidebar Panel

A dedicated panel in the Activity Bar showing all listening ports in real time.

- **Search** — Filter by port number or process name instantly
- **Sort** — Click column headers to sort by port, process, PID, or state
- **Kill** — One-click kill with confirmation dialog
- **Bulk Kill** — Select multiple ports and kill them all at once
- **Range Scan** — Check how many ports are free in a given range

### ⌨️ Command Palette

Three commands accessible via `Ctrl+Shift+P` / `Cmd+Shift+P`:

| Command | Description |
|---------|-------------|
| **PortPilot: Show Listening Ports** | Quick Pick list → select a port to kill |
| **PortPilot: Check Port Availability** | Enter a port number → see if it's free or occupied |
| **PortPilot: Kill Port** | Enter port number(s) → kill immediately (comma-separated for bulk) |

### 🎨 Theme Support

Automatically adapts to your VS Code theme — dark, light, or high contrast.

### 🌐 Multi-language Support

UI is available in **6 languages**:

| Language | Code |
|----------|------|
| 🇺🇸 English | `en` |
| 🇪🇸 Español | `es` |
| 🇨🇳 Chinese | `zh` |
| 🇮🇳 हिन्दी | `hi` |
| 🇸🇦 العربية | `ar` (RTL) |
| 🇯🇵 日本語 | `ja` |

The extension automatically follows your VS Code display language. To override, run **PortPilot: Set Language** from the command palette, or set `portManager.language` in your settings.

## Supported Platforms

| Platform | Port Detection | Process Kill |
|----------|---------------|-------------|
| **macOS** | `lsof` | `kill -9` |
| **Linux** | `lsof` / `ss` | `kill -9` |
| **Windows** | `netstat` + `tasklist` | `taskkill /F` |

## Usage Tips

- **Can't kill a port?** On macOS/Linux, some system ports require `sudo`. On Windows, run VS Code as Administrator.
- **Port still showing after kill?** Hit the ↻ Refresh button — the OS may take a moment to release the port.
- **Use Range Scan** to quickly find an available port for your dev server.

## Requirements

- VS Code 1.80.0 or later
- No additional dependencies

## Release Notes

### 1.1.0

- Multi-language UI (English, Español, Chinese, हिन्दी, العربية, 日本語)
- Auto-detect VS Code display language + manual override
- RTL layout for Arabic
- Fixed misleading "Free" stats counter

### 1.0.0

- Initial release
- Sidebar webview panel with search, sort, and kill
- Command palette integration (show / check / kill)
- Cross-platform support (macOS, Windows, Linux)
- Bulk kill support
- Range scan

## Development

### Project Structure

```
src/
├── extension.js          # Entry point
├── core/
│   ├── constants.js      # Constants
│   └── portService.js    # Port detection & management
├── commands/
│   └── index.js          # VS Code commands
├── providers/
│   └── webviewProvider.js # Webview handler
├── i18n/
│   ├── index.js          # i18n API (detect, t, tr)
│   └── messages.js       # Translation dictionary (6 languages)
└── webview/
    ├── index.js          # HTML generator
    ├── styles.js         # CSS
    └── script.js         # Client-side JS

package.nls.json          # Default NLS (English) — VS Code convention
package.nls.es.json       # Spanish NLS
package.nls.zh.json       # Chinese NLS
package.nls.hi.json       # Hindi NLS
package.nls.ar.json       # Arabic NLS
package.nls.ja.json       # Japanese NLS
```

> **Note**: `package.nls.*.json` files must live at the extension root — VS Code looks them up by hardcoded path (`package.json + .nls.{lang}.json`). Moving them to a subfolder breaks native localization of command titles, view names, and configuration descriptions.

### Publishing to VS Code Marketplace

#### 1. Prerequisites

```bash
npm install -g @vscode/vsce
```

#### 2. Create a Publisher (First time only)

1. Go to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers/)
2. Sign in with your Microsoft account
3. Click "Create publisher"
4. Enter Publisher ID and Display Name

#### 3. Create a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Click on your profile icon (top right) → "Personal access tokens"
3. Click "New Token"
4. Configure:
   - **Name**: Any name (e.g., "vsce-publish")
   - **Organization**: Select "All accessible organizations"
   - **Scopes**: Click "Custom defined" → Check "Marketplace" → "Manage"
5. Click "Create" and copy the token (save it securely)

#### 4. Login and Publish

```bash
# Login to your publisher account
vsce login <your-publisher-id>
# Enter your PAT when prompted

# Package the extension (creates .vsix file)
vsce package

# Publish to Marketplace
vsce publish
```

#### 5. Update Version (for subsequent releases)

```bash
# Bump version and publish
vsce publish patch  # 1.0.0 -> 1.0.1
vsce publish minor  # 1.0.0 -> 1.1.0
vsce publish major  # 1.0.0 -> 2.0.0
```

### Notes

- The extension will be available on the Marketplace within a few minutes after publishing
- Make sure to update `CHANGELOG.md` before publishing new versions
- Never commit your PAT to the repository

## License

[MIT](LICENSE)

---

## 👤 About the Maintainer — [@cristopher-dev](https://github.com/cristopher-dev)

**Cristopher Martinez** — Senior developer with 5+ years of experience in education, IoT, legal apps, and banking security. Expert in innovation and automation. Based in Colombia 🇨🇴.

- 🌐 Website: [cristopher-dev.com](https://cristopher-dev.com/)
- 💼 LinkedIn: [in/cristopher-dev](https://www.linkedin.com/in/cristopher-dev)
- 👥 3 followers · 15 following · ⭐ 11 stars given
- 🏆 Achievement: Arctic Code Vault Contributor

### 📊 Profile Overview

| Metric | Value |
|---|---|
| Public repositories | **120** |
| Stars given | 11 |
| Projects | 0 |
| Packages | 0 |

### 🗂️ Repositories Summary

- **Sources:** Mix of original projects and forks from upstream OSS projects (React, Angular, NestJS, OpenSign, Penpot, etc.).
- **Top languages:** TypeScript, JavaScript, Python, Go, PHP, C++, Rust, C, HTML, SCSS, Vue, CSS, Java, Clojure, Ruby, Elixir, Jupyter Notebook.
- **Most recent update:** `invoice-builder` — Aug 24, 2026.
- **Earliest activity tracked:** `tienda-ecommerce-front-end` — Jan 13, 2020.
- **Total stars received** across listed repos: 5 (save-all-resources-plus: 2, port-manager: 1, markdown-to-pdf: 1, pangolin-dev: 1).

### 📚 All 120 Repositories (Last Updated)

| # | Repository | Lang | Stars | Updated | Type | URL |
|---|---|---|---:|---|---|---|
| 1 | invoice-builder | TypeScript | 0 | Aug 24, 2026 | Fork (piratuks/invoice-builder) | [link](https://github.com/cristopher-dev/invoice-builder) |
| 2 | witr | Go | 0 | Jul 31, 2026 | Fork (pranshuparmar/witr) | [link](https://github.com/cristopher-dev/witr) |
| 3 | elementor-mcp | PHP | 0 | Jul 26, 2026 | Fork (msrbuilds/elementor-mcp) | [link](https://github.com/cristopher-dev/elementor-mcp) |
| 4 | football-stadium | HTML | 0 | Jul 18, 2026 | Fork (thebuggeddev/football-stadium) | [link](https://github.com/cristopher-dev/football-stadium) |
| 5 | brightbean-studio | Python | 0 | Jul 12, 2026 | Fork (brightbeanxyz/brightbean-studio) | [link](https://github.com/cristopher-dev/brightbean-studio) |
| 6 | docuseal | Ruby | 0 | Jul 6, 2026 | Fork (docusealco/docuseal) | [link](https://github.com/cristopher-dev/docuseal) |
| 7 | chandra | Python | 0 | Jun 26, 2026 | Fork (datalab-to/chandra) | [link](https://github.com/cristopher-dev/chandra) |
| 8 | PixelRAG | Python | 0 | Jun 23, 2026 | Fork (StarTrail-org/PixelRAG) | [link](https://github.com/cristopher-dev/PixelRAG) |
| 9 | **port-manager** | JavaScript | 1 | Jun 13, 2026 | Fork (saisai-web/port-manager) | [link](https://github.com/cristopher-dev/port-manager) |
| 10 | evilginx2 | Go | 0 | Jun 10, 2026 | Fork (kgretzky/evilginx2) | [link](https://github.com/cristopher-dev/evilginx2) |
| 11 | How-To-Secure-A-Linux-Server | — | 0 | Mar 5, 2026 | Fork (imthenachoman/How-To-Secure-A-Linux-Server) | [link](https://github.com/cristopher-dev/How-To-Secure-A-Linux-Server) |
| 12 | symphony | Elixir | 0 | Mar 5, 2026 | Fork (openai/symphony) | [link](https://github.com/cristopher-dev/symphony) |
| 13 | spark-template | TypeScript | 0 | Feb 28, 2026 | Template (Fork of github/spark-template) | [link](https://github.com/cristopher-dev/spark-template) |
| 14 | ecommerce-tech-haven-back | TypeScript | 0 | Feb 5, 2026 | Original | [link](https://github.com/cristopher-dev/ecommerce-tech-haven-back) |
| 15 | ecommerce-tech-haven-front | TypeScript | 0 | Feb 5, 2026 | Original | [link](https://github.com/cristopher-dev/ecommerce-tech-haven-front) |
| 16 | moltbot | TypeScript | 0 | Jan 28, 2026 | Fork (openclaw/openclaw) | [link](https://github.com/cristopher-dev/moltbot) |
| 17 | penpot | Clojure | 0 | Nov 19, 2025 | Fork (penpot/penpot) | [link](https://github.com/cristopher-dev/penpot) |
| 18 | system_prompts_leaks | JavaScript | 0 | Aug 26, 2025 | Fork (asgeirtj/system_prompts_leaks) | [link](https://github.com/cristopher-dev/system_prompts_leaks) |
| 19 | clamav | C | 0 | Aug 21, 2025 | Fork (Cisco-Talos/clamav) | [link](https://github.com/cristopher-dev/clamav) |
| 20 | awesome-copilot-dev | JavaScript | 0 | Aug 14, 2025 | Fork (github/awesome-copilot) | [link](https://github.com/cristopher-dev/awesome-copilot-dev) |
| 21 | save-all-resources-plus | JavaScript | 2 | Aug 3, 2025 | Fork (up209d/ResourcesSaverExt) | [link](https://github.com/cristopher-dev/save-all-resources-plus) |
| 22 | playwright-mcp | TypeScript | 0 | Aug 2, 2025 | Fork (microsoft/playwright-mcp) | [link](https://github.com/cristopher-dev/playwright-mcp) |
| 23 | OpenSign-dev | JavaScript | 0 | Jul 31, 2025 | Fork (OpenSignLabs/OpenSign) | [link](https://github.com/cristopher-dev/OpenSign-dev) |
| 24 | BillionMail-dev | Go | 0 | Jul 31, 2025 | Fork (Billionmail/BillionMail) | [link](https://github.com/cristopher-dev/BillionMail-dev) |
| 25 | tabler-dev | HTML | 0 | Jul 30, 2025 | Fork (tabler/tabler) | [link](https://github.com/cristopher-dev/tabler-dev) |
| 26 | drawdb-dev | JavaScript | 0 | Jul 29, 2025 | Fork (drawdb-io/drawdb) | [link](https://github.com/cristopher-dev/drawdb-dev) |
| 27 | Whisper-WebUI-dev | Python | 0 | Jul 26, 2025 | Fork (jhj0517/Whisper-WebUI) | [link](https://github.com/cristopher-dev/Whisper-WebUI-dev) |
| 28 | google-maps-scraper-dev | Go | 0 | Jul 26, 2025 | Fork (gosom/google-maps-scraper) | [link](https://github.com/cristopher-dev/google-maps-scraper-dev) |
| 29 | react-dev | JavaScript | 0 | Jul 25, 2025 | Fork (react/react) | [link](https://github.com/cristopher-dev/react-dev) |
| 30 | ProjectVisBug-dev | JavaScript | 0 | Jul 21, 2025 | Fork (GoogleChromeLabs/ProjectVisBug) | [link](https://github.com/cristopher-dev/ProjectVisBug-dev) |
| 31 | network-scanner-dev | TypeScript | 0 | Jul 19, 2025 | Original | [link](https://github.com/cristopher-dev/network-scanner-dev) |
| 32 | screenGRAB-dev | SCSS | 0 | Jul 17, 2025 | Fork (heysagnik/screenREC) | [link](https://github.com/cristopher-dev/screenGRAB-dev) |
| 33 | glass-dev | JavaScript | 0 | Jul 11, 2025 | Fork (pickle-com/glass) | [link](https://github.com/cristopher-dev/glass-dev) |
| 34 | 21st-extension-dev | TypeScript | 0 | Jul 7, 2025 | Fork (21st-dev/21st-extension) | [link](https://github.com/cristopher-dev/21st-extension-dev) |
| 35 | awesome-shadcn-ui-dev | JavaScript | 0 | Jul 7, 2025 | Fork (birobirobiro/awesome-shadcn-ui) | [link](https://github.com/cristopher-dev/awesome-shadcn-ui-dev) |
| 36 | tunnelmole-client-dev | TypeScript | 0 | Jun 24, 2025 | Fork (robbie-cahill/tunnelmole-client) | [link](https://github.com/cristopher-dev/tunnelmole-client-dev) |
| 37 | vscode-office-dev | JavaScript | 0 | Jun 19, 2025 | Fork (cweijan/vscode-office) | [link](https://github.com/cristopher-dev/vscode-office-dev) |
| 38 | holidays-dev | Python | 0 | Jun 18, 2025 | Fork (vacanza/holidays) | [link](https://github.com/cristopher-dev/holidays-dev) |
| 39 | date-holidays | JavaScript | 0 | Jun 17, 2025 | Original | [link](https://github.com/cristopher-dev/date-holidays) |
| 40 | date-holidays-dev | JavaScript | 0 | Jun 12, 2025 | Fork (commenthol/date-holidays) | [link](https://github.com/cristopher-dev/date-holidays-dev) |
| 41 | react-file-manager | JavaScript | 0 | Jun 9, 2025 | Fork (Saifullah-dev/react-file-manager) | [link](https://github.com/cristopher-dev/react-file-manager) |
| 42 | youtube-music | TypeScript | 0 | May 28, 2025 | Fork (pear-devs/pear-desktop) | [link](https://github.com/cristopher-dev/youtube-music) |
| 43 | cine-todo | TypeScript | 0 | May 19, 2025 | Original | [link](https://github.com/cristopher-dev/cine-todo) |
| 44 | markdown-to-pdf | JavaScript | 1 | May 16, 2025 | Original | [link](https://github.com/cristopher-dev/markdown-to-pdf) |
| 45 | Scraperr-dev | TypeScript | 0 | May 15, 2025 | Fork (jaypyles/Scraperr) | [link](https://github.com/cristopher-dev/Scraperr-dev) |
| 46 | WorldGen-dev | Python | 0 | May 10, 2025 | Fork (ZiYang-xie/WorldGen) | [link](https://github.com/cristopher-dev/WorldGen-dev) |
| 47 | noVNC-dev | JavaScript | 0 | May 7, 2025 | Fork (novnc/noVNC) | [link](https://github.com/cristopher-dev/noVNC-dev) |
| 48 | filepizza-dev | TypeScript | 0 | May 5, 2025 | Fork (kern/filepizza) | [link](https://github.com/cristopher-dev/filepizza-dev) |
| 49 | ml-fastvlm | Python | 0 | May 5, 2025 | Fork (apple/ml-fastvlm) | [link](https://github.com/cristopher-dev/ml-fastvlm) |
| 50 | vosk-api-dev | Jupyter Notebook | 0 | May 1, 2025 | Fork (alphacep/vosk-api) | [link](https://github.com/cristopher-dev/vosk-api-dev) |
| 51 | pangolin-dev | TypeScript | 1 | Apr 9, 2025 | Fork (fosrl/pangolin) | [link](https://github.com/cristopher-dev/pangolin-dev) |
| 52 | gurubase-dev | Python | 0 | Apr 2, 2025 | Fork (sikkgit/gurubase) | [link](https://github.com/cristopher-dev/gurubase-dev) |
| 53 | nanobrowser-dev | TypeScript | 0 | Mar 31, 2025 | Fork (nanobrowser/nanobrowser) | [link](https://github.com/cristopher-dev/nanobrowser-dev) |
| 54 | firecrawl-dev | TypeScript | 0 | Mar 21, 2025 | Fork (firecrawl/firecrawl) | [link](https://github.com/cristopher-dev/firecrawl-dev) |
| 55 | awesome-llm-apps-dev | Python | 0 | Mar 17, 2025 | Fork (Shubhamsaboo/awesome-llm-apps) | [link](https://github.com/cristopher-dev/awesome-llm-apps-dev) |
| 56 | theme-collection-dev | SCSS | 0 | Mar 11, 2025 | Fork (node-red-contrib-themes/theme-collection) | [link](https://github.com/cristopher-dev/theme-collection-dev) |
| 57 | 3FS-dev | C++ | 0 | Mar 8, 2025 | Fork (deepseek-ai/3FS) | [link](https://github.com/cristopher-dev/3FS-dev) |
| 58 | Distill-Any-Depth-dev | Python | 0 | Mar 6, 2025 | Fork (Westlake-AGI-Lab/Distill-Any-Depth) | [link](https://github.com/cristopher-dev/Distill-Any-Depth-dev) |
| 59 | AI-COSS-dev | — | 0 | Mar 5, 2025 | Fork (potpie-ai/AI-COSS) | [link](https://github.com/cristopher-dev/AI-COSS-dev) |
| 60 | twenty-dev | TypeScript | 0 | Mar 3, 2025 | Fork (twentyhq/twenty) | [link](https://github.com/cristopher-dev/twenty-dev) |
| 61 | invoify-dev | TypeScript | 0 | Feb 28, 2025 | Fork (al1abb/invoify) | [link](https://github.com/cristopher-dev/invoify-dev) |
| 62 | tinywebp-dev | TypeScript | 0 | Feb 27, 2025 | Fork (IamIsPra/tinywebp) | [link](https://github.com/cristopher-dev/tinywebp-dev) |
| 63 | node-red-dashboard-dev | HTML | 0 | Feb 20, 2025 | Fork (FlowFuse/node-red-dashboard) | [link](https://github.com/cristopher-dev/node-red-dashboard-dev) |
| 64 | solidtime-dev | PHP | 0 | Feb 18, 2025 | Fork (solidtime-io/solidtime) | [link](https://github.com/cristopher-dev/solidtime-dev) |
| 65 | wg-easy-dev | JavaScript | 0 | Feb 12, 2025 | Fork (wg-easy/wg-easy) | [link](https://github.com/cristopher-dev/wg-easy-dev) |
| 66 | rustdesk-dev | Rust | 0 | Feb 4, 2025 | Fork (rustdesk/rustdesk) | [link](https://github.com/cristopher-dev/rustdesk-dev) |
| 67 | notebooks-dev | Jupyter Notebook | 0 | Jan 30, 2025 | Fork (roboflow/notebooks) | [link](https://github.com/cristopher-dev/notebooks-dev) |
| 68 | awesome-cursorrules-dev | — | 0 | Jan 29, 2025 | Fork (PatrickJS/awesome-cursorrules) | [link](https://github.com/cristopher-dev/awesome-cursorrules-dev) |
| 69 | browser-use-dev | Python | 0 | Jan 28, 2025 | Fork (browser-use/browser-use) | [link](https://github.com/cristopher-dev/browser-use-dev) |
| 70 | open-operator-dev | TypeScript | 0 | Jan 28, 2025 | Fork (browserbase/open-operator) | [link](https://github.com/cristopher-dev/open-operator-dev) |
| 71 | Janus-dev | Python | 0 | Jan 27, 2025 | Fork (deepseek-ai/Janus) | [link](https://github.com/cristopher-dev/Janus-dev) |
| 72 | aptabase-dev | TypeScript | 0 | Jan 27, 2025 | Fork (aptabase/aptabase) | [link](https://github.com/cristopher-dev/aptabase-dev) |
| 73 | nest-dev | TypeScript | 0 | Jan 23, 2025 | Fork (nestjs/nest) | [link](https://github.com/cristopher-dev/nest-dev) |
| 74 | electron-react-base | TypeScript | 0 | Jan 22, 2025 | Original | [link](https://github.com/cristopher-dev/electron-react-base) |
| 75 | Photo-Sphere-Viewer | TypeScript | 0 | Jan 17, 2025 | Fork (mistic100/Photo-Sphere-Viewer) | [link](https://github.com/cristopher-dev/Photo-Sphere-Viewer) |
| 76 | automa-dev | Vue | 0 | Jan 16, 2025 | Fork (AutomaApp/automa) | [link](https://github.com/cristopher-dev/automa-dev) |
| 77 | primereact | CSS | 0 | Jan 13, 2025 | Fork (primefaces/primereact) | [link](https://github.com/cristopher-dev/primereact) |
| 78 | shadcn-ui-blocks-dev | TypeScript | 0 | Jan 12, 2025 | Fork (akash3444/shadcn-ui-blocks) | [link](https://github.com/cristopher-dev/shadcn-ui-blocks-dev) |
| 79 | shadcn-admin | TypeScript | 0 | Dec 28, 2024 | Fork (satnaing/shadcn-admin) | [link](https://github.com/cristopher-dev/shadcn-admin) |
| 80 | V0-system-prompt | — | 0 | Dec 2, 2024 | Fork (2-fly-4-ai/V0-system-prompt) | [link](https://github.com/cristopher-dev/V0-system-prompt) |
| 81 | smollm | Python | 0 | Dec 2, 2024 | Fork (huggingface/smollm) | [link](https://github.com/cristopher-dev/smollm) |
| 82 | Deep-Live-Cam | Python | 0 | Nov 30, 2024 | Fork (hacksider/Deep-Live-Cam) | [link](https://github.com/cristopher-dev/Deep-Live-Cam) |
| 83 | node-red-contrib-oauth2-dev | JavaScript | 0 | Nov 28, 2024 | Fork (caputomarcos/node-red-contrib-oauth2) | [link](https://github.com/cristopher-dev/node-red-contrib-oauth2-dev) |
| 84 | ggwave-dev | C++ | 0 | Nov 16, 2024 | Fork (ggerganov/ggwave) | [link](https://github.com/cristopher-dev/ggwave-dev) |
| 85 | ePayco | TypeScript | 0 | Oct 25, 2024 | Original | [link](https://github.com/cristopher-dev/ePayco) |
| 86 | plugin-node-red | JavaScript | 0 | Oct 1, 2024 | Original | [link](https://github.com/cristopher-dev/plugin-node-red) |
| 87 | list-todo | TypeScript | 0 | Sep 18, 2024 | Original | [link](https://github.com/cristopher-dev/list-todo) |
| 88 | ip-evento-red-local | JavaScript | 0 | Aug 21, 2024 | Original | [link](https://github.com/cristopher-dev/ip-evento-red-local) |
| 89 | cristopher-dev | — | 0 | Aug 9, 2024 | Profile repo | [link](https://github.com/cristopher-dev/cristopher-dev) |
| 90 | anything-llm | JavaScript | 0 | May 22, 2024 | Fork (Mintplex-Labs/anything-llm) | [link](https://github.com/cristopher-dev/anything-llm) |
| 91 | OOTDiffusion-dev | Python | 0 | May 13, 2024 | Fork (levihsu/OOTDiffusion) | [link](https://github.com/cristopher-dev/OOTDiffusion-dev) |
| 92 | test-pichincha | TypeScript | 0 | Mar 4, 2024 | Original | [link](https://github.com/cristopher-dev/test-pichincha) |
| 93 | EMO | — | 0 | Feb 28, 2024 | Fork (HumanAIGC/EMO) | [link](https://github.com/cristopher-dev/EMO) |
| 94 | node-red-dev | JavaScript | 0 | Feb 6, 2024 | Fork (node-red/node-red) | [link](https://github.com/cristopher-dev/node-red-dev) |
| 95 | nocodb-dev | TypeScript | 0 | Feb 6, 2024 | Fork (nocodb/nocodb) | [link](https://github.com/cristopher-dev/nocodb-dev) |
| 96 | excalidraw-dev | TypeScript | 0 | Feb 6, 2024 | Fork (excalidraw/excalidraw) | [link](https://github.com/cristopher-dev/excalidraw-dev) |
| 97 | grapesjs-dev | TypeScript | 0 | Feb 3, 2024 | Fork (GrapesJS/grapesjs) | [link](https://github.com/cristopher-dev/grapesjs-dev) |
| 98 | proelements-dev | JavaScript | 0 | Jan 30, 2024 | Fork (proelements/proelements) | [link](https://github.com/cristopher-dev/proelements-dev) |
| 99 | netflix-clone-react-typescript | TypeScript | 0 | Jan 26, 2024 | Fork (jason-liu22/netflix-clone-react-typescript) | [link](https://github.com/cristopher-dev/netflix-clone-react-typescript) |
| 100 | Stirling-PDF | Java | 0 | Jan 2, 2024 | Fork (Stirling-Tools/Stirling-PDF) | [link](https://github.com/cristopher-dev/Stirling-PDF) |
| 101 | grapesjs-icons | TypeScript | 0 | Dec 28, 2023 | Fork (bgrand-ch/grapesjs-icons) | [link](https://github.com/cristopher-dev/grapesjs-icons) |
| 102 | backend | PHP | 0 | Dec 27, 2023 | Original | [link](https://github.com/cristopher-dev/backend) |
| 103 | transformers.js | JavaScript | 0 | Nov 10, 2023 | Fork (huggingface/transformers.js) | [link](https://github.com/cristopher-dev/transformers.js) |
| 104 | grapesjs-template-manager | JavaScript | 0 | Jul 1, 2023 | Fork (Ju99ernaut/grapesjs-template-manager) | [link](https://github.com/cristopher-dev/grapesjs-template-manager) |
| 105 | nvm | Shell | 0 | May 6, 2023 | Fork (nvm-sh/nvm) | [link](https://github.com/cristopher-dev/nvm) |
| 106 | Alpaca-LoRA-Serve | Python | 0 | Mar 30, 2023 | Fork (deepanshu88/Alpaca-LoRA-Serve) | [link](https://github.com/cristopher-dev/Alpaca-LoRA-Serve) |
| 107 | angular | TypeScript | 0 | Feb 28, 2023 | Fork (angular/angular) | [link](https://github.com/cristopher-dev/angular) |
| 108 | react-native-panorama-view | Swift | 0 | Jan 6, 2023 | Fork (lightbasenl/react-native-panorama-view) | [link](https://github.com/cristopher-dev/react-native-panorama-view) |
| 109 | formulario-registro--consumo-api-NODEJS | TypeScript | 0 | Dec 11, 2022 | Original | [link](https://github.com/cristopher-dev/formulario-registro--consumo-api-NODEJS) |
| 110 | Method-Draw | JavaScript | 0 | Aug 4, 2022 | Fork (methodofaction/Method-Draw) | [link](https://github.com/cristopher-dev/Method-Draw) |
| 111 | grapesjs-blocks-basic | JavaScript | 0 | Jul 14, 2022 | Fork (GrapesJS/blocks-basic) | [link](https://github.com/cristopher-dev/grapesjs-blocks-basic) |
| 112 | electron-vite-react | TypeScript | 0 | Jul 13, 2022 | Template (Fork of electron-vite/electron-vite-react) | [link](https://github.com/cristopher-dev/electron-vite-react) |
| 113 | sstest-be | TypeScript | 0 | Feb 7, 2022 | Original | [link](https://github.com/cristopher-dev/sstest-be) |
| 114 | SSTestFE | TypeScript | 0 | Feb 6, 2022 | Original | [link](https://github.com/cristopher-dev/SSTestFE) |
| 115 | desafio-2-2021 | — | 0 | Nov 20, 2021 | Fork (maratonadev/desafio-2-2021) | [link](https://github.com/cristopher-dev/desafio-2-2021) |
| 116 | node | JavaScript | 0 | May 1, 2021 | Fork (nodejs/node) | [link](https://github.com/cristopher-dev/node) |
| 117 | TIENDA-OLINE | TypeScript | 0 | Jun 24, 2020 | Original | [link](https://github.com/cristopher-dev/TIENDA-OLINE) |
| 118 | consumo--api-swapi-front-end | JavaScript | 0 | May 8, 2020 | Original | [link](https://github.com/cristopher-dev/consumo--api-swapi-front-end) |
| 119 | consumo-api-rest | — | 0 | Mar 17, 2020 | Original | [link](https://github.com/cristopher-dev/consumo-api-rest) |
| 120 | tienda-ecommerce-front-end | CSS | 0 | Jan 13, 2020 | Original | [link](https://github.com/cristopher-dev/tienda-ecommerce-front-end) |

> **Note on data:** Stars column reflects the GitHub "stargazers" count shown on the listing page (which GitHub only displays when count ≥ 1). The `port-manager` row is highlighted as it corresponds to this very repository.

> Source: [github.com/cristopher-dev?tab=repositories](https://github.com/cristopher-dev?tab=repositories) — synced Sep 1, 2026.
