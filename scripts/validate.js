#!/usr/bin/env node
/**
 * Pre-build validator:
 *  - JSON parse for package.nls.*.json and package.json
 *  - Verifies every %placeholder% in package.json has a matching NLS key
 *  - Verifies every NLS file has the same keys
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listKeys(obj, prefix = "") {
  const keys = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k])) {
      keys.push(...listKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

let errors = 0;
function fail(msg) { console.error("✗", msg); errors++; }
function ok(msg) { console.log("✓", msg); }

const pkgPath = path.join(root, "package.json");
const pkg = readJSON(pkgPath);
ok(`package.json valid JSON`);

const used = new Set();
const re = /%([a-zA-Z0-9_.]+)%/g;
const pkgStr = fs.readFileSync(pkgPath, "utf8");
let m;
while ((m = re.exec(pkgStr))) used.add(m[1]);
ok(`Found ${used.size} placeholders in package.json`);

const defaultNls = readJSON(path.join(root, "package.nls.json"));
const defined = new Set(listKeys(defaultNls));

for (const key of used) {
  if (!defined.has(key)) fail(`Missing NLS key: ${key}`);
}
ok(`All placeholders have NLS keys`);

const locales = fs.readdirSync(root)
  .filter(f => /^package\.nls\.[a-z]+\.json$/.test(f))
  .sort();

const defaultKeys = [...defined].sort();
for (const loc of locales) {
  const data = readJSON(path.join(root, loc));
  const keys = [...listKeys(data)].sort();
  const same = keys.length === defaultKeys.length && keys.every((k, i) => k === defaultKeys[i]);
  if (same) ok(`${loc} keys match (${keys.length})`);
  else {
    fail(`${loc} keys mismatch`);
    const missing = defaultKeys.filter(k => !keys.includes(k));
    const extra = keys.filter(k => !defaultKeys.includes(k));
    missing.forEach(k => fail(`  missing in ${loc}: ${k}`));
    extra.forEach(k => fail(`  extra in ${loc}: ${k}`));
  }
}

if (errors > 0) {
  console.error(`\n${errors} error(s)`);
  process.exit(1);
}
console.log(`\n✓ All validations passed (${locales.length + 1} NLS files)`);
