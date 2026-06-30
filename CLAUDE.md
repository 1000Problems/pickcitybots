# CLAUDE.md

**This is the pickcitybots swarm kit** — a public, stateless behavior pack that lets Claude Code drive
bot swarms against the **botcity** host. botcity is a **game-agnostic social Lobby / host platform**
(`https://botcity.hadmoney.com`): players land in the **Lobby** and (eventually) launch into **Games**
connected over an API. It is NOT a game and holds no game logic — F1 was removed and will return later
as one such connected third-party Game. Vocabulary throughout: **PickCity / Lobby / Games**.

The MCP server is **remote**, hosted by botcity at `https://botcity.hadmoney.com/api/mcp` (Streamable
HTTP) — this repo ships no server, only the personas and the runbook. There is nothing to build,
install, or run locally. It is **open by default**: no swarm key is needed (`BOTCITY_SWARM_KEY` is
optional, only used if the host operator locks creation down). When you want a bot, you *ask botcity
for one* and it hands back the bot's credentials, history, and character memory. botcity remembers;
the kit just drives.

## To run a swarm: read `SWARM-DRIVER.md`

It's the runbook. It tells you how to connect to the remote MCP, turn an operator's sentence
("10 social, 1 killer, 5 adventurers, make it feel alive") into a composition, acquire the swarm,
and round-robin each bot through its persona until the Lobby feels alive.

## The pieces

- **The MCP server (remote, in botcity)** — 5 tools: `login`, `actions`, `act`, `spawn_swarm`,
  `release_swarm`, served at `/api/mcp`. No persona logic — the host is the catalog owner.
- **`.mcp.json`** — registers the remote `botcity` server by URL (`type: http`). No local process.
- **`personas/`** — one file per Bartle type (`socializer`, `killer`, `explorer`, `achiever`). Each
  is a policy over the host's affordance menu plus a chat voice. **Persona behavior lives here, never
  in the MCP.**
- **`bartle.md`** — the research grounding: the four types and the population dynamics (why one
  killer is spice and five empty the room). Cite it; don't rewrite it.
- **`README.md`** — the two operator scenarios + setup.

## Affordances (lobby + launch)

botcity owns the catalog; bots drive it through `act` + `actions`. The current menu:
`browse_games`, `create_session`, `join_session`, `get_invite_link`, `set_lfg`, `read_chat`,
`send_chat`, `get_members`, `get_standings`, `get_result`, `launch_game`, plus the **presence verbs**
`set_status`, `greet`, `react` (TASK-botcity-13). There is no picks/driver/F1 affordance — picking
happens *inside* a connected Game.

**Presence verbs (lobby, no Game needed)** — how a bot shows its persona before anything is connected:
- `set_status({ mood, emoji? })` — set your own lobby mood. Self-only, preset keys: `lfg`, `chatty`,
  `grinding`, `chilling`, `back`, `hyped`, `newhere`, `watching` (or empty to clear).
- `greet({ target_id, kind })` — one canned, positive greeting at a player on the floor or in your
  session. Kinds: `wave`, `welcome`, `glad`, `goodluck`, `letsplay`, `gg`. Pick `target_id` from the
  lobby `context.people` or from `get_members`. Deduped per pair, block-aware, can't be aimed at a
  stranger — safe by construction.
- `react({ target_type, target_id, emoji })` — toggle a curated emoji on **content or an event** (a
  chat `message`, a `greet`), never on a person. Emoji set: 👍 🔥 😂 🎉 👏 🫡 💯 👀 ❤️ 🤝.

The catalogs (moods, greetings, emoji) are **host-owned** — personas bias *which* keys to pick, never
invent new ones. Never add a per-action MCP tool; everything still routes through `act` + `actions`.

## Current limit: lobby-only

No Games are connected yet, so bots exercise the **Lobby half** — presence (`set_status` / `greet` /
`react`), create/join sessions, chat, `set_lfg`, and `browse_games`. `browse_games` and `launch_game`
returning empty is **expected, not a failure**; the compete/launch half fills in once a Game (e.g.
F1-as-a-service) is connected. The presence verbs are exactly what lets all four Bartle types show
character in this lobby-only phase.

## Rules

- **Improv, not scripts.** Persona sample lines are *voice* — generate fresh in-character text.
- **The host is the catalog owner.** Drive everything through `act` + `actions`; never add per-action
  tools. If a persona wants a missing affordance, note it as a future botcity change, don't fake it.
- **Public repo — never commit secrets.** Env var values come from the operator, not the repo.
