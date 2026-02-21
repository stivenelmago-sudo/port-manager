/**
 * PortPilot - Container Service
 *
 * Detects and lists containers across multiple runtimes:
 *   - Docker (docker ps --format json)
 *   - Podman (podman ps --format json)
 *   - nerdctl (containerd)
 *   - K8s/Kubepods via crictl ps
 *   - LXC/LXD/Incus (lxc list / incus list)
 *
 * Each runtime is queried in parallel; failures are silent (a missing CLI is
 * not an error — the user just doesn't use that runtime).
 */

const { execFile } = require("child_process");
const { promisify } = require("util");
const { TIMEOUT } = require("./constants");

const execFileP = promisify(execFile);

const RUNTIMES = ["docker", "podman", "nerdctl", "crictl", "lxc", "incus"];

/**
 * Probe which container runtimes are installed on the system.
 * @returns {Promise<string[]>} list of installed runtime names
 */
async function detectRuntimes() {
  const found = await Promise.all(
    RUNTIMES.map(async (rt) => {
      try {
        await execFileP("which", [rt], { timeout: 2000 });
        return rt;
      } catch {
        return null;
      }
    })
  );
  return found.filter(Boolean);
}

async function listDocker() {
  const { stdout } = await execFileP("docker", ["ps", "-a", "--format", "{{json .}}", "--no-trunc"], {
    timeout: TIMEOUT.COMMAND,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      try {
        return normalizeContainer("docker", JSON.parse(line));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function listPodman() {
  const { stdout } = await execFileP("podman", ["ps", "-a", "--format", "json"], {
    timeout: TIMEOUT.COMMAND,
    maxBuffer: 8 * 1024 * 1024,
  });
  const arr = JSON.parse(stdout);
  return arr.map((c) => normalizeContainer("podman", c));
}

async function listNerdctl() {
  const { stdout } = await execFileP("nerdctl", ["ps", "-a", "--format", "{{json .}}"], {
    timeout: TIMEOUT.COMMAND,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      try {
        return normalizeContainer("nerdctl", JSON.parse(line));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function listCrictl() {
  const { stdout } = await execFileP("crictl", ["ps", "-a", "-o", "json"], {
    timeout: TIMEOUT.COMMAND,
    maxBuffer: 8 * 1024 * 1024,
  });
  const arr = JSON.parse(stdout);
  return (arr.containers || arr || []).map((c) =>
    normalizeContainer("k8s", {
      Names: c.metadata?.name,
      Image: c.image?.image,
      State: c.state,
      Status: c.status?.reason || c.state,
      Command: (c.command || "").trim(),
      Ports: (c.portMappings || []).map((p) => `${p.containerPort}/${p.protocol || "tcp"}`).join(", "),
      Id: c.id,
      CreatedAt: c.createdAt,
    })
  );
}

async function listLxc(runtime = "lxc") {
  const { stdout } = await execFileP(runtime, ["list", "--format", "json"], {
    timeout: TIMEOUT.COMMAND,
    maxBuffer: 4 * 1024 * 1024,
  });
  const arr = JSON.parse(stdout);
  return arr.map((c) =>
    normalizeContainer(runtime, {
      Names: c.name,
      Image: c.config?.["image.os"] || c.config?.["volatile.base_image"] || "",
      State: c.state,
      Status: c.status || c.state,
      Command: "",
      Ports: "",
      Id: c.name,
      CreatedAt: c.created_at,
    })
  );
}

function normalizeContainer(runtime, c) {
  let name = c.Names || c.Name || c.name || "";
  if (Array.isArray(name)) name = name[0] || "";
  name = String(name).replace(/^\//, "");

  let status = c.Status || c.status || c.state || "";
  let state = c.State || c.state || "";
  if (typeof state === "object") state = state.Status || state.status || JSON.stringify(state);

  return {
    runtime,
    id: c.Id || c.id || c.ID || c.containerID || name,
    name,
    image: c.Image || c.image || "",
    state: String(state).toUpperCase(),
    status: String(status),
    command: typeof c.Command === "string" ? c.Command : (c.Command || c.command || "").toString(),
    ports: typeof c.Ports === "string" ? c.Ports : "",
    created: c.CreatedAt || c.createdAt || c.Created || "",
  };
}

async function runtimeAction(runtime, id, action) {
  const cmd = ["docker", "podman", "nerdctl"].includes(runtime) ? runtime : "docker";
  let args;
  switch (action) {
    case "stop":    args = [cmd, "stop", id]; break;
    case "restart": args = [cmd, "restart", id]; break;
    case "start":   args = [cmd, "start", id]; break;
    case "pause":   args = [cmd, "pause", id]; break;
    case "unpause": args = [cmd, "unpause", id]; break;
    case "logs":
      return execFileP(cmd, ["logs", "--tail", "200", id], { timeout: 5000 }).then((r) => r.stdout + r.stderr).catch((e) => e.stdout || e.message);
    case "inspect":
      return execFileP(cmd, ["inspect", id], { timeout: 5000 }).then((r) => r.stdout).catch((e) => e.stdout || e.message);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
  await execFileP(args[0], args.slice(1), { timeout: TIMEOUT.KILL });
  return null;
}

async function inspectContainer(runtime, id) {
  if (["docker", "podman", "nerdctl"].includes(runtime)) {
    const { stdout } = await execFileP(runtime, ["inspect", id], { timeout: 5000 });
    const arr = JSON.parse(stdout);
    return arr[0] || {};
  }
  if (runtime === "lxc" || runtime === "incus") {
    const { stdout } = await execFileP(runtime, ["config", "show", id, "--expanded"], { timeout: 5000 });
    return { raw: stdout };
  }
  return {};
}

/**
 * Top-level: list containers across ALL installed runtimes in parallel.
 * Best-effort: a failing runtime is skipped silently.
 * Each runtime is wrapped in a per-call timeout so a stuck daemon doesn't
 * hang the UI.
 *
 * @returns {Promise<{containers: Array, runtimes: string[]}>}
 */
async function listContainers() {
  const runtimes = await detectRuntimes();
  const tasks = [];
  const wrap = (p) =>
    Promise.race([
      p.catch(() => []),
      new Promise((r) => setTimeout(() => r([]), 4000)),
    ]);
  if (runtimes.includes("docker")) tasks.push(wrap(listDocker()));
  if (runtimes.includes("podman")) tasks.push(wrap(listPodman()));
  if (runtimes.includes("nerdctl")) tasks.push(wrap(listNerdctl()));
  if (runtimes.includes("crictl")) tasks.push(wrap(listCrictl()));
  if (runtimes.includes("lxc")) tasks.push(wrap(listLxc("lxc")));
  if (runtimes.includes("incus")) tasks.push(wrap(listLxc("incus")));

  const results = await Promise.all(tasks);
  const containers = results.flat();
  return { containers, runtimes };
}

module.exports = {
  detectRuntimes,
  listContainers,
  listDocker,
  listPodman,
  listCrictl,
  listLxc,
  inspectContainer,
  runtimeAction,
};
