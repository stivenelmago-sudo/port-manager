/**
 * download-witr.js
 *
 * Downloads the latest WITR static binaries for every supported
 * (platform, arch) pair into resources/bin/. Used by CI before packaging
 * the per-platform VSIX.
 *
 * Usage:
 *   node scripts/download-witr.js                # all platforms
 *   node scripts/download-witr.js --platform linux --arch amd64   # one
 *
 * Source: https://github.com/pranshuparmar/witr/releases/latest
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const REPO = "pranshuparmar/witr";
const TARGETS = [
  { platform: "linux",  arch: "amd64", file: "witr-linux-amd64" },
  { platform: "linux",  arch: "arm64", file: "witr-linux-arm64" },
  { platform: "darwin", arch: "amd64", file: "witr-darwin-amd64" },
  { platform: "darwin", arch: "arm64", file: "witr-darwin-arm64" },
  { platform: "win32",  arch: "amd64", file: "witr-windows-amd64.exe" },
  { platform: "win32",  arch: "arm64", file: "witr-windows-arm64.exe" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    out[args[i].replace(/^--/, "")] = args[i + 1];
  }
  return out;
}

function getLatestTag() {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${REPO}/releases/latest`;
    https.get(url, { headers: { "User-Agent": "portpilot-downloader" } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`GitHub API responded ${res.statusCode}`));
      }
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (!json.tag_name) return reject(new Error("No tag_name in response"));
          resolve(json.tag_name);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "portpilot-downloader" } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close((err) => err ? reject(err) : resolve()));
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  const args = parseArgs();
  const binDir = path.resolve(__dirname, "..", "resources", "bin");
  fs.mkdirSync(binDir, { recursive: true });

  let targets = TARGETS;
  if (args.platform && args.arch) {
    targets = TARGETS.filter(
      (t) => t.platform === args.platform && t.arch === args.arch
    );
    if (targets.length === 0) {
      console.error(`No binary known for ${args.platform}/${args.arch}`);
      process.exit(1);
    }
  }

  const tag = await getLatestTag();
  console.log(`Latest WITR release: ${tag}`);

  for (const t of targets) {
    const url = `https://github.com/${REPO}/releases/download/${tag}/${t.file}`;
    const dest = path.join(binDir, t.file);
    process.stdout.write(`  → ${t.file} ... `);
    try {
      await downloadFile(url, dest);
      if (t.platform !== "win32") fs.chmodSync(dest, 0o755);
      console.log("ok");
    } catch (e) {
      console.log("FAIL");
      console.error(`    ${e.message}`);
    }
  }

  console.log("\nDone. Binaries in resources/bin/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
