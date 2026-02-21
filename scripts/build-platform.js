#!/usr/bin/env node
/**
 * build-platform.js
 *
 * Packages the extension for a specific (platform, arch) by:
 *   1. Downloading the matching witr binary (if missing).
 *   2. Removing all other-platform binaries from resources/bin/.
 *   3. Running `vsce package --target <vscode-target>`.
 *
 * Usage:
 *   node scripts/build-platform.js --platform linux --arch x64
 *   node scripts/build-platform.js --platform darwin --arch arm64
 *   node scripts/build-platform.js --platform win32 --arch x64
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const PLATFORM_MAP = {
  linux: { arch: { x64: "amd64", arm64: "arm64" }, vsceTarget: { x64: "linux-x64", arm64: "linux-arm64" }, binPrefix: "witr-linux" },
  darwin: { arch: { x64: "amd64", arm64: "arm64" }, vsceTarget: { x64: "darwin-x64", arm64: "darwin-arm64" }, binPrefix: "witr-darwin" },
  win32: { arch: { x64: "amd64", arm64: "arm64" }, vsceTarget: { x64: "win32-x64", arm64: "win32-arm64" }, binPrefix: "witr-windows" },
};

function fail(msg) { console.error("✗", msg); process.exit(1); }

const platform = args.platform;
const arch = args.arch;
if (!platform || !arch) fail("Usage: --platform <linux|darwin|win32> --arch <x64|arm64>");
const conf = PLATFORM_MAP[platform];
if (!conf) fail(`Unknown platform: ${platform}`);

const witrArch = conf.arch[arch];
const vsceTarget = conf.vsceTarget[arch];
if (!witrArch || !vsceTarget) fail(`Unsupported arch ${arch} for ${platform}`);

const binDir = path.resolve(__dirname, "..", "resources", "bin");
const ext = platform === "win32" ? ".exe" : "";
const expected = `${conf.binPrefix}-${witrArch}${ext}`;

console.log(`\n=== Building for ${vsceTarget} ===`);
console.log(`Expected binary: ${expected}`);

// 1. Ensure binary exists (download if missing).
if (!fs.existsSync(path.join(binDir, expected))) {
  console.log("Binary missing — downloading via download-witr.js...");
  execSync(
    `node "${path.join(__dirname, "download-witr.js")}" --platform ${platform === "win32" ? "win32" : platform} --arch ${witrArch}`,
    { stdio: "inherit" }
  );
}

// 2. Remove all OTHER-platform binaries to keep the VSIX small.
let removed = 0;
for (const f of fs.readdirSync(binDir)) {
  const full = path.join(binDir, f);
  if (!fs.statSync(full).isFile()) continue;
  if (f === expected) continue;
  if (/^witr-(linux|darwin|windows)-/.test(f)) {
    fs.unlinkSync(full);
    removed++;
  }
}
console.log(`Removed ${removed} non-matching binaries`);

// 3. Package.
console.log(`\nRunning: vsce package --target ${vsceTarget}`);
execSync(`npx vsce package --target ${vsceTarget} --no-dependencies`, {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
});
console.log(`\n✓ Build complete for ${vsceTarget}`);
