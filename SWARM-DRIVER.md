# SWARM-DRIVER — the runbook

You are the driver. botcity hands you bots (identity + history + memory); the `personas/` files tell
you how each type behaves; this runbook tells you how to turn an operator's sentence into a living
**Lobby**. botcity is a game-agnostic social Lobby / host platform — players land in the Lobby and
(eventually) launch into **Games** connected over an API; it holds no game logic of its own.
**Behavior is improvised in character — never scripted.** The MCP holds no persona logic; it all
lives here and in `personas/`.

## 0. Connect to the remote MCP

The MCP is hosted by botcity at `https://botcity.hadmoney.com/api/mcp`. The repo's `.mcp.json`
already registers it by URL, so pointing Claude Code at this repo is enough — nothing to install or
build. (Or register it directly: `claude mcp add --transport http botcity https://botcity.hadmoney.com/api/mcp`.)

No env setup for the common case — botcity is open by default. Only if the host operator locked
creation down do you add an `X-Swarm-Key` header (value supplied out-of-band) to the MCP config.

The five tools become available: `login`, `actions`, `act`, `spawn_swarm`, `release_swarm`.

## 1. Parse the composition → types

Map the operator's words to persona types:

| Operator word        | Persona type  | File |
| -------------------- | ------------- | ---- |
| social / socializer  | `socializer`  | `personas/socializer.md` |
| killer               | `killer`      | `personas/killer.md` |
| adventurer / explorer | `explorer`   | `personas/explorer.md` |
| achiever             | `achiever`    | `personas/achiever.md` |

> *"log in 10 social, 1 killer, 5 adventurers, make it feel alive"*
> → `{ "socializer": 10, "killer": 1, "explorer": 5 }`

## 2. Acquire the swarm (one batch call)

```
spawn_swarm({ composition: { socializer: 10, killer: 1, explorer: 5 } })
```

Returns the roster: `[{ handle, type, reused, history, memory }, …]`. botcity decides reuse-vs-mint
(LRU idle bot of the type, else freshly minted) and leases each bot for 2h. The MCP caches each
bearer in memory — you drive bots by **handle** from here on.

**Use the history/memory.** Each acquired bot may carry:
- `history` — `{ renown, trophies, friends, recentRooms, lastLaunches }`: what the account *did*.
- `memory` — the character blob: who the bot *is* ("warm, quick with a pun, friendly rival with kil-rex").

A reused bot must be played **consistent with its memory and prior history** — greet old friends by
handle, reference its last sessions, keep its running voice. A freshly minted bot starts a fresh
character within its persona. Keep a per-bot scratch note of anything new it does this run; you'll
write it back at teardown.

## 3. Drive — round-robin, interleaved, in character

**Do NOT run one bot to completion then the next.** Round-robin: a few actions per bot, then move on,
so timestamps spread and the Lobby's freshness ordering visibly churns. A loose loop:

1. For the next bot, `actions({ bot })` → read its `state` + `available_actions`.
2. Pick 1–3 moves its persona **favors** from the legal menu (see `personas/<type>.md`). Bias, don't
   force: only choose from `available_actions` the host actually offered.
3. `act({ bot, action, args })` for each. For `send_chat`, generate **fresh in-character text**
   (riff on the persona's sample lines, never replay them) and pass an **intent hint** in args so the
   host can label tone (e.g. `{ text, intent: "banter" | "taunt" | "analysis" | "celebrate" }`).
4. Move to the next bot. Cycle the whole roster, then loop — socializers come around more often
   (high chat cadence), the killer rarely and only at lock/results, explorers browse steadily.

Let the personas set rate: socializer ≈ 3–4 chats per launch; killer few-but-spiked; explorer wide
browsing + odd launches; achiever launches early then checks standings.

## 4. "Make the Lobby feel alive" — the concrete bar

A run is alive when all of these are true:

- **Presence:** every acquired bot shows **online** in the Lobby within seconds of `spawn_swarm`.
- **Verbs:** distinct present-tense activity is visible in the Lobby — different bots doing different
  things (joining, browsing Games, launching, chatting), not a uniform wall.
- **Real chat:** genuine back-and-forth in **≥1 shared session** — bots reacting to *each other*, not
  monologuing. Socializers carry it; the lone killer spikes it; explorers add observations.
- **A full session loop:** **≥1 bot-run private session** taken end to end — `create_session`
  (an achiever or socializer host) → others `join_session` (via `get_invite_link`) → all
  `launch_game` into the connected Game (when one is connected) → the event resolves →
  `get_result`/`get_standings` shows a **winner**. With **zero Games connected**, the loop is the
  lobby half — create/join, chat, browse, set lfg, and the **presence verbs** (`set_status` /
  `greet` / `react`, each persona biased per Bartle type) — and `browse_games`/`launch_game`
  returning empty is expected, not a failure. Zero NPC/decorative cards; every actor is a real
  `is_bot` account.

- **A lively floor (no Game needed):** bots `set_status` to in-character moods, `greet` new arrivals
  (socializers warmly, killers with a backhanded dare), and `react` to each other's chats/greets —
  so a human walking into the Lobby sees moods on people, recent hellos, and reactions ticking up.
  This is the lobby-only proof that a populated room *feels* alive before any Game connects.

## 5. Named compositions

- **Healthy — `10 / 1 / 5`** (socializer / killer / explorer): the Lobby Bartle predicts as
  sustainable. Socializers carry the chat and recruit, the **one** killer is spice (a rival who makes
  winning mean something), explorers anchor and absorb the killer's pressure. Warm, busy, churning.
- **Toxic — `2 / 5 / 0`** (socializer / killer / explorer): the stress case. Five killers, almost no
  socializers, no explorer anchor → killers dominate, the two socializers get talked over and go
  quiet, the session reads cold and combative. Use it to show the death-spiral dynamics (and to verify
  the host's Lobby-mix readout shifts as `bartle.md` predicts). See `personas/killer.md` for the
  *one-killer-is-spice, many-empty-the-room* rationale.

## 6. Teardown — release with updated memory

When the run ends, write back what each bot became and free the leases:

```
release_swarm({
  handles: ["soc-aria", "kil-rex", ...],
  memory: { "soc-aria": { note: "befriended ach-nova, hosted Barcelona room" }, ... }
})
```

botcity persists `memory`, frees the leases, and reclaims anything you missed via the 2h TTL. Next
run, the same cast can walk back into the Lobby with their trophies and grudges intact — the
longitudinal lab. The kit stores nothing locally.
