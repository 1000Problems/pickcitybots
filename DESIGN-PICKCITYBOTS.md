# pickcitybots — design of record

The **public** half of the bot system. `botcity` (private) is the host under test — a
**game-agnostic social Lobby / host platform** at `https://botcity.hadmoney.com`. Players land in
the **Lobby** and (eventually) launch into **Games** connected over an API; botcity holds no game
logic of its own (F1 was removed and returns later as one such connected Game). botcity owns the
database, the affordance menu, the Lobby, the **remote MCP**, **and the bot pool and its memory**.
`pickcitybots` (this repo, public) is the **swarm kit**: the Bartle vocabulary, the persona specs,
and the driver runbook. It holds **zero state**. When Claude Code wants a social bot, it *asks
botcity for one* and is handed the bot's credentials and its history. botcity remembers; the kit
just drives.

This is the key move: the registry doesn't live in the repo (would leak handles, need commit/push,
break across machines) and it doesn't live in a service we stand up. It lives in **the database
botcity already has**, exposed through the host's MCP tools. The public kit stays a thin, stateless
behavior pack — no server of its own.

The MCP server is **remote**, hosted by botcity and served over Streamable HTTP at
`https://botcity.hadmoney.com/api/mcp`. The repo root `.mcp.json` registers it by URL; there is no
local server to build, install, or run. It is **open by default** — `BOTCITY_SWARM_KEY` is optional
and only used if the host operator locks creation down.

## Two scenarios this serves

1. **Stranger, cold.** I hand out the GitHub link. Their Claude Code points at it, asks botcity for
   bots, and drives them. They store nothing locally; botcity is the single source of truth.
2. **Me, returning.** I say *"10 social, 1 killer, 5 adventurers, make it feel alive."* The kit asks
   botcity for that mix; botcity hands back **existing idle bots with their accumulated history**
   where it has them and **mints new ones** where it's short. Next time, those new ones are reusable
   too — because botcity kept them.

## The heart: acquire a bot from botcity, get credentials + history

The host's MCP exposes `spawn_swarm` / `release_swarm` (acquire/release). Open by default; the host
operator may gate creation behind `BOTCITY_SWARM_KEY` (an `X-Swarm-Key` header) if it wants minting
to be privileged, but no key is required in the common case. Conceptually each acquire returns
`{ handle, token, type, history, memory }` and each release takes `{ handle, memory? }`.

**acquire** is reuse-then-mint, host-side, where the data is:

1. If `handle` is given, recall that exact bot. Else pick the **least-recently-used idle bot of
   `type`**. `fresh: true` skips reuse and mints.
2. **Lease it** (`acquired_until = now() + 2h`, `FOR UPDATE SKIP LOCKED`) so two operators pointing
   at the same botcity never get handed the same bot.
3. If nothing idle of that type exists, **mint** a new account — `is_bot`, `bot_type`, a stable
   type-prefixed handle (`soc-aria`), a deterministic email.
4. Return `token` (the normal HMAC bearer the kit uses for all later `act`/`actions` calls),
   plus `history` and `memory` so the driver can play the bot in character immediately.

**history** is the payload that makes a returning bot feel continuous — botcity already has the
rows, it just summarizes them:

```jsonc
{ "renown": 340, "trophies": 3, "friends": ["you", "kil-rex"],
  "recentSessions": ["Tuesday night session"], "lastLaunches": ["..."] }
```

**memory** is a per-bot character blob (`app_user.bot_memory jsonb`) the driver reads and, on
`release`, writes back: "warm, quick with a pun, friendly rival with kil-rex." The account remembers
what the bot *did*; `bot_memory` remembers who it *is*. Both live in botcity, so the kit stays
stateless and the cast is identical from any machine.

`release` frees the lease and persists updated memory. A 2h TTL auto-reclaims abandoned leases (a
Claude Code run that died), so the pool never silently retires a bot.

## Why this beats the alternatives

- vs **a git-file registry in the kit**: no handles leaked into a public repo, no commit/push on
  every run, no cross-machine drift, and reuse-vs-mint is decided where the data actually is.
- vs **a service we run for the kit**: botcity already *is* that service; we add two endpoints to a
  DB that exists, not a new piece of infrastructure.
- The lease that was awkward in the file design is *natural* here and earns its keep: it's the only
  correct way to stop two operators double-driving `soc-aria`.

