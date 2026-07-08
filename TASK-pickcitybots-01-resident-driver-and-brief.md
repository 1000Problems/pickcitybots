# TASK (pickcitybots): Resident check-in + author the handoff brief

> Companion to botcity TASK-70..76. The **free** side of the split: the scheduled Opus driver does
> as much as it can while it's cheap (subscription-billed), then hands off to the paid agentic
> reflex by writing a compact **brief** into each bot's memory. This is a kit/driver change
> (`pickcitybots`), not host code.

## Context

The host now supports resident shifts (botcity TASK-70/71): `spawn_swarm` marks a cohort on-shift
with a `shift_until`; `release_swarm` ends the *drive turn* but leaves the bot logged in. Between
drives, the host answers humans with Gemini 3.5 Flash, reading `bot_memory.brief` (botcity
TASK-73). The driver must (a) do the free batch work at each boundary and (b) leave a good brief so
the paid path stays in-voice and cheap.

## Requirements

1. **Six resident check-ins/day.** On the scheduled wake (`SCHEDULED-LOBBY-DRIVER.md` cadence),
   `spawn_swarm` the shift cohort, then do **as much free work as possible while driving**:
   advance story beats (`STORY-PROTOCOL.md`), bot-to-bot floor life, public-game browse/join/pick,
   set moods/avatars/greets. All bot-to-bot and no-human-present play stays here — it's free Opus,
   never Gemini.
2. **Answer any pending human first** (existing rule) — `context.invites` and live human gestures
   are handled at the top of the wake, before batch work.
3. **Write the brief on release.** For each bot, before `release_swarm`, compose
   `bot_memory.brief` to the strict schema (botcity TASK-73 req 1): `voice`, `mood`, `beat`,
   `threads[]` (≤5), `watch[]` (humans to greet on sight this shift), `updated` (ISO). Keep it
   small — this is the *entire* context the paid model gets between drives; make it dense and
   on-voice. Pass it through `release_swarm`'s memory round-trip.
4. **Do not release the shift.** `release_swarm` **without** `end_shift` — the cohort stays logged
   in for the agentic reflex. Only hand a shift over (`end_shift: true`) at a true boundary when
   the next cohort checks in.
5. **Never call the paid path.** The driver never invokes Gemini and never does human-triggered
   work speculatively — if no human is present, it does free work and writes the brief. Human-live
   sessions are the host's agentic job (botcity TASK-74/75/76); the driver stays out of them.

## Notes

- The brief is the join between the two brains: expensive-but-free Opus digests backstory + story +
  history into ~300 tokens; cheap Gemini consumes it. Quality of between-shift replies is bounded
  by brief quality — treat it as the driver's main deliverable, not an afterthought.
- `watch[]` drives the "there when you log in" greeting (botcity TASK-74): list humans this bot has
  a bond with and would plausibly greet.
- Keep persona policy in `personas/` as today; the brief's `voice` is a distilled pointer to it,
  not a rewrite.

## Acceptance Criteria

- [ ] A scheduled run checks a cohort in (on-shift), does free batch work, writes a schema-valid
      `brief` per bot, and releases the drive turn **without** ending the shift.
- [ ] After the run, host-side `assembleBotContext` finds a usable brief for each bot.
- [ ] The driver makes zero Gemini calls and does not drive any room a human is live in.
- [ ] At a boundary, the outgoing cohort is ended (`end_shift: true`) as the incoming one checks in.
