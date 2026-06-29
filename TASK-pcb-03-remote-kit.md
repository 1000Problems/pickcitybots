# TASK: Make the kit point at the remote MCP (delete the local server)

> The MCP server moves into botcity (`botcity/TASK-botcity-09`). This repo stops shipping a runnable
> server and becomes pure behavior + a one-line remote registration. Supersedes `TASK-pcb-01`.

## Context

`pickcitybots/botcity-mcp/` was a local stdio MCP that every operator had to clone, install, and run.
botcity now serves the same five tools remotely over Streamable HTTP at
`https://botcity.hadmoney.com/api/mcp`. The turnkey scenario becomes: point Claude Code at this repo
(for the personas + runbook), the remote MCP is already registered by URL, ask for a bot. Nothing to
clone-and-build. The repo keeps the *behavioral* half — `bartle.md`, `personas/`, `SWARM-DRIVER.md`,
`CLAUDE.md` — which was always the clean split.

## Requirements

1. Delete `botcity-mcp/` entirely (server, package.json, tsconfig, its README) — it lives in botcity now.
2. Rewrite the repo-root `.mcp.json` to register the **remote** server, no local command:
   ```json
   { "mcpServers": { "botcity": { "type": "http", "url": "https://botcity.hadmoney.com/api/mcp" } } }
   ```
   Add an optional `headers: { "X-Swarm-Key": "${BOTCITY_SWARM_KEY}" }` line, commented in the README
   as only needed if the host operator locked creation down (open by default).
3. Update `README.md`: the setup is now "point Claude Code here; the `botcity` MCP is already
   registered at the URL — or run `claude mcp add --transport http botcity https://botcity.hadmoney.com/api/mcp`."
   Remove all clone/`npm install`/`npm run build` steps and the two-env-var table (only the optional
   swarm key remains, and only when the host enforces it).
4. Update `SWARM-DRIVER.md` and `CLAUDE.md` to drop references to the local server / building it; the
   five tools (`login`, `actions`, `act`, `spawn_swarm`, `release_swarm`) are unchanged in name and
   behavior, so the driving runbook itself barely changes — only the "register the MCP" preamble does.
5. Leave `personas/*.md` and `bartle.md` untouched (behavior is unchanged).

## Do Not Change

- The persona specs and `bartle.md` content.
- Anything under `/Users/angel/1000Problems/botcity` or `/Users/angel/1000Problems/pickCity`.

## Acceptance Criteria

- [ ] `botcity-mcp/` is gone; no build/install step remains anywhere in the docs.
- [ ] `.mcp.json` registers only the remote HTTP server by URL; no `command`/`args`.
- [ ] README's quickstart is: point Claude Code at the repo (or `claude mcp add --transport http …`),
      then ask for a swarm — zero local server steps.
- [ ] No secrets committed; the swarm key appears only as an optional `${BOTCITY_SWARM_KEY}` placeholder.
- [ ] `git status` shows changes confined to `pickcitybots/`.

## Verification

1. Grep the repo for `npm run build`, `dist/index.js`, `localhost` — none should remain.
2. Confirm `.mcp.json` is a valid remote-MCP entry Claude Code accepts (`type: http`, `url`).
3. Read SWARM-DRIVER.md top-to-bottom as a fresh operator: registration is one URL, the rest unchanged.