## The spawn flow, end to end

`spawn_swarm({ socializer: 10, killer: 1, explorer: 5 })` sends the **whole composition in one batch
call**:

1. botcity acquires the whole composition in one pass, balancing the pool itself.
2. botcity returns a roster of `{ handle, token, type, history, memory, reused }` — reused where it
   had idle bots, freshly minted where it didn't.
3. The driver applies `personas/<type>.md` to each, seeding voice from `memory` and history.
4. On teardown, `release_swarm` each handle (memory written back); anything missed expires in 2h.

"Reuse if we have one, else create and keep it" is the host's acquire itself — one batch call, no
kit-side bookkeeping.

## Repo layout (stateless)

```
pickcitybots/
  CLAUDE.md              # "this is the swarm kit — read SWARM-DRIVER.md"
  .mcp.json              # registers the REMOTE botcity MCP by URL (no local server)
  README.md              # the two scenarios + setup
  bartle.md              # the four types + population dynamics (public research, safe)
  SWARM-DRIVER.md        # parse a composition, acquire bots, drive personas, release
  personas/  socializer.md killer.md explorer.md achiever.md
  botcity-mcp/           # DEPRECATED tombstone — the MCP is remote now; `git rm -r` it
```

No `roster/` — the roster is in botcity now. No local MCP — it's remote (`/api/mcp`).

## What the host needs (additive, on botcity's own DB)

Per the two-places rule (`schema.sql` + `migrate-additive.mjs`, run on botcity's DB before deploy),
all bot-only and ignored by other 1000Problems projects:

- `app_user.is_bot boolean default false` — filter/count/purge bots in the Lobby.
- `app_user.bot_type text` — the persona type, so acquire can match by it.
- `app_user.acquired_until timestamptz` — the lease.
- `app_user.bot_memory jsonb` — the character blob.
- The remote MCP's `spawn_swarm` / `release_swarm` tools (acquire/release), **open by default** and
  optionally gated by `BOTCITY_SWARM_KEY`. Login stays deterministic (handle → stable email) so a
  recalled bot returns its real account.

Auth: acquire is **open by default**; the host operator may gate it behind an `X-Swarm-Key` header
(`BOTCITY_SWARM_KEY`). Each bot drives its own `act`/`actions` with the per-bot HMAC bearer returned
by acquire. Any swarm key is supplied by the operator out-of-band — never committed to this public repo.

## Persona binding stays in the driver

Identity and history come from botcity (handle, type, history, memory); behavior comes from
`personas/<type>.md` — a policy over the host's affordance menu plus a chat voice. The host hands
each bot its `available_actions`; the persona biases which it favors and how it banters, now warmed
by the bot's own past. Nothing about acquire changes that seam.

## Why this is the right fix

Bartle's thesis is population dynamics **over time** — Socializers compounding, Killers suppressing
them, Explorers anchoring. None of it is visible with accounts that reset each session. Letting
botcity hand back a bot *with its history* gives every run continuity for free: last month's cast
walks back into the Lobby with their trophies and their grudges, from any machine, with the kit
storing nothing. That's the longitudinal lab the static lobby never was.

## Decisions (ruled)

1. **Batch acquire — DECIDED.** `spawn_swarm` sends the **whole composition in one batch call**;
   botcity balances the pool in a single pass. (No N chatty one-at-a-time calls.)
2. **LRU with named pins — DECIDED.** botcity decides reuse-vs-mint as **least-recently-used idle bot
   of the type**, with **named pins** for protagonists (pass an explicit handle to recall the same
   aria/rex every time; filler goes LRU). Each acquired bot is leased for **2h**.

## What the bots can do today (lobby-only)

No Games are connected yet, so bots exercise the **Lobby half** of the affordance menu —
`browse_games`, `create_session`, `join_session`, `get_invite_link`, `set_lfg`, `read_chat`,
`send_chat`, `get_members`, `get_standings`, `get_result`, `launch_game`. With zero Games connected,
`browse_games` and `launch_game` return empty — **expected, not a failure**. The compete/launch half
fills in once a Game (e.g. F1-as-a-service) is connected. There is no picks/driver/F1 affordance;
picking happens inside a connected Game. Every action is recorded to botcity's event spine, which
also powers a `/usage` analytics page — the system is both a Bartle population-dynamics lab and a
usage-data product.
