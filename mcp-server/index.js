/**
 * PortPilot MCP Server
 *
 * Exposes the PortPilot extension's port-management capabilities to any MCP
 * client (Claude Code, Kilo, Cursor, etc.) over stdio.
 *
 * Reuses the extension's own modules (`src/core/portService`, `src/witr`)
 * so behaviour stays in lock-step with the sidebar panel.
 */

const path = require("path");
const fs = require("fs");

// Inject the vscode stub before any extension module is loaded.
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "vscode") {
    return path.join(__dirname, "vscode-stub.js");
  }
  return origResolve.call(this, request, parent, ...rest);
};

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const portService = require("../src/core/portService");
const witr = require("../src/witr");
const { PORT } = require("../src/core/constants");

const pkg = require("../package.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asText(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function asError(message, extra = {}) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message, ...extra }, null, 2),
      },
    ],
  };
}

function validatePort(port) {
  const n = Number(port);
  if (!Number.isInteger(n) || n < PORT.MIN || n > PORT.MAX) {
    throw new Error(`Invalid port: ${port}. Must be an integer in [${PORT.MIN}, ${PORT.MAX}].`);
  }
  return n;
}

function resolveWitrBinary() {
  const availability = witr.probe({
    asAbsolutePath: (p) => path.resolve(__dirname, "..", p),
  });
  return availability;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

const tools = {
  list_listening_ports: {
    description:
      "List all TCP ports currently in LISTEN state on this machine. Returns port, pid, process name, and (when available) the WITR ancestry chain explaining why the process exists.",
    inputSchema: {
      type: "object",
      properties: {
        enrich: {
          type: "boolean",
          default: true,
          description:
            "If true, include WITR ancestry/supervisor info (slower; requires the bundled witr binary).",
        },
      },
    },
    handler: async ({ enrich = true } = {}) => {
      if (enrich) {
        const availability = resolveWitrBinary();
        if (availability.status === "available") {
          const { ports } = await portService.getListeningPortsEnriched({
            witrBin: availability.binaryPath,
          });
          return asText({ count: ports.length, witr: availability, ports });
        }
        const ports = portService.getListeningPorts();
        return asText({ count: ports.length, witr: availability, ports });
      }
      const ports = portService.getListeningPorts();
      return asText({ count: ports.length, ports });
    },
  },

  check_port: {
    description:
      "Check whether a specific TCP port is free (i.e. no process is currently listening on it).",
    inputSchema: {
      type: "object",
      required: ["port"],
      properties: {
        port: { type: "integer", minimum: 1, maximum: 65535 },
      },
    },
    handler: async ({ port }) => {
      const p = validatePort(port);
      const free = await portService.checkPortFree(p);
      return asText({ port: p, free });
    },
  },

  find_ports_by_process: {
    description:
      "Return all listening ports whose process name (case-insensitive substring) matches the given query.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
        enrich: { type: "boolean", default: false },
      },
    },
    handler: async ({ query, enrich = false }) => {
      const q = String(query).toLowerCase();
      let ports;
      if (enrich) {
        const availability = resolveWitrBinary();
        if (availability.status === "available") {
          ({ ports } = await portService.getListeningPortsEnriched({
            witrBin: availability.binaryPath,
          }));
        } else {
          ports = portService.getListeningPorts();
        }
      } else {
        ports = portService.getListeningPorts();
      }
      const matches = ports.filter((p) => (p.process || "").toLowerCase().includes(q));
      return asText({ query, count: matches.length, ports: matches });
    },
  },

  get_port_info: {
    description:
      "Return detailed info for a specific listening port: pid, process, state, and WITR ancestry (when available).",
    inputSchema: {
      type: "object",
      required: ["port"],
      properties: {
        port: { type: "integer", minimum: 1, maximum: 65535 },
        enrich: { type: "boolean", default: true },
      },
    },
    handler: async ({ port, enrich = true }) => {
      const p = validatePort(port);
      let ports;
      if (enrich) {
        const availability = resolveWitrBinary();
        if (availability.status === "available") {
          ({ ports } = await portService.getListeningPortsEnriched({
            witrBin: availability.binaryPath,
          }));
        } else {
          ports = portService.getListeningPorts();
        }
      } else {
        ports = portService.getListeningPorts();
      }
      const hit = ports.find((row) => row.port === p);
      if (!hit) {
        return asText({ port: p, listening: false, free: await portService.checkPortFree(p) });
      }
      return asText({ port: p, listening: true, info: hit });
    },
  },

  kill_port: {
    description:
      "Kill the process listening on the given port. Requires confirm=true to execute. Uses SIGTERM with a 3s grace period, escalating to SIGKILL on POSIX; uses taskkill on Windows.",
    inputSchema: {
      type: "object",
      required: ["port", "confirm"],
      properties: {
        port: { type: "integer", minimum: 1, maximum: 65535 },
        confirm: {
          type: "boolean",
          description: "Must be true to actually kill. Defaults are never destructive.",
        },
        graceMs: {
          type: "integer",
          minimum: 0,
          maximum: 60000,
          default: 3000,
          description: "Time to wait between SIGTERM and SIGKILL escalation (ms).",
        },
      },
    },
    handler: async ({ port, confirm, graceMs = 3000 }) => {
      if (!confirm) {
        return asError("Refusing to kill: confirm must be true.", { hint: "Pass confirm: true." });
      }
      const p = validatePort(port);
      const ports = portService.getListeningPorts();
      const hit = ports.find((row) => row.port === p);
      if (!hit) {
        return asError(`No process is listening on port ${p}.`);
      }
      if (hit.pid == null) {
        return asError(`Port ${p} has no resolvable PID; cannot kill.`);
      }
      try {
        const result = await portService.killGraceful(hit.pid, graceMs);
        return asText({ port: p, pid: hit.pid, process: hit.process, result });
      } catch (e) {
        return asError(`Failed to kill PID ${hit.pid} (port ${p}): ${e.message}`);
      }
    },
  },

  kill_pid: {
    description:
      "Kill an arbitrary process by PID. Requires confirm=true. Same escalation rules as kill_port.",
    inputSchema: {
      type: "object",
      required: ["pid", "confirm"],
      properties: {
        pid: { type: "integer", minimum: 1 },
        confirm: { type: "boolean" },
        graceMs: { type: "integer", minimum: 0, maximum: 60000, default: 3000 },
      },
    },
    handler: async ({ pid, confirm, graceMs = 3000 }) => {
      if (!confirm) {
        return asError("Refusing to kill: confirm must be true.", { hint: "Pass confirm: true." });
      }
      const p = Number(pid);
      if (!Number.isInteger(p) || p < 1) {
        return asError(`Invalid pid: ${pid}`);
      }
      try {
        const result = await portService.killGraceful(p, graceMs);
        return asText({ pid: p, result });
      } catch (e) {
        return asError(`Failed to kill PID ${p}: ${e.message}`);
      }
    },
  },

  witr_availability: {
    description:
      "Report whether the WITR ancestry binary is available on this host and where it is resolved from.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const availability = resolveWitrBinary();
      return asText(availability);
    },
  },
};

