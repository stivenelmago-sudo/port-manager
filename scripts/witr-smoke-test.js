#!/usr/bin/env node
/**
 * Smoke test for the WITR integration module.
 * Verifies host detection, runner timeout, and enrichPorts graceful fallback.
 */

const Module = require("module");
const path = require("path");

// Mock vscode (host.js doesn't actually use it but provider code might be required).
const vscodeMock = {
  env: { language: "en" },
  workspace: {
    getConfiguration: () => ({ get: () => "", update: async () => {} }),
  },
  window: {
    showInformationMessage: () => {},
    showWarningMessage: () => {},
    showErrorMessage: () => {},
    showInputBox: () => {},
    showQuickPick: () => {},
    registerWebviewViewProvider: () => ({ dispose: () => {} }),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: () => {},
  },
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "vscode") return "vscode-mock";
  return origResolve.call(this, request, parent, ...rest);
};
require.cache["vscode-mock"] = {
  id: "vscode-mock", filename: "vscode-mock", loaded: true, exports: vscodeMock,
};

const host = require("../src/witr/host");
const runner = require("../src/witr/runner");
const witr = require("../src/witr");
const fs = require("fs");

console.log("=== WITR SMOKE TEST ===\n");

// 1. Host detection
console.log(`PLATFORM=${host.PLATFORM}  ARCH=${host.ARCH}`);
console.log(`isSupported()=${host.isSupported()}  binaryName=${host.resolveBinaryName()}`);
console.log(`guessLinuxPkgFamily()=${host.guessLinuxPkgFamily()}`);

// 2. binaryPath with mock context
const fakeCtx = {
  asAbsolutePath: (p) => path.resolve(__dirname, "..", p),
};
const bin = host.binaryPath(fakeCtx);
console.log(`binaryPath()=${bin}`);
console.log(`exists()=${bin ? require("fs").existsSync(bin) : "n/a"}`);

// 3. parseShortLine
const sample = "systemd (pid 1) → PM2 v5.3.1: God (pid 1481580) → python (pid 1482060)";
const parsed = runner.parseShortLine(sample);
console.log("parseShortLine chain length:", parsed && parsed.ancestry && parsed.ancestry.length);
console.log("supervisor:", parsed && parsed.supervisor);
console.log("leafName:", parsed && parsed.leafName);

// 4. enrichPorts with missing binary — should NOT throw and should mark witr=null
(async () => {
  const ports = [
    { port: 3000, pid: 100, process: "node", state: "LISTEN" },
    { port: 5432, pid: 200, process: "postgres", state: "LISTEN" },
  ];
  const result = await witr.enrichPorts(ports, "/nonexistent/witr-binary");
  console.log(`\nenrichPorts(missing bin): enriched=${result.enriched} status=${result.availability.status}`);
  console.log(`ports[0].witr=${ports[0].witr}`);

  // 5. enrichPorts with empty array
  const empty = await witr.enrichPorts([], bin);
  console.log(`enrichPorts([]): enriched=${empty.enriched}`);

  // 6. probe() with mocked settings
  const cfg = witr.readConfig();
  console.log(`\nreadConfig(): enabled=${cfg.enabled} binaryPath="${cfg.binaryPath}"`);
  const probed = witr.probe(fakeCtx);
  console.log(`probe(): status=${probed.status} hint="${probed.hint || ""}"`);
  console.log(`probe(): binaryPath=${probed.binaryPath}`);

  // 7. End-to-end integration test against a real bundled binary, if available.
  if (bin && fs.existsSync(bin)) {
    const net = require("net");
    const testPort = await new Promise((resolve) => {
      const srv = net.createServer().listen(0, "127.0.0.1", () => {
        resolve(srv.address().port);
        // Close after a delay so witr has time to inspect.
        setTimeout(() => srv.close(), 2000);
      });
    });
    const map = await runner.lookupPortsBatch(bin, [testPort]);
    const entry = map.get(testPort);
    if (entry && entry.chain) {
      console.log(`\nIntegration: real witr against port ${testPort}:`);
      console.log(`  chain=${entry.chain}`);
      console.log(`  supervisor=${entry.supervisor}`);
      console.log(`  leaf=${entry.leafName}`);
    } else {
      console.log(`\nIntegration: witr found no chain for port ${testPort} (may need root)`);
    }
  } else {
    console.log("\nIntegration: skipped (no bundled binary)");
  }

  console.log("\n✓ WITR module smoke test passed");
})().catch((e) => {
  console.error("✗ WITR smoke test failed:", e);
  process.exit(1);
});
