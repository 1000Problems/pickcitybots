# CLAUDE.md

**This is the pickcitybots swarm kit** — a public, stateless client that lets Claude Code drive bot
swarms against the private **botcity** host over HTTP. It holds no state: when you want a bot, you
*ask botcity for one* and it hands back the bot's credentials, history, and character memory. botcity
remembers; the kit just drives.

## To run a swarm: read `SWARM-DRIVER.md`

It's the runbook. It tells you how to register the MCP, turn an operator's sentence
("10 social, 1 killer, 5 adventurers, make it feel alive") into a composition, acquire the swarm,
and round-robin each bot through its persona until the floor feels alive.

## The pieces

- **`botcity-mcp/`** — the MCP server (5 tools: `login`, `actions`, `act`, `spawn_swarm`,
  `release_swarm`). Thin HTTP wrappers over botcity's `/api/play/*` API. No game rules, no persona
  logic, no registry. See `botcity-mcp/README.md`.
- **`.mcp.json`** — registers the `botcity` MCP referencing two env var **names** only
  (`BOTCITY_BASE_URL`, `BOTCITY_SWARM_KEY`); the operator supplies the values.
- **`personas/`** — one file per Bartle type (`socializer`, `killer`, `explorer`, `achiever`). Each
  is a policy over the host's affordance menu plus a chat voice. **Persona behavior lives here, never
  in the MCP.**
- **`bartle.md`** — the research grounding: the four types and the population dynamics (why one
  killer is spice and five empty the room). Cite it; don't rewrite it.
- **`README.md`** — the two operator scenarios + setup.

## Rules

- **Improv, not scripts.** Persona sample lines are *voice* — generate fresh in-character text.
- **The host is the catalog owner.** Drive everything through `act` + `actions`; never add per-action
  tools. If a persona wants a missing affordance, note it as a future botcity change, don't fake it.
- **Public repo — never commit secrets.** Env var values come from the operator, not the repo.
