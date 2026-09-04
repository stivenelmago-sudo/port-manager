#!/usr/bin/env node
/**
 * PortPilot - postinstall hook
 *
 * Runs after `npm install`. For development installs (not the packaged
 * VSIX), this:
 *   1. Ensures the WITR ancestry binary is present for the current host
 *      (downloads it from upstream releases if missing).
 *   2. Registers the PortPilot MCP server in well-known client config
 *      files (Kilo, Claude Code, Claude Desktop, VS Code user mcp.json).
 *
 * Both steps are idempotent and can be skipped with PORTPILOT_SKIP_AUTOCONFIG=1
 * or `--no-autoconfig`.
 */

const path = require("path");

function shouldSkip() {
  if (process.env.PORTPILOT_SKIP_AUTOCONFIG === "1" || process.env.PORTPILOT_SKIP_AUTOCONFIG === "true") {
    return true;
  }
  if (process.argv.includes("--no-autoconfig")) return true;
  return false;
}

function log(msg) {
  process.stderr.write(`[portpilot-postinstall] ${msg}\n`);
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const autoConfig = require("../src/mcp/autoConfig");

  if (shouldSkip()) {
    log("skipped (opt-out)");
    return;
  }

  if (!autoConfig.isSupportedPlatform()) {
    log(`skipped (unsupported platform: ${process.platform})`);
    return;
  }

  // Skip when the extension is being installed as a VS Code dependency inside
  // another extension's node_modules — we don't want to mutate the user's
  // config files from there.
  if (repoRoot.includes(`${path.sep}node_modules${path.sep}`) && !repoRoot.endsWith(`${path.sep}node_modules${path.sep}portpilot`)) {
    log(`skipped (nested dependency: ${repoRoot})`);
    return;
  }

  // 1. WITR binary
  try {
    const witrResult = await autoConfig.ensureWitrBinary(repoRoot);
    if (witrResult.status === "downloaded") {
      log(`witr downloaded: ${witrResult.binaryPath}`);
    } else if (witrResult.status === "present") {
      log(`witr already present: ${witrResult.binaryPath}`);
    } else if (witrResult.status === "skipped") {
      log(`witr skipped: ${witrResult.error || "host unsupported"}`);
    } else if (witrResult.status === "error") {
      log(`witr download failed: ${witrResult.error}`);
    }
  } catch (e) {
    log(`witr step threw: ${e.message}`);
  }

  // 2. MCP registration
  const mcpEntry = path.join(repoRoot, "mcp-server", "index.js");
  try {
    const results = autoConfig.autoConfigure({
      mcpEntry,
      workspaceDir: process.cwd(),
      allowWorkspaceWrite: false, // postinstall must not create .vscode/mcp.json
      verbose: true,
    });
    const registered = results.filter((r) => r.status === "registered").length;
    const already = results.filter((r) => r.status === "already").length;
    const errors = results.filter((r) => r.status === "error").length;
    log(`mcp: ${registered} registered, ${already} already, ${errors} errors (of ${results.length} candidates)`);
  } catch (e) {
    log(`mcp step threw: ${e.message}`);
  }
}

main().catch((e) => {
  log(`fatal: ${e.stack || e.message}`);
  // Never fail the npm install over an auto-config issue.
  process.exit(0);
});
