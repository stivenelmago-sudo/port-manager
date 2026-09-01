/**
 * PortPilot - WITR Host Detection
 *
 * Detects the extension host platform + architecture and resolves the bundled
 * `witr` binary path inside the extension's resources/bin/ directory.
 *
 * Reuses WITR's static binaries (https://github.com/pranshuparmar/witr/releases)
 * bundled per-platform via CI matrix — see scripts/download-witr.js.
 */

const os = require("os");
const path = require("path");

const PLATFORM = os.platform();
const ARCH = os.arch();

/**
 * Map (platform, arch) → bundled binary filename.
 * iOS / unsupported hosts return null and the caller must degrade gracefully.
 */
function resolveBinaryName() {
  if (PLATFORM === "linux") {
    if (ARCH === "x64") return "witr-linux-amd64";
    if (ARCH === "arm64") return "witr-linux-arm64";
    return null;
  }
  if (PLATFORM === "darwin") {
    if (ARCH === "x64") return "witr-darwin-amd64";
    if (ARCH === "arm64") return "witr-darwin-arm64";
    return null;
  }
  if (PLATFORM === "win32") {
    if (ARCH === "x64") return "witr-windows-amd64.exe";
    if (ARCH === "arm64") return "witr-windows-arm64.exe";
    return null;
  }
  return null;
}

/**
 * Best-effort detection of the Linux package family from /etc/os-release.
 * Only used for telemetry/debug — we bundle static binaries so pkg family is
 * irrelevant at runtime.
 */
function guessLinuxPkgFamily() {
  try {
    const fs = require("fs");
    const r = fs.readFileSync("/etc/os-release", "utf8");
    if (/ID=alpine/i.test(r)) return "apk";
    if (/ID_LIKE=.*(rhel|fedora|centos|suse)/i.test(r)) return "rpm";
    return "deb";
  } catch {
    return "deb";
  }
}

/**
 * Whether the current host can run WITR.
 * iOS / unknown platforms return false.
 */
function isSupported() {
  return resolveBinaryName() !== null;
}

/**
 * Resolve the absolute path to the bundled witr binary for this host.
 * @param {vscode.ExtensionContext} ctx
 * @returns {string|null} absolute path, or null if unsupported
 */
function binaryPath(ctx) {
  const name = resolveBinaryName();
  if (!name) return null;
  if (ctx && typeof ctx.asAbsolutePath === "function") {
    return ctx.asAbsolutePath(path.join("resources", "bin", name));
  }
  // Fallback for tests or callers without a real ExtensionContext: resolve
  // relative to the repo root so behavior is consistent.
  return path.resolve(__dirname, "..", "..", "resources", "bin", name);
}

/**
 * Detect a remote (WSL/SSH/Dev Container) host. On those, the extension host
 * runs on the remote machine so process.platform reflects the remote OS.
 * Already handled by resolveBinaryName — kept here for future per-target logic.
 */
function isRemote() {
  return !!(
    process.env.WSL_DISTRO_NAME ||
    process.env.SSH_CONNECTION ||
    process.env.REMOTE_CONTAINERS
  );
}

module.exports = {
  PLATFORM,
  ARCH,
  resolveBinaryName,
  guessLinuxPkgFamily,
  isSupported,
  isRemote,
  binaryPath,
};
