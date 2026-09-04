/**
 * Minimal `vscode` shim so we can reuse the extension's modules (portService,
 * witr) outside of the VS Code extension host.
 *
 * Only the surface area that src/witr and src/witr/* touches at runtime is
 * implemented. Anything else throws if called — that way accidental use is
 * loud rather than silently swallowed.
 */

const noop = () => undefined;

const configuration = {
  get: (_key, defaultValue) => defaultValue,
  update: async () => undefined,
  has: () => false,
  inspect: () => undefined,
};

const workspace = {
  getConfiguration: () => configuration,
  onDidChangeConfiguration: () => ({ dispose: noop }),
};

const window = {
  showInformationMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  showQuickPick: async () => undefined,
};

module.exports = {
  workspace,
  window,
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  Uri: { parse: (s) => ({ toString: () => s }) },
  env: { language: process.env.LANG || "en" },
};
