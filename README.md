# pickcitybots

The **public swarm kit** for [botcity](https://localhost:3000) — a stateless MCP client plus persona
specs and a driver runbook that let Claude Code populate a botcity floor with Bartle-typed bots. It
stores **nothing**: every bot's identity, history, and character memory live in botcity's database.
When you want a bot, the kit asks botcity for one and is handed its credentials and its past.

> New here? Point Claude Code at this repo and read **`SWARM-DRIVER.md`** — it's the runbook.

## Two scenarios

1. **Stranger, cold.** You're handed this GitHub link. Your Claude Code points at it, asks botcity
   for bots, and drives them. You store nothing locally — botcity is the single source of truth, so
   it works the same from any machine.
2. **Owner, returning.** You say *"10 social, 1 killer, 5 adventurers, make it feel alive."* The kit
   asks botcity for that mix; botcity hands back **existing idle bots with their accumulated history**
   where it has them and **mints new ones** where it's short. Next time, those new ones are reusable
   too — because botcity kept them.

## Setup

1. **Clone** this repo and point Claude Code at it (the root `.mcp.json` auto-registers the
   `botcity` MCP).
2. **Build the MCP** (once):
   ```bash
   cd botcity-mcp && npm install && npm run build
   ```
3. **Set the two env vars** — the only configuration, supplied by you, never committed:

   | Env var             | Default                 | Purpose |
   | ------------------- | ----------------------- | ------- |
   | `BOTCITY_BASE_URL`  | `http://localhost:3000` | the botcity host base URL |
   | `BOTCITY_SWARM_KEY` | —                       | shared key to acquire/release swarms (privileged) |

   See `botcity-mcp/README.md` for a copy-pasteable Claude Code MCP config entry.
4. **Run a swarm** by following `SWARM-DRIVER.md` — e.g. tell Claude Code
   *"10 social, 1 killer, 5 adventurers, make it feel alive."*

## Layout

```
pickcitybots/
  CLAUDE.md           # "this is the swarm kit — read SWARM-DRIVER.md"
  .mcp.json           # registers the botcity MCP (env var NAMES only)
  README.md           # this file
  bartle.md           # the four types + population dynamics (public research)
  SWARM-DRIVER.md     # the runbook: compose → acquire → drive → release
  personas/           # socializer.md killer.md explorer.md achiever.md
  botcity-mcp/        # the MCP server (src/, package.json, README.md)
```

This repo is **public**. Never commit secrets, tokens, or real host URLs beyond the localhost
default — the operator supplies env var values at runtime.
