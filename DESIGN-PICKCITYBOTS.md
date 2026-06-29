# pickcitybots — design of record

The **public** half of the bot system. `botcity` (private) is the host under test — it owns the
database, the `/api/play/*` affordance API, the Floor, **and now the bot pool and its memory**.
`pickcitybots` (this repo, public) is the **swarm kit**: the MCP server, the Bartle vocabulary, the
persona specs, and the driver runbook. It holds **zero state**. When Claude Code wants a social
bot, it *asks botcity for one* and is handed the bot's credentials and its history. botcity
remembers; the kit just drives.

This is the key move: the registry doesn't live in the repo (would leak handles, need commit/push,
break across machines) and it doesn't live in a service we stand up. It lives in **the database
botcity already has**, exposed through two endpoints. The public kit stays a thin, stateless
client.

## Two scenarios this serves

1. **Stranger, cold.** I hand out the GitHub link. Their Claude Code points at it, asks botcity for
   bots, and drives them. They store nothing locally; botcity is the single source of truth.
2. **Me, returning.** I say *"10 social, 1 killer, 5 adventurers, make it feel alive."* The kit asks
   botcity for that mix; botcity hands back **existing idle bots with their accumulated history**
   where it has them and **mints new ones** where it's short. Next time, those new ones are reusable
   too — because botcity kept them.

## The heart: acquire a bot from botcity, get credentials + history

Two new host endpoints, gated by a shared `BOTCITY_SWARM_KEY` (minting identities is privileged):

```
POST /api/play/swarm/acquire { type, handle?, fresh? }
  → { handle, token, type, history, memory }
POST /api/play/swarm/release { handle, memory? }
  → { ok }
```

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
  "recentRooms": ["Barcelona GP"], "lastPicks": ["ver","nor","lec","..."] }
```

**memory** is a per-bot character blob (`app_user.bot_memory jsonb`) the driver reads and, on
`release`, writes back: "warm, F1 puns, friendly rival with kil-rex." The account remembers what the
bot *did*; `bot_memory` remembers who it *is*. Both live in botcity, so the kit stays stateless and
the cast is identical from any machine.

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

`spawn_swarm({ socializer: 10, killer: 1, explorer: 5 })` in the MCP just loops `acquire`:

1. Call `acquire({ type })` N times per type (or one batch call — see Decisions).
2. botcity returns a roster of `{ handle, token, type, history, memory, reused }` — reused where it
   had idle bots, freshly minted where it didn't.
3. The driver applies `personas/<type>.md` to each, seeding voice from `memory` and history.
4. On teardown, `release` each handle (memory written back); anything missed expires in 2h.

"Reuse if we have one, else create and keep it" is `acquire` itself — one host call, no kit-side
bookkeeping.

## Repo layout (stateless)

```
pickcitybots/
  CLAUDE.md              # "this is the swarm kit — read SWARM-DRIVER.md"
  .mcp.json              # registers the botcity MCP (env var NAMES only, no values)
  README.md              # the two scenarios + setup
  bartle.md              # the four types + population dynamics (public research, safe)
  SWARM-DRIVER.md        # parse a composition, acquire bots, drive personas, release
  personas/  socializer.md killer.md explorer.md achiever.md
  botcity-mcp/  src/ package.json README.md
```

No `roster/` — the roster is in botcity now.

## What the host needs (additive, on botcity's own DB)

Per the two-places rule (`schema.sql` + `migrate-additive.mjs`, run on botcity's DB before deploy),
all bot-only and ignored by other 1000Problems projects:

- `app_user.is_bot boolean default false` — filter/count/purge bots on the Floor (already in TASK-02).
- `app_user.bot_type text` — the persona type, so `acquire` can match by it.
- `app_user.acquired_until timestamptz` — the lease.
- `app_user.bot_memory jsonb` — the character blob.
- New endpoints `POST /api/play/swarm/acquire` and `/release`, gated by `BOTCITY_SWARM_KEY`.
  Login stays deterministic (handle → stable email) so a recalled bot returns its real account.

Two-tier auth: the **swarm key** acquires identities (privileged); the **per-bot HMAC bearer**
returned by acquire drives that bot's `act`/`actions` (normal). The swarm key is an env var in the
Claude Code MCP entry — never committed to this public repo.

## Persona binding stays in the driver

Identity and history come from botcity (handle, type, history, memory); behavior comes from
`personas/<type>.md` — a policy over the host's affordance menu plus a chat voice. The host hands
each bot its `available_actions`; the persona biases which it favors and how it banters, now warmed
by the bot's own past. Nothing about acquire changes that seam.

## Why this is the right fix

Bartle's thesis is population dynamics **over time** — Socializers compounding, Killers suppressing
them, Explorers anchoring. None of it is visible with accounts that reset each session. Letting
botcity hand back a bot *with its history* gives every run continuity for free: last month's cast
walks back onto the Floor with their trophies and their grudges, from any machine, with the kit
storing nothing. That's the longitudinal lab the static lobby never was.

## Decisions I want ruled before code

1. **Batch acquire, or one-at-a-time?** A single `POST /api/play/swarm/acquire { composition }`
   returning the whole roster is one round-trip and lets botcity balance the LRU pool in one pass; N
   single calls are simpler but chattier. I lean **batch**. Confirm.
2. **LRU reuse, or stable named cast?** Reuse defaults to least-recently-used so the cast rotates and
   spreads wear. If you want *the same* aria/rex every time for continuity, the kit passes explicit
   `handle`s for your protagonists and lets filler go LRU. I'd do LRU for filler, named for
   protagonists. Tell me if you want it uniform.
