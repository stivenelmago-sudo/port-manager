/**
 * PortPilot - Internationalization
 *
 * Idiomas soportados:
 *   - en: English
 *   - es: Español
 *   - zh: Chinese (Mandarin)
 *   - hi: हिन्दी (Hindi)
 *   - ar: العربية (Árabe)
 *   - ja: 日本語 (Japonés - por compatibilidad)
 */

const vscode = require("vscode");
const { MESSAGES } = require("./messages");

const SUPPORTED = ["en", "es", "zh", "hi", "ar", "ja"];
const DEFAULT_LANG = "en";

let currentLang = DEFAULT_LANG;
let listeners = [];

function detectLanguage() {
  try {
    const config = vscode.workspace.getConfiguration();
    const explicit = config.get("portManager.language");
    if (typeof explicit === "string" && SUPPORTED.includes(explicit)) {
      return explicit;
    }
    const env = process.env.VSCODE_NLS_CONFIG
      ? JSON.parse(process.env.VSCODE_NLS_CONFIG)
      : null;
    const locale = (env && env.locale) || vscode.env.language || DEFAULT_LANG;
    const short = String(locale).toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.includes(short) ? short : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) return;
  currentLang = lang;
  listeners.forEach((fn) => {
    try { fn(lang); } catch {}
  });
}

function getLanguage() {
  return currentLang;
}

function onLanguageChange(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function t(key, ...args) {
  const dict = MESSAGES[currentLang] || MESSAGES[DEFAULT_LANG];
  const fallback = MESSAGES[DEFAULT_LANG];
  const value = (dict && dict[key]) ?? (fallback && fallback[key]) ?? key;
  if (typeof value === "function") {
    return value(...args);
  }
  return value;
}

/**
 * Translate dotted key like "webview.colPort"
 * @param {string} dotted
 * @param  {...any} args
 */
function tr(dotted, ...args) {
  const parts = dotted.split(".");
  let dict = MESSAGES[currentLang] || MESSAGES[DEFAULT_LANG];
  let fallback = MESSAGES[DEFAULT_LANG];
  for (const p of parts) {
    dict = dict && dict[p];
    fallback = fallback && fallback[p];
    if (dict === undefined && fallback === undefined) return dotted;
  }
  const value = dict !== undefined ? dict : fallback;
  if (typeof value === "function") return value(...args);
  return value;
}

/**
 * Return all strings for the webview as a plain object (serializable).
 */
function getWebviewStrings() {
  const w = (MESSAGES[currentLang] && MESSAGES[currentLang].webview) ||
            MESSAGES[DEFAULT_LANG].webview;
  const out = { _lang: currentLang };
  for (const k of Object.keys(w)) {
    out[k] = typeof w[k] === "function" ? null : w[k];
  }
  return out;
}

module.exports = {
  SUPPORTED,
  DEFAULT_LANG,
  detectLanguage,
  setLanguage,
  getLanguage,
  onLanguageChange,
  t,
  tr,
  getWebviewStrings,
  init() {
    currentLang = detectLanguage();
    return currentLang;
  },
};
