#!/usr/bin/env node
/**
 * Simulates VS Code's NLS resolution for each locale.
 * Reads the installed extension's package.json + package.nls.{lang}.json
 * and substitutes placeholders, proving localization works end-to-end.
 */

const fs = require("fs");
const path = require("path");

const EXT_DIR = "/root/.vscode-server/extensions/port-manager-saiki.port-manager-1.1.0";
const pkg = JSON.parse(fs.readFileSync(path.join(EXT_DIR, "package.json"), "utf8"));

function applyNLS(pkgObj, nls) {
  function walk(obj) {
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === "object") {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = walk(v);
      return out;
    }
    if (typeof obj === "string") {
      return obj.replace(/%([a-zA-Z0-9_.]+)%/g, (_, key) =>
        nls[key] !== undefined ? nls[key] : `%${key}%`
      );
    }
    return obj;
  }
  return walk(pkgObj);
}

const nlsFiles = fs.readdirSync(EXT_DIR)
  .filter(f => f.startsWith("package.nls.") && f.endsWith(".json"))
  .sort();

console.log(`Extension: ${pkg.name}@${pkg.version}\n`);

for (const file of nlsFiles) {
  const lang = file === "package.nls.json" ? "en (default)" : file.replace("package.nls.", "").replace(".json", "");
  const nls = JSON.parse(fs.readFileSync(path.join(EXT_DIR, file), "utf8"));
  const resolved = applyNLS(pkg, nls);

  console.log(`─── Locale: ${lang} ───`);
  console.log(`displayName: ${resolved.displayName}`);
  console.log(`description: ${resolved.description.slice(0, 80)}...`);
  console.log("commands:");
  for (const c of resolved.contributes.commands) {
    console.log(`  • ${c.command}: ${c.title}`);
  }
  console.log(`view name: ${resolved.contributes.views.portManager[0].name}`);
  console.log("");
}
