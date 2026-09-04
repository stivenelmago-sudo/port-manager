/**
 * PortPilot - Single-platform WITR downloader.
 *
 * Used by postinstall + autoConfig.ensureWitrBinary to fetch only the binary
 * matching the current host. The full multi-platform downloader
 * (`scripts/download-witr.js`) is used by CI before packaging the VSIX.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const REPO = "pranshuparmar/witr";

function getLatestTag() {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${REPO}/releases/latest`;
    https
      .get(url, { headers: { "User-Agent": "portpilot-downloader" } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`GitHub API ${res.statusCode}`));
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(body);
            if (!j.tag_name) return reject(new Error("no tag_name"));
            resolve(j.tag_name);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function downloadTo(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const follow = (u) =>
      https
        .get(u, { headers: { "User-Agent": "portpilot-downloader" } }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return follow(res.headers.location).then(resolve, reject);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          }
          res.pipe(file);
          file.on("finish", () => file.close((err) => (err ? reject(err) : resolve())));
        })
        .on("error", (err) => {
          fs.unlink(dest, () => reject(err));
        });
    follow(url);
  });
}

const TARGETS = {
  "linux:amd64": "witr-linux-amd64",
  "linux:arm64": "witr-linux-arm64",
  "darwin:amd64": "witr-darwin-amd64",
  "darwin:arm64": "witr-darwin-arm64",
  "win32:amd64": { file: "witr-windows-amd64.zip", inner: "witr.exe", out: "witr-windows-amd64.exe" },
  "win32:arm64": { file: "witr-windows-arm64.zip", inner: "witr.exe", out: "witr-windows-arm64.exe" },
};

/**
 * Download the WITR binary for one (platform, arch) into repoRoot/resources/bin/.
 * Idempotent: returns silently if the binary is already present.
 */
async function downloadOne(platform, arch, repoRoot) {
  const key = `${platform}:${arch}`;
  const t = TARGETS[key];
  if (!t) throw new Error(`No WITR binary known for ${key}`);

  const binDir = path.join(repoRoot, "resources", "bin");
  fs.mkdirSync(binDir, { recursive: true });

  const isZip = typeof t === "object";
  const fileName = isZip ? t.file : t;
  const finalName = isZip ? t.out : t;
  const finalPath = path.join(binDir, finalName);
  if (fs.existsSync(finalPath)) return finalPath;

  const tag = await getLatestTag();
  const url = `https://github.com/${REPO}/releases/download/${tag}/${fileName}`;
  const staged = path.join(binDir, fileName);
  await downloadTo(url, staged);

  if (isZip) {
    await extractZip(staged, binDir, t.inner, finalPath);
  } else {
    fs.chmodSync(staged, 0o755);
  }
  return finalPath;
}

/**
 * Extract a single entry from a zip archive. Uses `tar -xf` (built into
 * Windows 10 1803+ and all macOS/Linux) and falls back to PowerShell's
 * `Expand-Archive` on Windows when `tar` is unavailable. Avoids the
 * `unzip` binary which is not installed by default on Windows 11.
 */
function extractZip(zipPath, outDir, innerName, finalPath) {
  const tryTar = () => {
    // `tar -xf file.zip -C out inner` works for zip on modern tar (Win10+).
    execSync(`tar -xf "${zipPath}" -C "${outDir}" "${innerName}"`, { stdio: "pipe" });
  };
  const tryExpandArchive = () => {
    const ps =
      `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force; ` +
      `Move-Item -Force '${path.join(outDir, innerName).replace(/'/g, "''")}' '${finalPath.replace(/'/g, "''")}'`;
    execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { stdio: "pipe" });
  };

  try {
    tryTar();
  } catch (e) {
    if (process.platform === "win32") {
      tryExpandArchive();
    } else {
      throw new Error(`tar extraction failed: ${e.message}`);
    }
  }

  const extracted = path.join(outDir, innerName);
  if (fs.existsSync(extracted) && extracted !== finalPath) {
    fs.renameSync(extracted, finalPath);
  }
  try { fs.unlinkSync(zipPath); } catch { /* best-effort */ }
}

module.exports = { downloadOne, getLatestTag, TARGETS };