// ---------------------------------------------------------------------------
// Server wiring
// ---------------------------------------------------------------------------

const server = new Server(
  {
    name: "portpilot",
    version: pkg.version,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(tools).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: def.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const tool = tools[name];
  if (!tool) {
    return asError(`Unknown tool: ${name}`);
  }
  try {
    return await tool.handler(args);
  } catch (e) {
    return asError(`Tool ${name} failed: ${e.message}`);
  }
});

// Expose a small set of static resources so clients can read extension metadata.
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "portpilot://manifest",
        name: "PortPilot Manifest",
        description: "Extension metadata (name, version, commands, configuration keys).",
        mimeType: "application/json",
      },
      {
        uri: "portpilot://witr",
        name: "WITR Availability",
        description: "Current WITR binary availability and resolved path.",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === "portpilot://manifest") {
    const contributes = pkg.contributes || {};
    const manifest = {
      name: pkg.name,
      displayName: pkg.displayName,
      version: pkg.version,
      description: pkg.description,
      publisher: pkg.publisher,
      engines: pkg.engines,
      categories: pkg.categories,
      keywords: pkg.keywords,
      commands: (contributes.commands || []).map((c) => c.command),
      configuration: Object.keys((contributes.configuration && contributes.configuration.properties) || {}),
    };
    return {
      contents: [
        { uri, mimeType: "application/json", text: JSON.stringify(manifest, null, 2) },
      ],
    };
  }
  if (uri === "portpilot://witr") {
    const availability = resolveWitrBinary();
    return {
      contents: [
        { uri, mimeType: "application/json", text: JSON.stringify(availability, null, 2) },
      ],
    };
  }
  throw new Error(`Unknown resource: ${uri}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so we never pollute the MCP stdio stream.
  process.stderr.write(`[portpilot-mcp] v${pkg.version} ready (stdio)\n`);
}

main().catch((err) => {
  process.stderr.write(`[portpilot-mcp] fatal: ${err.stack || err.message}\n`);
  process.exit(1);
});
