#!/usr/bin/env node
/**
 * Functional test for the MCP auto-configuration logic.
 *
 * Exercises:
 *   - buildServerEntry produces the expected shape
 *   - registerInConfigFile is idempotent (second call reports "already")
 *   - autoConfigure touches a real file in a temp HOME and reports per-file
 *     status
 *   - shouldSkip respects the PORTPILOT_SKIP_AUTOCONFIG env var
 *   - ensureWitrBinary detects an already-present binary without network
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const autoConfig = require(path.join(ROOT, "src/mcp/autoConfig"));

let passed = 0;
let failed = 0;
function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function bad(label, err) { console.log(`  ✗ ${label}${err ? ": " + err : ""}`); failed++; }
function check(label, cond, detail) { cond ? ok(label) : bad(label, detail); }

function makeTempHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portpilot-ac-"));
  return dir;
}

function main() {
  console.log("=== AUTO-CONFIG TESTS ===\n");
  const origHome = process.env.HOME;
  const origAppData = process.env.APPDATA;

  // 1. buildServerEntry
  console.log("1. buildServerEntry:");
  const entry = autoConfig.buildServerEntry("/abs/path/mcp-server/index.js");
  check("command is process.execPath", entry.command === process.execPath);
  check("args contains the entry path", Array.isArray(entry.args) && entry.args[0] === "/abs/path/mcp-server/index.js");

  // 2. shouldSkip honours env
  console.log("\n2. shouldSkip:");
  const prev = process.env.PORTPILOT_SKIP_AUTOCONFIG;
  try {
    process.env.PORTPILOT_SKIP_AUTOCONFIG = "1";
    check("returns true when env=1", autoConfig.shouldSkip() === true);
    process.env.PORTPILOT_SKIP_AUTOCONFIG = "false";
    check("returns false when env=false", autoConfig.shouldSkip() === false);
    delete process.env.PORTPILOT_SKIP_AUTOCONFIG;
    check("returns false when env unset", autoConfig.shouldSkip() === false);
  } finally {
    if (prev === undefined) delete process.env.PORTPILOT_SKIP_AUTOCONFIG;
    else process.env.PORTPILOT_SKIP_AUTOCONFIG = prev;
  }

  // 3. registerInConfigFile + idempotency
  console.log("\n3. registerInConfigFile idempotency:");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "portpilot-acf-"));
  const target = path.join(tmp, "kilo", "mcp.json");
  const mcpEntry = path.join(ROOT, "mcp-server", "index.js");
  const r1 = autoConfig.registerInConfigFile(target, autoConfig.buildServerEntry(mcpEntry));
  check("first call registers", r1.status === "registered" && fs.existsSync(target));
  const r2 = autoConfig.registerInConfigFile(target, autoConfig.buildServerEntry(mcpEntry));
  check("second call reports already", r2.status === "already");
  const cfg = JSON.parse(fs.readFileSync(target, "utf8"));
  check("config contains portpilot entry",
    cfg && cfg.mcpServers && cfg.mcpServers.portpilot && cfg.mcpServers.portpilot.args[0] === mcpEntry);

  // 4. autoConfigure with a custom HOME
  console.log("\n4. autoConfigure with custom HOME:");
  const home = makeTempHome();
  process.env.HOME = home;
  process.env.APPDATA = home; // make the Windows branch also point at tmp
  try {
    const results = autoConfig.autoConfigure({
      mcpEntry,
      workspaceDir: undefined,
      allowWorkspaceWrite: false,
    });
    check("produces results", Array.isArray(results) && results.length > 0);
    const kilo = path.join(home, ".config", "kilo", "mcp.json");
    const claudeCode = path.join(home, ".claude.json");
    check("wrote kilo mcp.json", fs.existsSync(kilo));
    check("wrote claude code config", fs.existsSync(claudeCode));
    // Idempotent re-run
    const r2 = autoConfig.autoConfigure({ mcpEntry, workspaceDir: undefined });
    const allAlready = r2.every((r) => r.status === "already");
    check("second run is fully idempotent", allAlready, JSON.stringify(r2));
  } finally {
    process.env.HOME = origHome;
    process.env.APPDATA = origAppData;
    fs.rmSync(home, { recursive: true, force: true });
  }

  // 5. ensureWitrBinary detects present binary without download
  console.log("\n5. ensureWitrBinary (no network):");
  // (deferred until the per-platform block finishes so we can keep going)

  // 6. Per-platform candidate paths (with explicit all-clients filter)
  console.log("\n6. per-platform candidate paths:");
  const pHome = makeTempHome();
  process.env.HOME = pHome;
  process.env.APPDATA = pHome;
  const allClients = new Set(["vscode", "copilot", "cursor", "antigravity", "kilo", "claude-code", "claude-desktop"]);
  try {
    const linuxFiles = autoConfig.candidateFilesForClients(undefined, "linux", allClients, { home: pHome });
    check("linux includes ~/.config/Code/User/mcp.json", linuxFiles.includes(path.join(pHome, ".config", "Code", "User", "mcp.json")));
    check("linux includes Insiders", linuxFiles.includes(path.join(pHome, ".config", "Code - Insiders", "User", "mcp.json")));
    check("linux includes ~/.config/Claude/...", linuxFiles.some((f) => f.endsWith(path.join(".config", "Claude", "claude_desktop_config.json"))));
    check("linux does NOT include ~/Library/...", !linuxFiles.some((f) => f.includes("Library")));

    const macFiles = autoConfig.candidateFilesForClients(undefined, "darwin", allClients, { home: pHome });
    check("mac includes ~/Library/.../Code/User/mcp.json", macFiles.includes(path.join(pHome, "Library", "Application Support", "Code", "User", "mcp.json")));
    check("mac includes Code - Insiders", macFiles.includes(path.join(pHome, "Library", "Application Support", "Code - Insiders", "User", "mcp.json")));
    check("mac includes Claude Desktop app-support", macFiles.includes(path.join(pHome, "Library", "Application Support", "Claude", "claude_desktop_config.json")));
    check("mac does NOT include ~/.config/Code/...", !macFiles.includes(path.join(pHome, ".config", "Code", "User", "mcp.json")));

    const winFiles = autoConfig.candidateFilesForClients(undefined, "win32", allClients, { home: pHome, appData: pHome });
    check("win32 includes %APPDATA%\\Code\\User\\mcp.json", winFiles.includes(path.join(pHome, "Code", "User", "mcp.json")));
    check("win32 includes Code - Insiders", winFiles.includes(path.join(pHome, "Code - Insiders", "User", "mcp.json")));
    check("win32 includes %APPDATA%\\Claude\\claude_desktop_config.json", winFiles.includes(path.join(pHome, "Claude", "claude_desktop_config.json")));
    check("win32 does NOT include ~/Library/...", !winFiles.some((f) => f.includes("Library")));
  } finally {
    process.env.HOME = origHome;
    process.env.APPDATA = origAppData;
    fs.rmSync(pHome, { recursive: true, force: true });
  }

  // 7. iOS guard
  console.log("\n7. iOS guard:");
  const home2 = makeTempHome();
  process.env.HOME = home2;
  process.env.APPDATA = home2;
  try {
    const iosResults = autoConfig.autoConfigure({
      mcpEntry: path.join(ROOT, "mcp-server", "index.js"),
      workspaceDir: undefined,
      platform: "ios",
    });
    check("ios autoConfigure returns empty array", Array.isArray(iosResults) && iosResults.length === 0);
    check("isSupportedPlatform('ios') is false", autoConfig.isSupportedPlatform("ios") === false);
    check("isSupportedPlatform('linux') is true", autoConfig.isSupportedPlatform("linux") === true);
    check("isSupportedPlatform('darwin') is true", autoConfig.isSupportedPlatform("darwin") === true);
    check("isSupportedPlatform('win32') is true", autoConfig.isSupportedPlatform("win32") === true);
    const iosFiles = autoConfig.candidateFiles(undefined, "ios");
    check("ios candidateFiles returns empty list", iosFiles.length === 0);
  } finally {
    process.env.HOME = origHome;
    process.env.APPDATA = origAppData;
    fs.rmSync(home2, { recursive: true, force: true });
  }

  // 8. autoConfigure with explicit Windows platform + all clients
  console.log("\n8. autoConfigure on win32 (mocked platform, all clients):");
  const home3 = makeTempHome();
  process.env.HOME = home3;
  process.env.APPDATA = home3;
  try {
    const winResults = autoConfig.autoConfigure({
      mcpEntry: path.join(ROOT, "mcp-server", "index.js"),
      workspaceDir: undefined,
      platform: "win32",
      clients: allClients,
      home: home3,
      appData: home3,
    });
    check("wrote win32 VS Code user mcp.json", fs.existsSync(path.join(home3, "Code", "User", "mcp.json")));
    check("wrote win32 Claude Desktop config", fs.existsSync(path.join(home3, "Claude", "claude_desktop_config.json")));
    const winCfg = JSON.parse(fs.readFileSync(path.join(home3, "Code", "User", "mcp.json"), "utf8"));
    check("win32 entry uses forward-slash-free absolute path", winCfg.mcpServers.portpilot.args[0].includes("mcp-server"));
    check("win32 wrote Cursor config", fs.existsSync(path.join(home3, "Cursor", "User", "mcp.json")));
    check("win32 wrote Antigravity config", fs.existsSync(path.join(home3, "Antigravity", "mcp.json")));
  } finally {
    process.env.HOME = origHome;
    process.env.APPDATA = origAppData;
    fs.rmSync(home3, { recursive: true, force: true });
  }

  // 9. autoConfigure on darwin (mocked, all clients)
  console.log("\n9. autoConfigure on darwin (mocked platform, all clients):");
  const home4 = makeTempHome();
  process.env.HOME = home4;
  process.env.APPDATA = home4;
  try {
    autoConfig.autoConfigure({
      mcpEntry: path.join(ROOT, "mcp-server", "index.js"),
      workspaceDir: undefined,
      platform: "darwin",
      clients: allClients,
      home: home4,
      appData: home4,
    });
    check("wrote darwin VS Code user mcp.json", fs.existsSync(path.join(home4, "Library", "Application Support", "Code", "User", "mcp.json")));
    check("wrote darwin Claude Desktop app-support", fs.existsSync(path.join(home4, "Library", "Application Support", "Claude", "claude_desktop_config.json")));
    check("wrote darwin Cursor User mcp.json", fs.existsSync(path.join(home4, "Library", "Application Support", "Cursor", "User", "mcp.json")));
    check("wrote darwin Antigravity config", fs.existsSync(path.join(home4, "Library", "Application Support", "Antigravity", "mcp.json")));
  } finally {
    process.env.HOME = origHome;
    process.env.APPDATA = origAppData;
    fs.rmSync(home4, { recursive: true, force: true });
  }

  // 10. detectClients via appName
  console.log("\n10. detectClients(appName):");
  const emptyHome = makeTempHome();
  try {
    const r1 = autoConfig.detectClients({ home: emptyHome, appData: emptyHome, appName: "Visual Studio Code" });
    check("vscode detected from appName 'Visual Studio Code'", r1.has("vscode"));
    check("copilot also tagged when vscode present", r1.has("copilot"));
    const r2 = autoConfig.detectClients({ home: emptyHome, appData: emptyHome, appName: "Cursor" });
    check("cursor detected from appName 'Cursor'", r2.has("cursor"));
    const r3 = autoConfig.detectClients({ home: emptyHome, appData: emptyHome, appName: "Antigravity" });
    check("antigravity detected from appName 'Antigravity'", r3.has("antigravity"));
    const r4 = autoConfig.detectClients({ home: emptyHome, appData: emptyHome, appName: "UnknownApp" });
    check("unknown app name still includes defaults (claude-code, claude-desktop, kilo)", r4.has("claude-code") && r4.has("kilo") && r4.has("claude-desktop"));
  } finally {
    fs.rmSync(emptyHome, { recursive: true, force: true });
  }

  // 11. detectClients via filesystem markers
  console.log("\n11. detectClients(filesystem):");
  const markerHome = makeTempHome();
  try {
    process.env.HOME = markerHome;
    process.env.APPDATA = markerHome;
    fs.mkdirSync(path.join(markerHome, ".cursor"), { recursive: true });
    const r1 = autoConfig.detectClients({ home: markerHome, appData: markerHome, appName: "UnknownEditor" });
    check("~/.cursor presence triggers cursor detection", r1.has("cursor"));
    fs.mkdirSync(path.join(markerHome, ".antigravity"), { recursive: true });
    const r2 = autoConfig.detectClients({ home: markerHome, appData: markerHome, appName: "UnknownEditor" });
    check("~/.antigravity presence triggers antigravity detection", r2.has("antigravity"));
    fs.mkdirSync(path.join(markerHome, ".config", "Code"), { recursive: true });
    const r3 = autoConfig.detectClients({ home: markerHome, appData: markerHome, appName: "UnknownEditor" });
    check("~/.config/Code presence triggers vscode detection", r3.has("vscode") && r3.has("copilot"));
  } finally {
    process.env.HOME = origHome;
    process.env.APPDATA = origAppData;
    fs.rmSync(markerHome, { recursive: true, force: true });
  }

  // 12. per-client file paths on each platform
  console.log("\n12. candidateFilesForClients per client:");
  {
    const home = makeTempHome();
    const linuxFiles = autoConfig.candidateFilesForClients(undefined, "linux", new Set(["vscode", "copilot", "cursor", "antigravity", "kilo", "claude-code", "claude-desktop"]), { home });
    const macFiles = autoConfig.candidateFilesForClients(undefined, "darwin", new Set(["vscode", "copilot", "cursor", "antigravity", "kilo", "claude-code", "claude-desktop"]), { home });
    const winFiles = autoConfig.candidateFilesForClients(undefined, "win32", new Set(["vscode", "copilot", "cursor", "antigravity", "kilo", "claude-code", "claude-desktop"]), { home, appData: home });

    check("linux: VS Code user mcp.json", linuxFiles.includes(path.join(home, ".config", "Code", "User", "mcp.json")));
    check("linux: Cursor user mcp.json", linuxFiles.includes(path.join(home, ".config", "Cursor", "User", "mcp.json")));
    check("linux: Cursor legacy ~/.cursor/mcp.json", linuxFiles.includes(path.join(home, ".cursor", "mcp.json")));
    check("linux: Antigravity config", linuxFiles.includes(path.join(home, ".config", "antigravity", "mcp.json")));

    check("mac: Cursor User mcp.json", macFiles.includes(path.join(home, "Library", "Application Support", "Cursor", "User", "mcp.json")));
    check("mac: Antigravity in Application Support", macFiles.includes(path.join(home, "Library", "Application Support", "Antigravity", "mcp.json")));

    check("win: Cursor mcp.json under %APPDATA%", winFiles.includes(path.join(home, "Cursor", "User", "mcp.json")));
    check("win: Antigravity mcp.json under %APPDATA%", winFiles.includes(path.join(home, "Antigravity", "mcp.json")));

    // Filtering: only Cursor installed
    const onlyCursor = autoConfig.candidateFilesForClients(undefined, "linux", new Set(["cursor"]), { home });
    check("only-cursor filter excludes vscode paths", !onlyCursor.some((f) => f.includes("Code/User")));
    check("only-cursor filter includes cursor path", onlyCursor.includes(path.join(home, ".config", "Cursor", "User", "mcp.json")));
    check("only-cursor filter excludes kilo (not selected)", !onlyCursor.includes(path.join(home, ".kilo", "mcp.json")));

    fs.rmSync(home, { recursive: true, force: true });
  }

  // 13. autoConfigure writes to a Cursor-only set
  console.log("\n13. autoConfigure with cursor-only clients filter:");
  {
    const home = makeTempHome();
    process.env.HOME = home;
    process.env.APPDATA = home;
    try {
      autoConfig.autoConfigure({
        mcpEntry: path.join(ROOT, "mcp-server", "index.js"),
        platform: "linux",
        workspaceDir: undefined,
        clients: new Set(["cursor", "kilo"]), // explicitly limit
        home,
        appData: home,
      });
      check("wrote Cursor user config", fs.existsSync(path.join(home, ".config", "Cursor", "User", "mcp.json")));
      check("wrote Kilo config", fs.existsSync(path.join(home, ".config", "kilo", "mcp.json")));
      check("did NOT write Antigravity (not in filter)", !fs.existsSync(path.join(home, ".config", "antigravity", "mcp.json")));
      // Idempotent — second call must report already
      const r2 = autoConfig.autoConfigure({
        mcpEntry: path.join(ROOT, "mcp-server", "index.js"),
        platform: "linux",
        clients: new Set(["cursor", "kilo"]),
        home,
        appData: home,
      });
      check("second run is fully idempotent", r2.every((r) => r.status === "already"));
    } finally {
      process.env.HOME = origHome;
      process.env.APPDATA = origAppData;
      fs.rmSync(home, { recursive: true, force: true });
    }
  }

  // 14. WITR downloader — pick the right target per platform
  console.log("\n14. downloadWitr.TARGETS per platform:");
  const { TARGETS } = require(path.join(ROOT, "src/mcp/downloadWitr"));
  check("linux+x64 -> witr-linux-amd64", TARGETS["linux:x64"] === undefined && TARGETS["linux:amd64"] === "witr-linux-amd64");
  check("darwin+arm64 -> witr-darwin-arm64", TARGETS["darwin:arm64"] === "witr-darwin-arm64");
  check("win32+amd64 is a zip descriptor", typeof TARGETS["win32:amd64"] === "object" && TARGETS["win32:amd64"].file === "witr-windows-amd64.zip");

  // 15. Zip extraction (Windows path) — the downloader uses `tar -xf` on
  //     Windows because tar ships with Win10 1803+ and supports zip, and
  //     falls back to PowerShell's Expand-Archive if tar fails. This test
  //     runs only on hosts where the system tar advertises zip support
  //     (Win11 / libarchive-backed tar). On hosts with plain GNU tar we
  //     skip it — the same code path still runs on the user's Win11 box
  //     where it does work.
  console.log("\n11. zip extraction (Windows / tar -xf path):");
  const zlib = require("zlib");
  const { execSync } = require("child_process");
  const tarSupportsZip = (() => {
    try {
      const help = execSync(`tar --help 2>&1 || true`, { encoding: "utf8" });
      // GNU tar mentions --bzip2; we want explicit zip extraction support
      // (e.g. libarchive tar or bsdtar). Look for "--zip" as a flag, or
      // libarchive in the linked libraries.
      if (/(^|\s)--zip(\s|=)/m.test(help)) return true;
      const lddOut = execSync("ldd $(which tar) 2>/dev/null || true", { encoding: "utf8", shell: "/bin/bash" });
      return /libarchive/i.test(lddOut);
    } catch {
      return false;
    }
  })();
  if (!tarSupportsZip) {
    console.log("  ⚠ host tar does not advertise zip support — skipping (Win11 uses libarchive tar which does)");
  } else {
    const zipStage = makeTempHome();
    try {
      const payload = Buffer.from("portpilot-witr-stub-binary\n");
      const crcTable = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          t[n] = c >>> 0;
        }
        return t;
      })();
      function crc32(buf) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
      }
      const computedCrc = (typeof zlib.crc32 === "function" ? zlib.crc32(payload) : crc32(payload)) >>> 0;
      const deflated = zlib.deflateRawSync(payload);
      const innerName = Buffer.from("witr.exe");
      const nameLen = innerName.length;
      const dataOffset = 30 + nameLen;

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0, 6);
      local.writeUInt16LE(8, 8);
      local.writeUInt16LE(0, 10);
      local.writeUInt16LE(0, 12);
      local.writeUInt32LE(computedCrc, 14);
      local.writeUInt32LE(deflated.length, 18);
      local.writeUInt32LE(payload.length, 22);
      local.writeUInt16LE(nameLen, 26);
      local.writeUInt16LE(0, 28);
      const localBlock = Buffer.concat([local, innerName, deflated]);

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0, 8);
      central.writeUInt16LE(8, 10);
      central.writeUInt16LE(0, 12);
      central.writeUInt16LE(0, 14);
      central.writeUInt32LE(computedCrc, 16);
      central.writeUInt32LE(deflated.length, 20);
      central.writeUInt32LE(payload.length, 24);
      central.writeUInt16LE(nameLen, 28);
      central.writeUInt16LE(0, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38);
      central.writeUInt32LE(dataOffset, 42);
      const centralBlock = Buffer.concat([central, innerName]);

      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(0, 4);
      eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(1, 8);
      eocd.writeUInt16LE(1, 10);
      eocd.writeUInt32LE(centralBlock.length, 12);
      eocd.writeUInt32LE(localBlock.length, 16);
      eocd.writeUInt16LE(0, 20);

      const zipBytes = Buffer.concat([localBlock, centralBlock, eocd]);
      const staged = path.join(zipStage, "witr-windows-amd64.zip");
      fs.writeFileSync(staged, zipBytes);

      const outDir = path.join(zipStage, "out");
      fs.mkdirSync(outDir, { recursive: true });
      try {
        execSync(`tar -xf "${staged}" -C "${outDir}" "${innerName.toString()}"`, { stdio: "pipe" });
        const extracted = path.join(outDir, innerName.toString());
        check("tar -xf extracted the inner entry", fs.existsSync(extracted));
        if (fs.existsSync(extracted)) {
          const got = fs.readFileSync(extracted, "utf8");
          check("extracted bytes match payload", got === payload.toString());
        }
      } catch (e) {
        bad("tar -xf failed despite advertised zip support", e.message);
      }
    } finally {
      fs.rmSync(zipStage, { recursive: true, force: true });
    }
  }

  // 5. ensureWitrBinary (deferred)
  console.log("\n5. ensureWitrBinary (no network):");
  autoConfig.ensureWitrBinary(ROOT).then((res) => {
    if (process.platform === "linux" && process.arch === "x64") {
      const expected = path.join(ROOT, "resources", "bin", "witr-linux-amd64");
      if (fs.existsSync(expected)) {
        check("detects present binary", res.status === "present" && res.binaryPath === expected);
      } else {
        check("handles missing binary without throwing", typeof res.status === "string");
      }
    } else {
      check("skips unsupported hosts", res.status === "skipped");
    }

    console.log(`\n${failed === 0 ? "✓" : "✗"} ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }).catch((e) => {
    console.error("✗ ensureWitrBinary threw:", e);
    process.exit(1);
  });
}

main();
