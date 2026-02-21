#!/usr/bin/env node
/**
 * End-to-end activation test.
 * Simulates VS Code's extension host by mocking the entire vscode API,
 * then loads the extension's entry point and asserts that all the
 * contributions were properly registered.
 */

const Module = require("module");
const path = require("path");

let registeredCommands = [];
let registeredProviders = [];
const infoMessages = [];
const errorMessages = [];

const vscodeMock = {
  env: { language: "en" },
  workspace: {
    getConfiguration: () => ({
      get: () => "",
      update: async () => {},
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
  },
  window: {
    showInformationMessage: (msg) => { infoMessages.push(msg); },
    showWarningMessage: (msg) => infoMessages.push("WARN: " + msg),
    showErrorMessage: (msg) => { errorMessages.push(msg); },
    showInputBox: () => undefined,
    showQuickPick: () => undefined,
    registerWebviewViewProvider: (id, provider) => {
      registeredProviders.push({ id, provider });
      return { dispose: () => {} };
    },
  },
  commands: {
    registerCommand: (id, handler) => {
      registeredCommands.push({ id, handler });
      return { dispose: () => {} };
    },
    executeCommand: () => undefined,
  },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "vscode") return "vscode-mock";
  return origResolve.call(this, request, parent, ...rest);
};
require.cache["vscode-mock"] = {
  id: "vscode-mock",
  filename: "vscode-mock",
  loaded: true,
  exports: vscodeMock,
};

console.log("=== EXTENSION ACTIVATION TEST ===\n");

// Load and activate
const ext = require("../src/extension.js");
const fakeContext = {
  subscriptions: [],
  extensionPath: path.resolve(__dirname, ".."),
};
ext.activate(fakeContext);

console.log("✓ Extension activated without throwing");
console.log(`  Subscriptions registered: ${fakeContext.subscriptions.length}`);

// Verify commands
console.log("\n=== Commands registered ===");
const expected = ["portManager.show", "portManager.checkPort", "portManager.killPort", "portManager.setLanguage", "portManager.showAncestry"];
let pass = 0, fail = 0;
for (const id of expected) {
  const found = registeredCommands.find(c => c.id === id);
  if (found) {
    console.log(`  ✓ ${id}`);
    pass++;
  } else {
    console.log(`  ✗ ${id} MISSING`);
    fail++;
  }
}

// Verify provider
console.log("\n=== Webview provider ===");
const expectedProviders = ["portManager.panel"];
for (const id of expectedProviders) {
  const found = registeredProviders.find(p => p.id === id);
  if (found) {
    console.log(`  ✓ ${id}`);
    pass++;
  } else {
    console.log(`  ✗ ${id} MISSING`);
    fail++;
  }
}

// Try invoking a command to ensure handlers don't throw
console.log("\n=== Command execution smoke ===");
const showCmd = registeredCommands.find(c => c.id === "portManager.show");
if (showCmd) {
  showCmd.handler()
    .then(() => {
      console.log(`  ✓ portManager.show() invoked without error`);
      console.log(`    Info messages: ${infoMessages.length > 0 ? '"' + infoMessages[0] + '"' : "(none)"}`);
    })
    .catch(e => {
      console.log(`  ✗ portManager.show() threw: ${e.message}`);
      fail++;
    })
    .finally(() => {
      console.log(`\n=== RESULT ===`);
      console.log(`Passed: ${pass}, Failed: ${fail}`);
      if (fail === 0 && errorMessages.length === 0) {
        console.log(`\n✓ Extension fully functional: ${pass} checks passed, 0 errors`);
        process.exit(0);
      } else {
        console.log(`\n✗ Failures detected`);
        if (errorMessages.length > 0) {
          console.log("Errors:");
          errorMessages.forEach(e => console.log("  - " + e));
        }
        process.exit(1);
      }
    });
}
