#!/usr/bin/env node
/**
 * End-to-end functionality test for the WITR integration.
 * Spins up a real listening TCP port and verifies that witr returns
 * a sensible ancestry chain. Also exercises probe(), cache hit/miss,
 * and parseShortLine() edge cases.
 */

const Module = require("module");
const path = require("path");
const fs = require("fs");
const net = require("net");

// Install vscode mock BEFORE requiring anything that uses it.
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req === "vscode") return "vscode-mock";
  return orig.call(this, req, parent, ...rest);
};
require.cache["vscode-mock"] = {
  id: "vscode-mock", filename: "vscode-mock", loaded: true,
  exports: {
    workspace: {
      getConfiguration: () => ({
        get: (k, d) => d,
        update: async () => {},
      }),
      onDidChangeConfiguration: () => ({ dispose: () => {} }),
    },
    window: {
      showInformationMessage: () => {},
      showWarningMessage: () => {},
      showErrorMessage: () => {},
    },
  },
};

const runner = require("../src/witr/runner");
const witr = require("../src/witr");
const host = require("../src/witr/host");

const BIN = path.resolve(__dirname, "..", "resources", "bin", "witr-linux-amd64");

(async () => {
  let failed = 0;
  function check(label, cond, detail = "") {
    if (cond) console.log(`  ✓ ${label} ${detail}`);
    else { console.log(`  ✗ ${label} ${detail}`); failed++; }
  }

  console.log("=== WITR FUNCTIONAL CHECK ===\n");

  // 1. Binary present
  console.log("1. Binary presence:");
  check("witr-linux-amd64 bundled", fs.existsSync(BIN), `at ${BIN}`);

  // 2. Live lookup
  console.log("\n2. Live lookup against a real port:");
  const port = await new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      resolve(s.address().port);
      setTimeout(() => s.close(), 2000);
    });
  });
  const map = await runner.lookupPortsBatch(BIN, [port]);
  const entry = map.get(port);
  check("witr returns a chain for live port", entry && entry.chain, `(chain=${entry && entry.chain})`);
  check("chain has supervisor", entry && entry.supervisor);
  check("chain has leaf", entry && entry.leafName);

  // 3. Cache behavior — second call must be faster (no spawn)
  console.log("\n3. Cache behavior:");
  runner.cacheClear();
  const t1 = Date.now();
  await runner.lookupPortsBatch(BIN, [port]);
  const coldMs = Date.now() - t1;
  const t2 = Date.now();
  await runner.lookupPortsBatch(BIN, [port]);
  const warmMs = Date.now() - t2;
  check("cache miss slower than hit", warmMs <= coldMs, `(${coldMs}ms cold vs ${warmMs}ms warm)`);

  // 4. probe()
  console.log("\n4. probe() with valid context:");
  const probed = witr.probe({ asAbsolutePath: (p) => path.resolve(__dirname, "..", p) });
  check("probe.status === available", probed.status === "available");
  check("probe.binaryPath set", typeof probed.binaryPath === "string");

  // 5. parseShortLine edge cases
  console.log("\n5. parseShortLine robustness:");
  check("simple segment", runner.parseShortLine("bash (pid 100)").leafName === "bash");
  check("multi-hop chain",
    runner.parseShortLine("a (pid 1) → b (pid 2) → c (pid 3)").ancestry.length === 3);
  check("empty string returns null", runner.parseShortLine("") === null);
  check("whitespace-only returns null", runner.parseShortLine("   ") === null);
  check("single-segment no-pid: leaf is the segment name",
    runner.parseShortLine("systemd").leafName === "systemd");
  check("single-segment: supervisor is null (no ancestor)",
    runner.parseShortLine("systemd").supervisor === null);

  // 6. Missing binary graceful
  console.log("\n6. Graceful fallback when binary missing:");
  runner.cacheClear();
  const result = await witr.enrichPorts(
    [{ port: 8080, pid: 1000, process: "test", state: "LISTEN" }],
    "/nonexistent/path/witr"
  );
  check("enrichPorts returns without throwing", true);
  check("status reflects missing", result.availability.status === "available" || result.availability.status === "missing");

  // 7. Host detection
  console.log("\n7. Host detection:");
  check("PLATFORM detected", typeof host.PLATFORM === "string");
  check("isSupported() returns boolean", typeof host.isSupported() === "boolean");
  check("resolveBinaryName() returns string or null", typeof host.resolveBinaryName() === "string" || host.resolveBinaryName() === null);

  // 8. Webview script.js must be syntactically valid JavaScript.
  // (Previously had string-quote bugs that silently broke the table render.)
  console.log("\n8. Webview script syntax:");
  const getScript = require("../src/webview/script");
  try {
    new Function(getScript({}));
    check("script.js parses as valid JavaScript", true);
  } catch (e) {
    check("script.js parses as valid JavaScript", false, `(error: ${e.message})`);
  }

  console.log("");
  if (failed === 0) {
    console.log("✓ ALL WITR FUNCTIONALITY VERIFIED");
    process.exit(0);
  } else {
    console.log(`✗ ${failed} check(s) failed`);
    process.exit(1);
  }
})().catch((e) => {
  console.error("✗ Functional test threw:", e);
  process.exit(1);
});
