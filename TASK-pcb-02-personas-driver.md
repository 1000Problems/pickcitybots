# TASK: Bartle persona specs + swarm driver + repo wiring

> Teach the driver how each type behaves and give it a runbook, so "log in 10 social, 1 killer, 5
> adventurers and make the site feel alive" works from a cold clone of this repo.

## Context

`spawn_swarm` (TASK-pcb-01) acquires accounts from botcity; it does not decide what they do. A
persona is **a policy over the affordance menu + a chat voice**, grounded in `bartle.md`. Behavior is
LLM-improvised by the driving agent, not scripted. This task writes the persona library, the driver
runbook, and the repo wiring that makes the GitHub link self-describing to Claude Code. Supersedes
the old `TASK-botcity-04-personas-driver` (personas now live in this public repo). Depends on
TASK-pcb-01.

## Requirements

1. Copy `bartle.md` into the repo (public research, no secrets) as the agent's grounding for what the
   types mean and *why one killer is spice and five empty the room*.
2. Persona library at `pickcitybots/personas/`, one file per type (`socializer.md`, `killer.md`,
   `explorer.md`, `achiever.md`), each ≤ ~30 lines: one-line goal, **favored affordances** (which
   `available_actions` to prefer/avoid), **chat voice** (tone + 3–4 sample lines to riff on, not
   replay), **cadence** (chat vs. act rate). Match `bartle.md` §B: socializer chat-first/warm/high
   rate; killer terse domination, shows at lock/results, used sparingly; explorer ("adventurer")
   browses everything, odd picks, reads stats; achiever picks to win, locks early, chases trophies.
3. `SWARM-DRIVER.md` runbook: register the MCP, parse a composition ("10 social, 1 killer, 5
   adventurer"), map words→types (social→socializer, killer→killer, adventurer→explorer, +achiever),
   call `spawn_swarm`, then **round-robin** each bot through `actions`/`act` enacting its persona —
   interleaved so timestamps spread and the floor churns, not one bot to completion then the next.
4. The driver **uses acquired history/memory**: a reused bot is played consistent with its
   `memory` blob and prior `history`, and on teardown the driver calls `release_swarm` with updated
   memory. When sending chat, pass an intent hint (for the host's `self` tone label, TASK-botcity-08).
5. Two named compositions documented: healthy `10/1/5` and toxic `2/5/0` (to stress the dynamics
   `bartle.md` predicts), with the one-killer-is-spice rationale stated in `killer.md`.
6. "Make the site feel alive" defined concretely: bots online (presence), present-tense verbs on the
   floor, real chat in ≥1 shared room, and ≥1 bot-run private game created→joined→picked→resolved.
7. Repo wiring: `CLAUDE.md` (this is the swarm kit; read `SWARM-DRIVER.md`), `README.md` (the two
   scenarios + the two env vars), and the `.mcp.json` from TASK-pcb-01 referenced. Pointing Claude
   Code at the repo should be enough to run a swarm with no extra instruction.

## Implementation Notes

- **Reference affordance names, not internals** (e.g. "prefer `send_chat`, rarely `make_picks`").
- **Improv, not scripts** — sample lines are voice, generate fresh in-character text.
- Concurrency: a few actions per bot, then move on, so the floor's freshness ordering visibly churns.
- Pull behavioral detail from `bartle.md` §B and the population-dynamics note.

## Do Not Change

- The MCP (TASK-pcb-01) — the driver only calls its tools; persona logic lives in specs/runbook.
- The host affordance vocabulary — if a persona wants a missing action, note it as a future host
  change, don't fake it client-side.
- `bartle.md` content — cite it, don't rewrite it.
- Production `pickCity/**` and any shared DB.

## Acceptance Criteria

- [ ] Four persona files, each with goal / favored affordances / voice / cadence, consistent with
      `bartle.md`.
- [ ] From a cold clone + two env vars, a fresh Claude Code session given "10 social, 1 killer, 5
      adventurers" registers the MCP, spawns, and drives believable, type-differentiated activity with
      no further instruction.
- [ ] After a run on a fresh botcity: 16 online, distinct verbs, real chat, one bot-run private game
      reaching a result with a winner shown, zero NPC cards.
- [ ] A reused bot is played consistent with its prior memory/history; `release_swarm` writes memory
      back.
- [ ] Healthy `10/1/5` and toxic `2/5/0` produce visibly different floor feel (and floor mix, via
      TASK-botcity-07).
- [ ] `git diff` shows changes only under `pickcitybots/`.

## Verification

1. From a clean session, follow `SWARM-DRIVER.md` verbatim for 10/1/5; confirm the floor comes alive.
2. Spot-check a socializer chats more than it picks and the lone killer reads dominant without
   flooding.
3. Run 2/5/0 and confirm the floor feel (and `getFloorMix`) shifts as `bartle.md` predicts.
4. Confirm no persona/chat logic leaked into the MCP.
