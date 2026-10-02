# First Reckoning

Adamito's Game — a turn-based strategy skirmish blending Civilization, Colonization, and Dune 2, built as a single self-contained HTML file.

- **`phase1-skirmish.html`** — the current playable build. Open it in a browser (no install needed): a home screen with New Game (Baby/Medium/Hard difficulty), Load Game, How to Play, Hall of Fame, and local 2-player hotseat; a procedurally generated multi-island map with fog of war, a shared unit roster, base-building/production/research, ships and cargo, and a neutral native-camp faction you can negotiate peace or a war-plan alliance with via a Scout. Saves and hall-of-fame records live in the browser's local storage; saves can be exported to and imported from a file.
- **`phase0-arena.html`** — the earlier Phase 0 combat prototype ("The Reckoning Table") that proved out the unit roster and combat formula before the full map/turn loop was built.

## Working on the game

`phase1-skirmish.html` is generated — edit the files in `src/` and rebuild:

- `src/shell.html` — the page markup, with placeholders for the styles and script
- `src/styles.css` — all styles
- `src/js/*.js` — the game logic, concatenated in filename order into one script (they share a single scope)

```
npm install      # once, for the test dependencies
npm run build    # rebuild phase1-skirmish.html from src/
npm test         # rebuild, then run the jsdom tests in test/
```

Commit the rebuilt `phase1-skirmish.html` along with your `src/` changes, so the playable file in the repo is always current.
