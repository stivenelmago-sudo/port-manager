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
    const v = w[k];
    if (typeof v === "function") {
      // Webview strings are shipped via JSON.stringify (functions don't survive
      // the trip), so we bake any callable to a plain string with {n} place-
      // holders. Callers in script.js do T.bulkKill(n).replace("{n}", n).
      out[k] = bakeTemplate(v);
    } else {
      out[k] = v;
    }
  }
  out._supported = SUPPORTED.map(code => ({
    code,
    label: {
      en: "English",
      es: "Español",
      zh: "中文",
      hi: "हिन्दी",
      ar: "العربية",
      ja: "日本語",
    }[code],
  }));
  return out;
}

/**
 * Convert a function-valued i18n entry to a string template using {n}, {n2}…
 * placeholders. Each {n} marker is replaced left-to-right with the next
 * argument's stringified value at the call site.
 *
 * Examples:
 *   (n) => `KILL Selected (${n})`   →  "KILL Selected ({n})"
 *   () => `Hello`                   →  "Hello"
 */
function bakeTemplate(fn) {
  // We probe with a generous number of sentinels ({n}, {n2}, {n3}, {n4}) and
  // strip out any that didn't make it into the rendered string. The webview's
  // tpl() helper substitutes {n} / {n2} / etc. left-to-right, so we want each
  // slot to appear exactly once in the baked template.
  const sentinels = ["{n}", "{n2}", "{n3}", "{n4}"];
  const baked = fn(...sentinels);
  // Drop sentinels that the template didn't actually use (e.g. functions with
  // default args or rest params where fn.length === 0). Detect by checking
  // presence in the baked string; the webview's tpl() replaces them
  // left-to-right, so unused sentinels are simply ignored.
  return baked;
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
