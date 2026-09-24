# First Reckoning

Adamito's Game — a turn-based strategy skirmish blending Civilization, Colonization, and Dune 2, built as a single self-contained HTML file.

- **`phase1-skirmish.html`** — the current playable build. Open it in a browser (no build step needed): a home screen with New Game (Baby/Medium/Hard difficulty), Load Game, How to Play, and Hall of Fame, a procedurally generated multi-island map with fog of war, a shared unit roster, base-building/production/research, ships and cargo, and a neutral native-camp faction you can negotiate peace or a war-plan alliance with via a Scout. Saves and hall-of-fame records live in the browser's local storage.
- **`phase0-arena.html`** — the earlier Phase 0 combat prototype ("The Reckoning Table") that proved out the unit roster and combat formula before the full map/turn loop was built.
- **`src/`** / **`dist/`** — an early TypeScript scaffold for the combat model (superseded by the plain-JS logic embedded directly in the HTML builds above).

No build or install required to play — just open `phase1-skirmish.html`.
