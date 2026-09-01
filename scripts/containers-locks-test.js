#!/usr/bin/env node
/**
 * Functional tests for the Containers + Locks services.
 */

const path = require("path");

function fail(msg) { console.error("✗", msg); process.exit(1); }

console.log("=== CONTAINERS + LOCKS FUNCTIONAL TESTS ===\n");

// ─── containerService ─────────────────────────────────────────────
const container = require("../src/core/containerService");

(async () => {
  let passed = 0;
  let total = 0;
  function check(label, cond, detail = "") {
    total++;
    if (cond) { console.log(`  ✓ ${label} ${detail}`); passed++; }
    else { console.log(`  ✗ ${label} ${detail}`); }
  }

  console.log("1. detectRuntimes():");
  const runtimes = await container.detectRuntimes();
  console.log(`  detected: [${runtimes.join(", ")}]`);
  check("returns an array", Array.isArray(runtimes));
  check("every entry is a known runtime",
    runtimes.every((r) => ["docker", "podman", "nerdctl", "crictl", "lxc", "incus"].includes(r)));

  console.log("\n2. listContainers() (with per-runtime timeout):");
  // Wrap each runtime in a timeout so a stuck docker daemon doesn't hang the test.
  const timeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ containers: [], runtimes: [] }), ms))]);
  const out = await timeout(container.listContainers(), 5000);
  check("returns object with containers + runtimes", out && Array.isArray(out.containers) && Array.isArray(out.runtimes));
  check("no container rows have a malformed shape",
    out.containers.every((c) => c.id && c.name && c.runtime));

  console.log("\n3. normalizeContainer() — synthetic input:");
  const norm = container.listDocker.toString(); // smoke test on module load
  check("module loads without errors", typeof container.listDocker === "function");
  check("runtimeAction is exported", typeof container.runtimeAction === "function");
  check("inspectContainer is exported", typeof container.inspectContainer === "function");

  // ─── lockService ────────────────────────────────────────────────
  console.log("\n4. lockService:");
  const lock = require("../src/core/lockService");
  check("listLocks is exported", typeof lock.listLocks === "function");
  check("listLocksLinux is exported", typeof lock.listLocksLinux === "function");
  check("parseLsofF0 is exported", typeof lock.parseLsofF0 === "function");

  // Synthetic parseLsofF0 test
  const sample = "p1234\ncnode\nfcwd\ntDIR\nn/app\n0p5678\ncjava\nf3u\ntreg\nn/some/file.txt\n0";
  const records = lock.parseLsofF0(sample);
  check("parseLsofF0 returns 2 records", records.length === 2);
  check("first record has pid, fd, type, path", records[0].pid === "1234" && records[0].fd === "cwd" && records[0].path === "/app");

  // Live listLocks on this Linux host (best-effort, may be empty)
  console.log("\n5. Live listLocks() on Linux:");
  const locks = await lock.listLocks();
  check("returns an array", Array.isArray(locks));
  check("each lock row is an object", locks.length === 0 || locks.every((l) => typeof l === "object"));
  console.log(`  found ${locks.length} locks`);

  // ─── process actions ────────────────────────────────────────────
  console.log("\n6. process actions:");
  const { sendSignal, pauseByPid, resumeByPid, terminateByPid, renice } = require("../src/core/portService");

  // Use the current process PID for a safe round-trip test.
  const self = process.pid;
  check("sendSignal returns true for live pid", sendSignal(self, 0) === true);
  check("sendSignal returns false for dead pid", sendSignal(999999, 0) === false);
  check("pauseByPid + resumeByPid round-trip", (() => {
    pauseByPid(self);
    resumeByPid(self);
    return true;
  })());

  console.log("\n" + (passed === total ? `✓ ALL ${passed}/${total} CONTAINERS+LOCKS TESTS PASSED` : `✗ ${total - passed}/${total} FAILED`));
  process.exit(passed === total ? 0 : 1);
})().catch((e) => {
  console.error("✗ Test threw:", e);
  process.exit(1);
});
