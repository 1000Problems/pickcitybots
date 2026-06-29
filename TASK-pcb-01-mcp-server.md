# TASK: pickcitybots MCP server (thin, stateless)

> The seam between Claude Code and botcity. It logs bots in, relays the host's affordance menu, acts,
> and acquires whole swarms from botcity's pool. It holds no game rules, no persona logic, and no
> registry — botcity owns all of that.

## Context

`pickcitybots` is the **public** swarm kit (see `DESIGN-PICKCITYBOTS.md`); botcity is the private
host. This MCP is a stateless HTTP client over botcity's `/api/play/*` API. It supersedes the old
`TASK-botcity-03-mcp-swarm` (the MCP now lives in this public repo, and the registry moved into
botcity's DB — so `spawn_swarm` *acquires* from the host instead of minting locally). Configured by
two env vars only: `BOTCITY_BASE_URL`, `BOTCITY_SWARM_KEY`. Neither is committed.

## Requirements

1. Node/TypeScript MCP server at `pickcitybots/botcity-mcp/` using `@modelcontextprotocol/sdk`,
   stdio transport, per the `mcp-builder` skill conventions.
2. Tool `login({ handle })` → `POST /api/play/login`; stores the returned bearer under that handle;
   returns `{ playerId, handle, available_actions }`. Tracks many bots so one session drives a swarm.
3. Tools `actions({ bot })` → `GET /api/play/actions`, and `act({ bot, action, args })` →
   `POST /api/play/act`, each returning the host's `{ state, available_actions }` (and `result` for
   `act`) **unchanged**. These two are the entire gameplay surface — no per-action tools; the host
   stays the catalog owner.
4. Tool `spawn_swarm({ composition })` → `POST /api/play/swarm/acquire` (one batch call) with the
   `X-Swarm-Key` header. Stores each returned `{ handle, token, type }` in the in-memory roster and
   returns `[{ handle, type, reused, history, memory }]`. It does **not** drive behavior (that's the
   driver) and does **not** decide reuse (the host does).
5. Tool `release_swarm({ handles, memory? })` → `POST /api/play/swarm/release`, freeing leases and
   writing back any per-bot memory the driver updated.
6. Every tool result ends with the latest `available_actions` (where applicable) so the driver always
   has the next legal moves without a separate call.
7. A `botcity-mcp/README.md` with a copy-pasteable Claude Code MCP config entry (command, args, the
   two env vars). Plus a repo-root `.mcp.json` referencing env var **names** only, so pointing Claude
   Code at the repo auto-registers the server.

## Implementation Notes

- **Stay thin.** Resist `make_picks`/`create_game` tools — `act` + `actions` cover everything and let
  the host grow vocabulary with no MCP change.
- **Roster is in-memory only.** `handle -> { token, type }`; rebuilt each session by `spawn_swarm` /
  `login`. The durable registry is botcity's, not here — never write a roster file.
- The host returns `history`/`memory` on acquire; pass them through untouched for the driver to use.
- One-line tool descriptions; typed input schemas.

## Do Not Change

- botcity host code or its `/api/play/*` contracts — the MCP only calls the HTTP API. A new
  capability is a host task, never a workaround here.
- Persona semantics — naming bots by type is fine; how a type behaves is TASK-pcb-02.
- Production `pickCity/**` and any shared DB.

## Acceptance Criteria

- [ ] `npm run build` / `tsc` in `botcity-mcp/` compiles clean; no committed secrets.
- [ ] Registered in Claude Code, `login`/`actions`/`act` drive one bot through create→pick→chat→
      standings against a running botcity.
- [ ] `spawn_swarm({socializer:10,killer:1,explorer:5})` returns a 16-bot roster and all 16 show
      **online** on the botcity floor within seconds; reused bots carry prior `history`.
- [ ] `release_swarm` frees the leases (a subsequent `spawn_swarm` can reuse them).
- [ ] The MCP contains no hard-coded picks, chat lines, per-type behavior, or registry file.
- [ ] `.mcp.json` + README let a fresh session register the server from the repo with two env vars.

## Verification

1. Build; register per README.
2. Spawn the 10/1/5 mix; confirm 16 online on a previously empty floor and reused bots show history.
3. Drive one bot to a result via `act`/`actions`.
4. `release_swarm`; confirm the same handles come back reused on the next spawn.
