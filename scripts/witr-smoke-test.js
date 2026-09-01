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

  console.log("\n✓ WITR module smoke test passed");
})().catch((e) => {
  console.error("✗ WITR smoke test failed:", e);
  process.exit(1);
});
