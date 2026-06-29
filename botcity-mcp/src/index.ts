#!/usr/bin/env node
/**
 * botcity-mcp — a thin, stateless MCP server over botcity's /api/play/* API.
 *
 * It logs bots in, relays the host's affordance menu, acts, and acquires whole
 * swarms from botcity's pool. It holds no game rules, no persona logic, and no
 * durable registry — botcity owns all of that. The only state here is an
 * in-memory roster (handle -> { token, type }) rebuilt each session.
 *
 * Configured by two env vars ONLY:
 *   BOTCITY_BASE_URL   (default http://localhost:3000)
 *   BOTCITY_SWARM_KEY  (required for spawn_swarm / release_swarm)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---- config (env only; no secrets committed) --------------------------------

const BASE_URL = (process.env.BOTCITY_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const SWARM_KEY = process.env.BOTCITY_SWARM_KEY ?? "";

// ---- in-memory roster (never persisted to disk) -----------------------------

type RosterEntry = { token: string; type?: string };
const roster = new Map<string, RosterEntry>();

function tokenFor(handle: string): string {
  const entry = roster.get(handle);
  if (!entry) {
    throw new Error(
      `Unknown bot "${handle}". Log it in with login() or acquire it via spawn_swarm() first.`
    );
  }
  return entry.token;
}

// ---- HTTP helper ------------------------------------------------------------

async function httpJson(
  method: "GET" | "POST",
  path: string,
  opts: { token?: string; swarmKey?: boolean; body?: unknown } = {}
): Promise<any> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  if (opts.swarmKey) {
    if (!SWARM_KEY) {
      throw new Error(
        "BOTCITY_SWARM_KEY is not set; swarm acquire/release is privileged and requires it."
      );
    }
    headers["x-swarm-key"] = SWARM_KEY;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let parsed: any = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed ?? "");
    throw new Error(`botcity ${method} ${path} → ${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }

  return parsed;
}

function asResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

// ---- server -----------------------------------------------------------------

const server = new McpServer({ name: "botcity-mcp", version: "0.1.0" });

// login: authenticate one bot by handle, cache its bearer, return its actions.
server.tool(
  "login",
  "Log a single bot in by handle and cache its bearer; returns its available_actions.",
  { handle: z.string().describe("The bot's display name / handle to log in as.") },
  async ({ handle }) => {
    const login = await httpJson("POST", "/api/play/login", { body: { name: handle } });
    const token: string = login.token;
    const playerId = login.playerId ?? login.player_id ?? login.id;
    if (!token) throw new Error("login() got no token back from botcity.");
    roster.set(handle, { token, type: login.type });

    let available_actions = login.available_actions;
    if (available_actions === undefined) {
      try {
        const actions = await httpJson("GET", "/api/play/actions", { token });
        available_actions = actions.available_actions;
      } catch {
        // host may surface actions only via actions(); leave undefined if so.
      }
    }

    return asResult({ playerId, handle, available_actions });
  }
);

// actions: pull a bot's current state + the host's legal-move menu.
server.tool(
  "actions",
  "Get a bot's current state and the host's available_actions menu.",
  { bot: z.string().describe("Handle of an already logged-in / acquired bot.") },
  async ({ bot }) => {
    const data = await httpJson("GET", "/api/play/actions", { token: tokenFor(bot) });
    return asResult({ state: data.state, available_actions: data.available_actions });
  }
);

// act: enact one affordance for a bot; host stays the catalog owner.
server.tool(
  "act",
  "Perform one host affordance for a bot (e.g. make_picks, send_chat); returns result + next available_actions.",
  {
    bot: z.string().describe("Handle of the acting bot."),
    action: z.string().describe("Action name from available_actions (e.g. create_private_game, send_chat)."),
    args: z
      .record(z.any())
      .optional()
      .describe("Action arguments as expected by the host (opaque to the MCP)."),
  },
  async ({ bot, action, args }) => {
    const data = await httpJson("POST", "/api/play/act", {
      token: tokenFor(bot),
      body: { action, args: args ?? {} },
    });
    return asResult({
      ok: data.ok ?? true,
      result: data.result,
      available_actions: data.available_actions,
    });
  }
);

// spawn_swarm: acquire a whole composition from botcity's pool in one batch.
server.tool(
  "spawn_swarm",
  "Acquire a swarm from botcity's pool by composition (e.g. {socializer:10,killer:1,explorer:5}); caches bearers, returns the roster.",
  {
    composition: z
      .record(z.number().int().nonnegative())
      .describe('Map of bot type -> count, e.g. {"socializer":10,"killer":1,"explorer":5}.'),
  },
  async ({ composition }) => {
    const data = await httpJson("POST", "/api/play/swarm/acquire", {
      swarmKey: true,
      body: { composition },
    });
    const bots: any[] = Array.isArray(data) ? data : data.roster ?? data.bots ?? [];
    const out = bots.map((b) => {
      if (b?.handle && b?.token) roster.set(b.handle, { token: b.token, type: b.type });
      return {
        handle: b.handle,
        type: b.type,
        reused: b.reused ?? false,
        history: b.history,
        memory: b.memory,
      };
    });
    return asResult(out);
  }
);

// release_swarm: free leases and write back any updated per-bot memory.
server.tool(
  "release_swarm",
  "Release acquired bots back to the pool, optionally writing back updated per-bot memory.",
  {
    handles: z.array(z.string()).describe("Handles to release."),
    memory: z
      .record(z.any())
      .optional()
      .describe("Optional map of handle -> updated memory blob to persist on release."),
  },
  async ({ handles, memory }) => {
    const data = await httpJson("POST", "/api/play/swarm/release", {
      swarmKey: true,
      body: { handles, memory: memory ?? {} },
    });
    for (const h of handles) roster.delete(h);
    return asResult({ ok: data?.ok ?? true, released: handles });
  }
);

// ---- boot -------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP transport.
  console.error(`botcity-mcp ready → ${BASE_URL}`);
}

main().catch((err) => {
  console.error("botcity-mcp fatal:", err);
  process.exit(1);
});
