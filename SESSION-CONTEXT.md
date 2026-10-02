# First Reckoning — Session Context

A running summary of work done on Adamito's Game ("First Reckoning") in this
Claude session, kept for continuity across future sessions/conversations.

## What this project is

A turn-based strategy skirmish blending Civilization, Colonization, and
Dune 2, built as a single self-contained HTML file (`phase1-skirmish.html`),
published as a live Claude Artifact and also tracked in this repo:
https://github.com/thegreatduck14/first-reckoning

`phase0-arena.html` is the earlier standalone combat prototype ("The
Reckoning Table") that proved out the unit roster and combat formula before
the full map/turn loop existed. Since October 2026 `phase1-skirmish.html` is
built from `src/` by `npm run build` (see README) — edit `src/`, not the
built file. The old TypeScript scaffold was removed.

The live, currently-published build is the Claude Artifact at:
https://claude.ai/artifact/D9TEXq8KUJphheRFwLmoVX
(Version 14 as of this session — republish the same file path/URL to update
it further; see the plan doc for the full version history.)

The design/build plan doc (Claude Docs) lives at:
https://claude.ai/code/artifact/614c33d1-7578-4d9d-b3fb-40970efed271
— its "Status" section has a running changelog (v0.2 through v0.10) that is
more authoritative and detailed than this file for feature history.

## What shipped this session (chronological)

- **Fog of war + AI settler colonization + shipyard batch** (carried in from
  before, verified/republished as v0.6): fixed a real `isCoastal()` bug that
  mistreated map-edge tiles as water.
- **Unit icon redesign**: all 12 unit SVGs recolored/detailed with
  material-appropriate palettes instead of flat silhouettes.
- **Native camps** (v0.7): up to 6 neutral AI camps scattered on the map,
  4-tier native unit roster (Brave, Rocket Tube Brave, Mounted Rocket Tube
  Brave, Indian in Tank — attack trimmed to 8), camp combat stats 10/10.
  Fixed a retaliation-damage bug (attacking a base was previously
  consequence-free) and a win-condition bug (wiping camps must not end the
  game).
- **Native diplomacy** (v0.8): a player Scout standing next to a living camp
  can Ask for Peace (free, permanent immunity) or Propose War Plan (costs
  one Light/Anti-Armor Infantry unit as tribute; the camp's garrison becomes
  an active ally that hunts the AI). Fixed a win-attribution bug (a native
  ally landing the finishing blow on the AI must count as a player win).
  Also lowered the Ornithopter/flyer's attack from 6 to 5 per request (note:
  the user described it as "1 to 5" but the actual prior value was 6).
- **Home screen + save/load + difficulty + Hall of Fame** (v0.9): the game
  now opens on a home screen (Play New Game / Load Game / How to Play / Hall
  of Fame) instead of dropping straight into a skirmish. Play New Game asks
  for Baby Mode / Medium / Hard (implemented as an AI production+research
  pace multiplier, not a decision-making rewrite). 5 save slots persisted in
  the browser's localStorage, shared between the in-game save icon
  (top-right corner) and the Load Game screen. Hall of Fame lists every
  finished game's win/loss, turn, and difficulty. Added a Main Menu icon/
  button (not explicitly requested, but needed so players can navigate back
  to the home screen mid-game).
- **Enter-to-end-turn + delete save button** (v0.10): pressing Enter ends
  the turn (same as the End Turn button), suppressed while any overlay is
  open, the game is over, or a button element already has focus (to avoid
  double-firing on the browser's own default Enter-activates-focused-button
  behavior). Every save slot (Load Game and in-game Save screens) got its
  own delete button, no confirmation step.

All of the above was verified with a jsdom-based headless test harness
(extract + unwrap the page's IIFE, drive real DOM click/keydown events,
assert on `state`) before each republish, plus multi-game/multi-turn
regressions. No open test failures as of the last publish.

## Publishing to GitHub — what actually happened

- This Claude session's own cloud sandbox routes GitHub git traffic through
  an Anthropic-managed proxy that enforces its own per-session repo
  authorization list, independent of whatever PAT is supplied. A push
  attempt from the cloud sandbox was flatly rejected by that proxy
  ("not in this session's authorized repository set") — not a credential
  problem, a policy block. Do not retry pushing to GitHub from the cloud
  sandbox; it will not work without that repo being separately authorized
  on the Anthropic side.
- The working path was: create/edit files in the cloud workspace, stage them
  to the user's linked Windows computer via the device bridge, and run git
  from *there* instead (`device_bash`), where the normal GitHub 403/permission
  issues (token scope, not proxy policy) applied and were fixed by getting a
  token with proper `repo`/Contents:write scope from the user.
- The local clone/commit needed one extra step: this connected folder
  (`C:\Users\adamj\Projects`) had file deletion disabled by default, which
  broke git's own internal lock/temp-file housekeeping (`.git/index.lock`
  errors). Fixed once by requesting delete permission for that folder.
- The remote repo already had one initial commit (a placeholder README) from
  when it was created on GitHub, which didn't share history with the fresh
  local init — required `git merge --allow-unrelated-histories -X ours`
  to reconcile before the push would succeed.
- Pushes now go through the `adamstone80` GitHub account, which is a
  collaborator on the repo — no token file is needed.

## Current state / where things stand

- Local working copy: `C:\Users\adamj\Projects\first-reckoning\` (git repo,
  `origin` = `https://github.com/thegreatduck14/first-reckoning.git`,
  clean working tree, `main` branch pushed and up to date as of this
  session).
- Cloud workspace copy (this Claude session's own sandbox, ephemeral):
  `/home/claude/adamitos-game/` — same files, this is where edits get made
  and where the live Artifact gets republished from.
- Published Artifact: Version 14, matches what's on GitHub's `main` as of
  this session.

## Open items / known simplifications (not bugs, just flagged scope)

- Baby/Medium AI still never attacks the player across water (its land
  army only targets enemies it can see on its own island). Hard has smarter
  tactics, including shipping armies over to invade.
- See the Claude Docs plan doc's "Open questions & risks" section for the
  longer-standing design-level open questions (platform, faction count,
  art style — all already resolved/confirmed there).

## October 2026 update (local, Claude Code)

- Split the game into `src/` + `build.js` (the build output is still the
  single self-contained `phase1-skirmish.html`), added jsdom tests under
  `test/` (`npm test`).
- Saves: failed saves are reported; saves carry a `version` and old ones are
  migrated on load; overwrite/delete ask for confirmation; saves can be
  exported to / imported from a .json file.
- Hotseat: the handoff screen now also appears at the end of each round, and
  is fully opaque.
- Hard AI: picks fights using the combat preview, retreats badly hurt units,
  rallies to threatened cities, paths around terrain, and ferries armies by
  Frigate to invade (or builds aircraft when it can't ship).
- The published Artifact has **not** been republished with these changes.
