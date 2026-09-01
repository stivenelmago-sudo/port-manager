/**
 * Port Manager - Internationalization
 *
 * Idiomas soportados:
 *   - en: English
 *   - es: Español
 *   - zh: 中文 (Chino mandarín)
 *   - hi: हिन्दी (Hindi)
 *   - ar: العربية (Árabe)
 *   - ja: 日本語 (Japonés - por compatibilidad)
 */

const vscode = require("vscode");

const SUPPORTED = ["en", "es", "zh", "hi", "ar", "ja"];
const DEFAULT_LANG = "en";

const MESSAGES = {
  en: {
    ext: {
      description: "Port Manager",
    },
    cmd: {
      show: "Port Manager: Show Listening Ports",
      checkPort: "Port Manager: Check Port Availability",
      killPort: "Port Manager: Kill Port",
    },
    view: {
      title: "Ports",
    },
    noPorts: "No listening ports",
    quickPickPlaceholder: "Listening ports — select to KILL",
    killConfirm: (port, process) => `Kill port :${port} (${process})?`,
    killButton: "KILL",
    inputPromptCheck: "Enter port number to check",
    inputPlaceholderCheck: "e.g. 3000",
    portFree: (port) => `Port :${port} is free`,
    portUsed: (port, detail) => `Port :${port} is in use${detail}`,
    inputPromptKill: "Enter port number(s) to close (comma-separated)",
    inputPlaceholderKill: "e.g. 3000 or 3000,8080,5432",
    noMatchingPorts: "No matching ports found",
    bulkKillConfirm: (n, desc) => `Kill ${n} port(s): ${desc}`,
    bulkKillResult: (ok, fail) => `Done: success ${ok} / failed ${fail}`,
    killed: (port) => `Port :${port} was killed`,
    killFailed: (msg) => `Kill failed: ${msg}`,
    validateRange: (min, max) => `Enter a value between ${min}-${max}`,
    webview: {
      searchPlaceholder: "Search by port / process name...",
      refresh: "Refresh",
      rangeScan: "Range Scan",
      bulkKill: (n) => `KILL Selected (${n})`,
      range: "Range:",
      run: "Run",
      statsUsed: (n) => `Used ${n}`,
      statsFree: (n) => `Free ${n}`,
      statsTotal: (n) => `Total ${n}`,
      empty: "No matching ports",
      colPort: "Port",
      colState: "State",
      colProcess: "Process",
      colPid: "PID",
      colAction: "Action",
      stateListen: "LISTEN",
      stateFree: "FREE",
      kill: "KILL",
      confirm: "Confirm",
      cancel: "Cancel",
      toastKilled: (port) => `:${port} was killed`,
      toastKillFailed: (msg) => `Kill failed: ${msg}`,
      toastScan: (used, free) => `Used: ${used} / Free: ${free}`,
      bulkKilledLabel: (n) => `${n} ports`,
    },
  },
  es: {
    ext: {
      description: "Port Manager",
    },
    cmd: {
      show: "Port Manager: Mostrar puertos en escucha",
      checkPort: "Port Manager: Verificar disponibilidad de puerto",
      killPort: "Port Manager: Cerrar puerto",
    },
    view: {
      title: "Puertos",
    },
    noPorts: "No hay puertos en escucha",
    quickPickPlaceholder: "Puertos en escucha — selecciona para CERRAR",
    killConfirm: (port, process) => `¿Cerrar el puerto :${port} (${process})?`,
    killButton: "CERRAR",
    inputPromptCheck: "Ingresa el número de puerto a verificar",
    inputPlaceholderCheck: "ej. 3000",
    portFree: (port) => `El puerto :${port} está libre`,
    portUsed: (port, detail) => `El puerto :${port} está en uso${detail}`,
    inputPromptKill: "Ingresa el(los) puerto(s) a cerrar (separados por coma)",
    inputPlaceholderKill: "ej. 3000 o 3000,8080,5432",
    noMatchingPorts: "No se encontraron puertos coincidentes",
    bulkKillConfirm: (n, desc) => `Cerrar ${n} puerto(s): ${desc}`,
    bulkKillResult: (ok, fail) => `Listo: éxito ${ok} / fallo ${fail}`,
    killed: (port) => `Puerto :${port} cerrado`,
    killFailed: (msg) => `Error al cerrar: ${msg}`,
    validateRange: (min, max) => `Ingresa un valor entre ${min}-${max}`,
    webview: {
      searchPlaceholder: "Buscar por puerto / proceso...",
      refresh: "Actualizar",
      rangeScan: "Escanear rango",
      bulkKill: (n) => `CERRAR selección (${n})`,
      range: "Rango:",
      run: "Ejecutar",
      statsUsed: (n) => `En uso ${n}`,
      statsFree: (n) => `Libres ${n}`,
      statsTotal: (n) => `Total ${n}`,
      empty: "No hay puertos coincidentes",
      colPort: "Puerto",
      colState: "Estado",
      colProcess: "Proceso",
      colPid: "PID",
      colAction: "Acción",
      stateListen: "ESCUCHA",
      stateFree: "LIBRE",
      kill: "CERRAR",
      confirm: "Confirmar",
      cancel: "Cancelar",
      toastKilled: (port) => `Puerto :${port} cerrado`,
      toastKillFailed: (msg) => `Error al cerrar: ${msg}`,
      toastScan: (used, free) => `En uso: ${used} / Libres: ${free}`,
      bulkKilledLabel: (n) => `${n} puertos`,
    },
  },
  zh: {
    ext: {
      description: "Port Manager",
    },
    cmd: {
      show: "Port Manager: 显示监听端口",
      checkPort: "Port Manager: 检查端口可用性",
      killPort: "Port Manager: 关闭端口",
    },
    view: {
      title: "端口",
    },
    noPorts: "没有监听的端口",
    quickPickPlaceholder: "监听的端口 — 选择以关闭",
    killConfirm: (port, process) => `关闭端口 :${port} (${process})?`,
    killButton: "关闭",
    inputPromptCheck: "输入要检查的端口号",
    inputPlaceholderCheck: "例如 3000",
    portFree: (port) => `端口 :${port} 是空闲的`,
    portUsed: (port, detail) => `端口 :${port} 正在使用${detail}`,
    inputPromptKill: "输入要关闭的端口号(多个用逗号分隔)",
    inputPlaceholderKill: "例如 3000 或 3000,8080,5432",
    noMatchingPorts: "未找到匹配的端口",
    bulkKillConfirm: (n, desc) => `关闭 ${n} 个端口: ${desc}`,
    bulkKillResult: (ok, fail) => `完成: 成功 ${ok} / 失败 ${fail}`,
    killed: (port) => `端口 :${port} 已关闭`,
    killFailed: (msg) => `关闭失败: ${msg}`,
    validateRange: (min, max) => `请输入 ${min}-${max} 之间的值`,
    webview: {
      searchPlaceholder: "按端口/进程搜索...",
      refresh: "刷新",
      rangeScan: "范围扫描",
      bulkKill: (n) => `关闭所选 (${n})`,
      range: "范围:",
      run: "执行",
      statsUsed: (n) => `使用 ${n}`,
      statsFree: (n) => `空闲 ${n}`,
      statsTotal: (n) => `总计 ${n}`,
      empty: "没有匹配的端口",
      colPort: "端口",
      colState: "状态",
      colProcess: "进程",
      colPid: "PID",
      colAction: "操作",
      stateListen: "监听",
      stateFree: "空闲",
      kill: "关闭",
      confirm: "确认",
      cancel: "取消",
      toastKilled: (port) => `端口 :${port} 已关闭`,
      toastKillFailed: (msg) => `关闭失败: ${msg}`,
      toastScan: (used, free) => `使用: ${used} / 空闲: ${free}`,
      bulkKilledLabel: (n) => `${n} 个端口`,
    },
  },
  hi: {
    ext: {
      description: "Port Manager",
    },
    cmd: {
      show: "Port Manager: सुनने वाले पोर्ट दिखाएँ",
      checkPort: "Port Manager: पोर्ट उपलब्धता जाँचें",
      killPort: "Port Manager: पोर्ट बंद करें",
    },
    view: {
      title: "पोर्ट्स",
    },
    noPorts: "कोई सुनने वाला पोर्ट नहीं",
    quickPickPlaceholder: "सुनने वाले पोर्ट — बंद करने के लिए चुनें",
    killConfirm: (port, process) => `पोर्ट :${port} (${process}) बंद करें?`,
    killButton: "बंद करें",
    inputPromptCheck: "जाँचने के लिए पोर्ट नंबर दर्ज करें",
    inputPlaceholderCheck: "उदा. 3000",
    portFree: (port) => `पोर्ट :${port} खाली है`,
    portUsed: (port, detail) => `पोर्ट :${port} उपयोग में है${detail}`,
    inputPromptKill: "बंद करने के लिए पोर्ट नंबर दर्ज करें (अल्पविराम से अलग)",
    inputPlaceholderKill: "उदा. 3000 या 3000,8080,5432",
    noMatchingPorts: "कोई मेल खाने वाला पोर्ट नहीं मिला",
    bulkKillConfirm: (n, desc) => `${n} पोर्ट बंद करें: ${desc}`,
    bulkKillResult: (ok, fail) => `पूर्ण: सफल ${ok} / असफल ${fail}`,
    killed: (port) => `पोर्ट :${port} बंद किया गया`,
    killFailed: (msg) => `बंद करने में विफल: ${msg}`,
    validateRange: (min, max) => `${min}-${max} के बीच मान दर्ज करें`,
    webview: {
      searchPlaceholder: "पोर्ट / प्रक्रिया से खोजें...",
      refresh: "ताज़ा करें",
      rangeScan: "रेंज स्कैन",
      bulkKill: (n) => `चयनित बंद करें (${n})`,
      range: "रेंज:",
      run: "चलाएँ",
      statsUsed: (n) => `उपयोग ${n}`,
      statsFree: (n) => `खाली ${n}`,
      statsTotal: (n) => `कुल ${n}`,
      empty: "कोई मेल खाने वाला पोर्ट नहीं",
      colPort: "पोर्ट",
      colState: "स्थिति",
      colProcess: "प्रक्रिया",
      colPid: "PID",
      colAction: "क्रिया",
      stateListen: "सुन रहा",
      stateFree: "खाली",
      kill: "बंद",
      confirm: "पुष्टि करें",
      cancel: "रद्द करें",
      toastKilled: (port) => `पोर्ट :${port} बंद किया गया`,
      toastKillFailed: (msg) => `बंद करने में विफल: ${msg}`,
      toastScan: (used, free) => `उपयोग: ${used} / खाली: ${free}`,
      bulkKilledLabel: (n) => `${n} पोर्ट`,
    },
  },
  ar: {
    ext: {
      description: "Port Manager",
    },
    cmd: {
      show: "Port Manager: عرض المنافذ المستمعة",
      checkPort: "Port Manager: التحقق من توفر المنفذ",
      killPort: "Port Manager: إغلاق المنفذ",
    },
    view: {
      title: "المنافذ",
    },
    noPorts: "لا توجد منافذ مستمعة",
    quickPickPlaceholder: "المنافذ المستمعة — اختر للإغلاق",
    killConfirm: (port, process) => `إغلاق المنفذ :${port} (${process})؟`,
    killButton: "إغلاق",
    inputPromptCheck: "أدخل رقم المنفذ للتحقق",
    inputPlaceholderCheck: "مثال: 3000",
    portFree: (port) => `المنفذ :${port} متاح`,
    portUsed: (port, detail) => `المنفذ :${port} قيد الاستخدام${detail}`,
    inputPromptKill: "أدخل أرقام المنافذ للإغلاق (مفصولة بفواصل)",
    inputPlaceholderKill: "مثال: 3000 أو 3000,8080,5432",
    noMatchingPorts: "لم يتم العثور على منافذ مطابقة",
    bulkKillConfirm: (n, desc) => `إغلاق ${n} منفذ(ات): ${desc}`,
    bulkKillResult: (ok, fail) => `تم: نجاح ${ok} / فشل ${fail}`,
    killed: (port) => `تم إغلاق المنفذ :${port}`,
    killFailed: (msg) => `فشل الإغلاق: ${msg}`,
    validateRange: (min, max) => `أدخل قيمة بين ${min}-${max}`,
    webview: {
      searchPlaceholder: "بحث عن منفذ / عملية...",
      refresh: "تحديث",
      rangeScan: "فحص النطاق",
      bulkKill: (n) => `إغلاق المحدد (${n})`,
      range: "النطاق:",
      run: "تشغيل",
      statsUsed: (n) => `قيد الاستخدام ${n}`,
      statsFree: (n) => `متاح ${n}`,
      statsTotal: (n) => `المجموع ${n}`,
      empty: "لا توجد منافذ مطابقة",
      colPort: "المنفذ",
      colState: "الحالة",
      colProcess: "العملية",
      colPid: "PID",
      colAction: "إجراء",
      stateListen: "استماع",
      stateFree: "متاح",
      kill: "إغلاق",
      confirm: "تأكيد",
      cancel: "إلغاء",
      toastKilled: (port) => `تم إغلاق المنفذ :${port}`,
      toastKillFailed: (msg) => `فشل الإغلاق: ${msg}`,
      toastScan: (used, free) => `قيد الاستخدام: ${used} / متاح: ${free}`,
      bulkKilledLabel: (n) => `${n} منافذ`,
    },
  },
  ja: {
    ext: {
      description: "Port Manager",
    },
    cmd: {
      show: "Port Manager: リスニングポートを表示",
      checkPort: "Port Manager: ポートの空き状況を確認",
      killPort: "Port Manager: ポートを終了",
    },
    view: {
      title: "ポート",
    },
    noPorts: "使用中のポートはありません",
    quickPickPlaceholder: "使用中のポート一覧 — 選択してKILL",
    killConfirm: (port, process) => `ポート :${port} (${process}) を終了しますか？`,
    killButton: "KILL",
    inputPromptCheck: "確認するポート番号を入力",
    inputPlaceholderCheck: "例: 3000",
    portFree: (port) => `ポート :${port} は空いています`,
    portUsed: (port, detail) => `ポート :${port} は使用中です${detail}`,
    inputPromptKill: "閉じるポート番号を入力 (カンマ区切りで複数可)",
    inputPlaceholderKill: "例: 3000 または 3000,8080,5432",
    noMatchingPorts: "該当するポートが見つかりません",
    bulkKillConfirm: (n, desc) => `${n} 個のポートを終了: ${desc}`,
    bulkKillResult: (ok, fail) => `完了: 成功 ${ok} / 失敗 ${fail}`,
    killed: (port) => `ポート :${port} を終了しました`,
    killFailed: (msg) => `終了失敗: ${msg}`,
    validateRange: (min, max) => `${min}-${max} の範囲で入力してください`,
    webview: {
      searchPlaceholder: "ポート番号 / プロセス名で検索...",
      refresh: "更新",
      rangeScan: "範囲スキャン",
      bulkKill: (n) => `選択をKILL (${n})`,
      range: "範囲:",
      run: "実行",
      statsUsed: (n) => `使用中 ${n}`,
      statsFree: (n) => `空き ${n}`,
      statsTotal: (n) => `合計 ${n}`,
      empty: "該当するポートがありません",
      colPort: "ポート",
      colState: "状態",
      colProcess: "プロセス",
      colPid: "PID",
      colAction: "操作",
      stateListen: "使用中",
      stateFree: "空き",
      kill: "KILL",
      confirm: "確認",
      cancel: "取消",
      toastKilled: (port) => `:${port} を終了しました`,
      toastKillFailed: (msg) => `終了失敗: ${msg}`,
      toastScan: (used, free) => `使用中: ${used} / 空き: ${free}`,
      bulkKilledLabel: (n) => `${n}個のポート`,
    },
  },
};

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
