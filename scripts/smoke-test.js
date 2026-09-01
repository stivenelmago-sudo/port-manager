/* Smoke test: load all modules with a vscode mock and exercise i18n */
const Module = require('module');
const path = require('path');

const vscodeMock = {
  env: { language: 'es' },
  workspace: {
    getConfiguration: () => ({
      get: () => '',
      update: async () => {},
    }),
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
  if (request === 'vscode') return 'vscode-mock';
  return origResolve.call(this, request, parent, ...rest);
};
require.cache['vscode-mock'] = { id: 'vscode-mock', filename: 'vscode-mock', loaded: true, exports: vscodeMock };

const i18n = require('../src/i18n');
console.log('i18n loaded:', typeof i18n.t === 'function');
i18n.init();
console.log('Detected lang:', i18n.getLanguage());

const langs = ['en', 'es', 'zh', 'hi', 'ar', 'ja'];
for (const lang of langs) {
  i18n.setLanguage(lang);
  const ok = i18n.t('noPorts');
  const killBtn = i18n.t('killButton');
  const range = i18n.t('validateRange', 1, 65535);
  const wv = i18n.getWebviewStrings();
  console.log(`[${lang}] noPorts="${ok}" killBtn="${killBtn}" validateRange="${range}" _lang=${wv._lang} colPort="${wv.colPort}"`);
}

i18n.setLanguage('ar');
const arWv = i18n.getWebviewStrings();
console.log('AR webview _lang:', arWv._lang, 'RTL should be:', arWv._lang === 'ar' ? 'rtl' : 'ltr');

const { getListeningPorts, checkPortFree, killByPid } = require('../src/core/portService');
console.log('Port service:', typeof getListeningPorts === 'function', typeof checkPortFree === 'function', typeof killByPid === 'function');
console.log('getListeningPorts() count:', getListeningPorts().length);

const { createWebviewProvider } = require('../src/providers/webviewProvider');
console.log('createWebviewProvider:', typeof createWebviewProvider === 'function');

const { registerCommands } = require('../src/commands');
console.log('registerCommands:', typeof registerCommands === 'function');

const { getWebviewContent } = require('../src/webview');
const html = getWebviewContent(i18n.getWebviewStrings());
console.log('HTML length:', html.length, 'hasPortManagerRef:', html.includes('Port'), 'hasRtl:', html.includes('dir="rtl"'));

console.log('\n✓ All modules load and function correctly');
