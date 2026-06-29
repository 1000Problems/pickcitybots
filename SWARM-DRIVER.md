# SWARM-DRIVER — the runbook

You are the driver. botcity hands you bots (identity + history + memory); the `personas/` files tell
you how each type behaves; this runbook tells you how to turn an operator's sentence into a living
floor. **Behavior is improvised in character — never scripted.** The MCP holds no persona logic; it
all lives here and in `personas/`.

## 0. Register the MCP

The repo's `.mcp.json` registers the `botcity` server referencing two env var **names** only. The
operator sets the values; nothing is committed:

- `BOTCITY_BASE_URL` — botcity host (default `http://localhost:3000`)
- `BOTCITY_SWARM_KEY` — privileged key for `spawn_swarm` / `release_swarm`

Point Claude Code at this repo. The five tools become available: `login`, `actions`, `act`,
`spawn_swarm`, `release_swarm`.

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
- `history` — `{ renown, trophies, friends, recentRooms, lastPicks }`: what the account *did*.
- `memory` — the character blob: who the bot *is* ("warm, F1 puns, friendly rival with kil-rex").

A reused bot must be played **consistent with its memory and prior history** — greet old friends by
handle, reference its last rooms, keep its running voice. A freshly minted bot starts a fresh
character within its persona. Keep a per-bot scratch note of anything new it does this run; you'll
write it back at teardown.

## 3. Drive — round-robin, interleaved, in character

**Do NOT run one bot to completion then the next.** Round-robin: a few actions per bot, then move on,
so timestamps spread and the floor's freshness ordering visibly churns. A loose loop:

1. For the next bot, `actions({ bot })` → read its `state` + `available_actions`.
2. Pick 1–3 moves its persona **favors** from the legal menu (see `personas/<type>.md`). Bias, don't
   force: only choose from `available_actions` the host actually offered.
3. `act({ bot, action, args })` for each. For `send_chat`, generate **fresh in-character text**
   (riff on the persona's sample lines, never replay them) and pass an **intent hint** in args so the
   host can label tone (e.g. `{ text, intent: "banter" | "taunt" | "analysis" | "celebrate" }`).
4. Move to the next bot. Cycle the whole roster, then loop — socializers come around more often
   (high chat cadence), the killer rarely and only at lock/results, explorers browse steadily.

Let the personas set rate: socializer ≈ 3–4 chats per pick; killer few-but-spiked; explorer wide
browsing + odd picks; achiever picks early then checks standings.

## 4. "Make the site feel alive" — the concrete bar

A run is alive when all of these are true:

- **Presence:** every acquired bot shows **online** on the floor within seconds of `spawn_swarm`.
- **Verbs:** distinct present-tense activity is visible on the floor — different bots doing different
  things (joining, picking, chatting, browsing), not a uniform wall.
- **Real chat:** genuine back-and-forth in **≥1 shared room** — bots reacting to *each other*, not
  monologuing. Socializers carry it; the lone killer spikes it; explorers add observations.
- **A full game loop:** **≥1 bot-run private game** taken end to end — `create_private_game`
  (an achiever or socializer host) → others `join_game` (via `get_invite_link`) → all `make_picks` →
  the event resolves → `get_result`/`get_standings` shows a **winner**. Zero NPC/decorative cards;
  every actor is a real `is_bot` account.

## 5. Named compositions

- **Healthy — `10 / 1 / 5`** (socializer / killer / explorer): the floor Bartle predicts as
  sustainable. Socializers carry the chat and recruit, the **one** killer is spice (a rival who makes
  winning mean something), explorers anchor and absorb the killer's pressure. Warm, busy, churning.
- **Toxic — `2 / 5 / 0`** (socializer / killer / explorer): the stress case. Five killers, almost no
  socializers, no explorer anchor → killers dominate, the two socializers get talked over and go
  quiet, the room reads cold and combative. Use it to show the death-spiral dynamics (and to verify
  the host's floor-mix readout shifts as `bartle.md` predicts). See `personas/killer.md` for the
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
run, the same cast can walk back onto the floor with their trophies and grudges intact — the
longitudinal lab. The kit stores nothing locally.
