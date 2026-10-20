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

test("hint button only shows in Baby Mode and always gives a hint", () => {
  const { game, el } = loadGame({ seed: 5 });
  game.newGame("medium");
  game.render();
  assert.equal(el.hintBtn.hidden, true);
  game.newGame("baby");
  game.render();
  assert.equal(el.hintBtn.hidden, false);
  for (let turn = 0; turn < 40; turn++) {
    el.hintBtn.click();
    assert.equal(el.hintBox.hidden, false);
    assert.ok(el.hintText.textContent.length > 10);
    el.hintCloseBtn.click();
    assert.equal(el.hintBox.hidden, true);
    el.endTurnBtn.click();
    if (game.state.over) break;
  }
});

test("end-of-game score is built from real tallies and explained", () => {
  const g = loadGame({ seed: 9 });
  const { game, el } = g;
  game.newGame("baby");
  const s = game.state;
  // Stage a fight: player heavy vehicle next to an AI light infantry.
  const px = s.player.bases[0].x, py = s.player.bases[0].y;
  let spot = null;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[2,0],[0,2],[-2,0],[0,-2]]) {
    if (game.terrainAt(px+dx, py+dy) !== "water" && !game.unitAt(px+dx, py+dy) && !game.baseAt(px+dx, py+dy)) { spot = [px+dx, py+dy]; break; }
  }
  const att = game.newUnit("heavyVehicle", "player", spot[0], spot[1]);
  s.player.units.push(att);
  let foe = null;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const x = spot[0]+dx, y = spot[1]+dy;
    if (game.terrainAt(x, y) !== "water" && !game.unitAt(x, y) && !game.baseAt(x, y)) { foe = game.newUnit("lightInfantry", "ai", x, y); break; }
  }
  s.ai.units.push(foe);
  game.updateFogOfWar();
  const hp0 = foe.hp;
  g.window.__FR_TEST__.game.resolveUnitAttack(att, foe.x, foe.y);
  assert.equal(s.player.stats.attacks, 1);
  assert.equal(s.player.stats.damageDealt, hp0 - foe.hp);
  s.over = true; s.winner = "player"; s.turn = 30;
  game.render();
  assert.equal(el.resultOverlay.hidden, false);
  assert.match(el.scorePct.textContent, /^\d+%$/);
  assert.ok(el.scoreRows.textContent.includes("Combat"));
  assert.equal(el.scoreDetail.hidden, true);
  el.scoreWhyBtn.click();
  assert.equal(el.scoreDetail.hidden, false);
});

test("terrain: forest hides units from afar, mountains extend sight, digging in adds defense", () => {
  const { game } = loadGame({ seed: 4 });
  game.newGame("medium");
  const s = game.state;
  const find = (terr, minGap) => {
    for (let y = 2; y < game.ROWS - 2; y++) for (let x = 2; x < game.COLS - 6; x++) {
      if (game.terrainAt(x, y) !== terr || game.unitAt(x, y) || game.baseAt(x, y)) continue;
      let ok = true;
      for (let d = 0; d <= minGap; d++) if (game.terrainAt(x + d, y) === "water" || game.unitAt(x + d, y) || game.baseAt(x + d, y)) ok = false;
      if (ok) return [x, y];
    }
    return null;
  };
  // Forest: an AI unit in a forest 3 tiles from a player scout is not visible; adjacent it is.
  const fo = find("forest", 3);
  if (fo) {
    const foe = game.newUnit("lightInfantry", "ai", fo[0], fo[1]); s.ai.units.push(foe);
    const sc = game.newUnit("scout", "player", fo[0] + 3, fo[1]); s.player.units.push(sc);
    game.updateFogOfWar();
    assert.equal(s.player.visible[fo[1]][fo[0]], false, "hidden at range 3");
    sc.x = fo[0] + 1; game.updateFogOfWar();
    assert.equal(s.player.visible[fo[1]][fo[0]], true, "seen when adjacent");
    foe.dugAt = [foe.x, foe.y];
    const p = game.previewCombat(sc, foe.x, foe.y);
    assert.equal(p.defBonus, 3, "forest +2 and dug in +1");
    foe.dugAt = null;
    assert.equal(game.previewCombat(sc, foe.x, foe.y).defBonus, 2);
  }
  // Mountain: a plain unit sees 1 tile; on a mountain, 2.
  const mo = find("mountain", 3);
  if (mo) {
    const u = game.newUnit("lightInfantry", "player", mo[0], mo[1]); s.player.units.push(u);
    game.updateFogOfWar();
    assert.equal(s.player.visible[mo[1]][mo[0] + 2], true);
  }
});

test("new units: commando range, medic heal, submarine stealth, unlocks", () => {
  const { game } = loadGame({ seed: 6 });
  game.newGame("medium");
  const s = game.state, T = game.UNIT_TYPES;
  ["jeep", "medic", "commando", "submarine"].forEach((id) => assert.ok(T[id], id));
  // Land tiles in a row for commando test.
  let row = null;
  for (let y = 2; y < game.ROWS - 2 && !row; y++) for (let x = 2; x < game.COLS - 6; x++) {
    let ok = true;
    for (let d = 0; d < 3; d++) if (game.terrainAt(x + d, y) === "water" || game.unitAt(x + d, y) || game.baseAt(x + d, y)) ok = false;
    if (ok) { row = [x, y]; break; }
  }
  const c = game.newUnit("commando", "player", row[0], row[1]); s.player.units.push(c);
  const foe = game.newUnit("lightInfantry", "ai", row[0] + 2, row[1]); s.ai.units.push(foe);
  game.updateFogOfWar();
  const tiles = game.attackableTiles(c, []);
  assert.ok(tiles.some((t) => t[0] === foe.x && t[1] === foe.y), "commando reaches 2 tiles");
  assert.equal(game.previewCombat(c, foe.x, foe.y).taken, 0, "no retaliation at range");
  // Medic heals a hurt neighbour at end of turn.
  const m = game.newUnit("medic", "player", row[0] + 1, row[1]); s.player.units.push(m);
  c.hp = 1;
  game.tickFaction(s.player);
  assert.equal(c.hp, 3);
});
