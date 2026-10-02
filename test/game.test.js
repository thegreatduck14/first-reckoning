const test = require("node:test");
const assert = require("node:assert");
const { loadGame, click } = require("./helpers");

function playTurns(g, n) {
  for (let i = 0; i < n && !g.game.state.over; i++) {
    click(g.window, g.el.endTurnBtn);
    if (!g.el.passDeviceOverlay.hidden) click(g.window, g.el.passDeviceBtn);
  }
}

// Every unit is on the board, on terrain it can stand on, and not stacked.
function assertBoardConsistent(g) {
  const s = g.game.state;
  const seen = new Set();
  for (const f of [s.player, s.ai, s.natives, s.barbarians]) {
    for (const u of f.units) {
      const t = g.game.UNIT_TYPES[u.typeId];
      assert.ok(u.x >= 0 && u.x < g.game.COLS && u.y >= 0 && u.y < g.game.ROWS, `${u.typeId} off the map`);
      const water = g.game.terrainAt(u.x, u.y) === "water";
      if (t.category !== "air") assert.strictEqual(water, (t.domain || "land") === "naval", `${u.typeId} on wrong terrain`);
      const k = u.x + "," + u.y;
      assert.ok(!seen.has(k), `two units on ${k}`);
      seen.add(k);
    }
  }
}

test("the page loads to the home screen without errors", () => {
  const g = loadGame();
  assert.strictEqual(g.errors.length, 0);
  assert.strictEqual(g.el.homeOverlay.hidden, false);
  assert.strictEqual(g.el.gameScreen.hidden, true);
});

for (const diff of ["baby", "medium", "hard"]) {
  test(`a ${diff} game runs 60 turns without errors`, () => {
    const g = loadGame({ seed: 17 });
    click(g.window, g.el.homePlayBtn);
    click(g.window, g.el[{ baby: "diffBabyBtn", medium: "diffMediumBtn", hard: "diffHardBtn" }[diff]]);
    playTurns(g, 60);
    assert.strictEqual(g.errors.length, 0);
    assertBoardConsistent(g);
  });
}

test("hotseat shows the handoff screen at both handoffs of a round", () => {
  const g = loadGame({ seed: 4 });
  click(g.window, g.el.homeMpBtn);
  g.el.mpName1Input.value = "Ada";
  g.el.mpName2Input.value = "Bo";
  click(g.window, g.el.mpDiffMediumBtn);
  assert.strictEqual(g.game.state.player.displayName, "Ada");

  click(g.window, g.el.endTurnBtn);
  assert.strictEqual(g.el.passDeviceOverlay.hidden, false);
  assert.match(g.el.passDeviceBody.textContent, /Bo/);
  click(g.window, g.el.passDeviceBtn);
  assert.strictEqual(g.game.state.player.displayName, "Bo");

  click(g.window, g.el.endTurnBtn);
  assert.strictEqual(g.el.passDeviceOverlay.hidden, false, "round-end handoff back to player 1 is covered");
  assert.match(g.el.passDeviceBody.textContent, /Ada/);
  assert.strictEqual(g.game.state.player.displayName, "Ada");
  assert.strictEqual(g.game.state.turn, 2);
});

test("hotseat handoff screen is fully opaque", () => {
  const g = loadGame();
  const bg = g.window.getComputedStyle(g.el.passDeviceOverlay).backgroundColor;
  assert.doesNotMatch(bg, /rgba\(10, 8, 5, 0\.82\)/);
});

test("hard AI won't make an attack that just gets its unit killed", () => {
  const g = loadGame({ seed: 2 });
  g.game.newGame("hard");
  const s = g.game.state;
  // Find an open plain tile next to another open plain tile on the AI's island.
  const cap = s.ai.bases[0];
  let spot = null;
  for (let y = 0; y < g.game.ROWS && !spot; y++) {
    for (let x = 0; x < g.game.COLS - 1 && !spot; x++) {
      const ok = (px, py) => g.game.terrainAt(px, py) === "plain" && !g.game.unitAt(px, py) && !g.game.baseAt(px, py);
      if (ok(x, y) && ok(x + 1, y) && Math.abs(x - cap.x) + Math.abs(y - cap.y) > 2) spot = [x, y];
    }
  }
  assert.ok(spot, "found a test spot");
  const scout = g.game.newUnit("scout", "ai", spot[0], spot[1]);
  scout.typeId = "lightInfantry"; scout.hp = 1;
  s.ai.units.push(scout);
  const tank = g.game.newUnit("heavyVehicle", "player", spot[0] + 1, spot[1]);
  s.player.units.push(tank);
  g.game.updateFogOfWar();
  const tiles = g.game.attackableTiles(scout, []);
  assert.ok(tiles.some((t) => t[0] === tank.x && t[1] === tank.y), "the tank is attackable");
  assert.strictEqual(g.game.aiBestAttack(scout, tiles), null);

  // But a finishing blow on a nearly dead enemy is taken.
  tank.hp = 1;
  assert.deepStrictEqual([...g.game.aiBestAttack(scout, tiles)], [tank.x, tank.y]);
});

test("hard AI takes the fight to an idle player", () => {
  let attacked = 0;
  for (const seed of [11, 23, 41, 53]) {
    const g = loadGame({ seed });
    click(g.window, g.el.homePlayBtn);
    click(g.window, g.el.diffHardBtn);
    let hit = false;
    for (let i = 0; i < 60 && !g.game.state.over && !hit; i++) {
      click(g.window, g.el.endTurnBtn);
      hit = g.game.state.log.some((l) => /\(ai\) hits player/.test(typeof l === "string" ? l : l.text));
    }
    if (hit) attacked++;
  }
  assert.ok(attacked >= 3, `hard AI attacked the player's cities in ${attacked}/4 games`);
});
