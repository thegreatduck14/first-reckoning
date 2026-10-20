  // ---------- BABY MODE HINTS ----------
  // The Hint button (baby difficulty only) looks at the board and tells the
  // player one concrete next step — move this unit there, hit that enemy,
  // queue this — and highlights the tiles involved until dismissed.
  var hintTiles = null; // { from: [x, y] | null, to: [x, y] | null }

  function hintsEnabled() { return !!state && state.difficulty === "baby" && !state.over; }

  function hintWhere(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var parts = [];
    if (dx) parts.push(Math.abs(dx) + " tile" + (Math.abs(dx) > 1 ? "s" : "") + (dx > 0 ? " right" : " left"));
    if (dy) parts.push(Math.abs(dy) + " tile" + (Math.abs(dy) > 1 ? "s" : "") + (dy > 0 ? " down" : " up"));
    return parts.length ? parts.join(" and ") : "right here";
  }
  function hintDist(x1, y1, x2, y2) { return Math.abs(x1 - x2) + Math.abs(y1 - y2); }

  // The reachable tile that gets closest to (tx, ty) — null if none beats staying put.
  function hintStepToward(u, tx, ty) {
    var best = null, bestD = hintDist(u.x, u.y, tx, ty);
    reachableTiles(u).forEach(function (t) {
      var d = hintDist(t[0], t[1], tx, ty);
      if (d < bestD) { bestD = d; best = t; }
    });
    return best;
  }
  function hintNearest(list, u) {
    var best = null, bestD = Infinity;
    list.forEach(function (t) {
      var d = hintDist(u.x, u.y, t[0], t[1]);
      if (d < bestD) { bestD = d; best = t; }
    });
    return best;
  }
  function hintReady(u) { return !u.acted && u.hp > 0; }

  function computeHint() {
    var f = state.player;
    var units = f.units.filter(hintReady);
    var fighters = units.filter(function (u) {
      var t = UNIT_TYPES[u.typeId];
      return t.attack > 0 && !t.canFoundCity && t.id !== "harvester" && (t.domain || "land") === "land";
    });

    // 1. A good attack is available right now.
    var bestAtk = null;
    units.forEach(function (u) {
      if (!UNIT_TYPES[u.typeId].attack) return;
      attackableTiles(u, reachableTiles(u)).forEach(function (t) {
        var eu = unitAt(t[0], t[1]), eb = baseAt(t[0], t[1]);
        var owner = eu ? eu.owner : (eb ? eb.id : null);
        if (owner !== "ai" && owner !== "barbarians") return; // never nudge into natives
        var p = previewCombat(u, t[0], t[1]);
        if (p.dealt <= 0 || p.taken >= u.hp) return;
        var score = (eb ? 1000 : 0) + p.dealt * 10 - p.taken;
        if (!bestAtk || score > bestAtk.score) bestAtk = { score: score, u: u, t: t, p: p, base: !!eb };
      });
    });
    if (bestAtk) {
      var tgt = bestAtk.base ? "enemy base" : bestAtk.p.defenderType.name;
      return {
        text: "Attack! Click your " + UNIT_TYPES[bestAtk.u.typeId].name + " (gold tile), then click the " + tgt + " (red tile), " +
          hintWhere(bestAtk.u.x, bestAtk.u.y, bestAtk.t[0], bestAtk.t[1]) + " from it. You deal " + bestAtk.p.dealt + ", you take " + bestAtk.p.taken + ".",
        from: [bestAtk.u.x, bestAtk.u.y], to: bestAtk.t
      };
    }

    // 2. Idle build queue.
    if (!f.buildQueue.length) {
      var pick = null;
      f.unlocked.forEach(function (id) {
        var t = UNIT_TYPES[id];
        if (!t.attack || t.canFoundCity || id === "harvester" || t.oneTimeUse || (t.domain || "land") !== "land") return;
        if (t.cost <= f.production && (!pick || t.attack * t.hp > UNIT_TYPES[pick].attack * UNIT_TYPES[pick].hp)) pick = id;
      });
      if (!pick) pick = "lightInfantry";
      return { text: "Your base is idle. In the Build Queue box, choose " + UNIT_TYPES[pick].name + " (" + UNIT_TYPES[pick].cost + " pts) so it starts building.", from: null, to: null };
    }

    // 3. Harvesters earn production only on goods tiles.
    var harvesters = units.filter(function (u) { return u.typeId === "harvester" && !isResourceTile(u.x, u.y); });
    for (var i = 0; i < harvesters.length; i++) {
      var h = harvesters[i];
      var goods = [];
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        if (f.explored[y][x] && isResourceTile(x, y) && !unitAt(x, y) && !baseAt(x, y) && islandIdAt(x, y) === islandIdAt(h.x, h.y)) goods.push([x, y]);
      }
      var g = hintNearest(goods, h);
      if (!g) continue;
      var step = hintStepToward(h, g[0], g[1]);
      if (step) {
        var arrives = step[0] === g[0] && step[1] === g[1];
        return {
          text: "Move your Harvester to the highlighted tile. " + (arrives ? "It's a goods tile — parked there, it adds production every turn." : "It heads for the goods tile " + hintWhere(h.x, h.y, g[0], g[1]) + " away; parked on goods it adds production."),
          from: [h.x, h.y], to: step
        };
      }
    }

    // 4. Settlers found new cities (more cities = more production).
    var settlers = units.filter(function (u) { return UNIT_TYPES[u.typeId].canFoundCity; });
    for (var j = 0; j < settlers.length; j++) {
      var s = settlers[j];
      if (isValidCitySite(s.x, s.y)) {
        return { text: "Click your Settler (gold tile) and press Found City — this spot works, and a second city boosts production.", from: [s.x, s.y], to: null };
      }
      var site = null, siteD = Infinity;
      reachableTiles(s).forEach(function (t) {
        var d = hintDist(s.x, s.y, t[0], t[1]);
        if (isValidCitySite(t[0], t[1]) && d < siteD) { siteD = d; site = t; }
      });
      if (site) return { text: "Move your Settler to the highlighted tile, then Found City there next turn.", from: [s.x, s.y], to: site };
    }

    // 5. Find the enemy.
    var enemyBases = state.ai.bases.filter(function (b) { return b.alive && f.explored[b.y][b.x]; });
    if (!enemyBases.length) {
      var scouts = units.filter(function (u) { return u.typeId === "scout"; });
      for (var k = 0; k < scouts.length; k++) {
        var sc = scouts[k];
        var dark = [];
        for (var yy = 0; yy < ROWS; yy++) for (var xx = 0; xx < COLS; xx++) if (!f.explored[yy][xx] && terrainAt(xx, yy) !== "water") dark.push([xx, yy]);
        var d0 = hintNearest(dark, sc);
        var st = d0 ? hintStepToward(sc, d0[0], d0[1]) : null;
        if (st) return { text: "You haven't found the enemy yet. Move your Scout to the highlighted tile to explore.", from: [sc.x, sc.y], to: st };
      }
      return { text: "You haven't found the enemy base yet. Move units into the dark, unexplored areas — a Scout moves furthest.", from: null, to: null };
    }

    // 6. March on the enemy base.
    var enemyTiles = enemyBases.map(function (b) { return [b.x, b.y]; });
    for (var m = 0; m < fighters.length; m++) {
      var a = fighters[m];
      var eb2 = hintNearest(enemyTiles, a);
      if (islandIdAt(eb2[0], eb2[1]) !== islandIdAt(a.x, a.y)) continue;
      var stp = hintStepToward(a, eb2[0], eb2[1]);
      if (stp) return { text: "Advance! Move your " + UNIT_TYPES[a.typeId].name + " to the highlighted tile — the enemy base is " + hintWhere(a.x, a.y, eb2[0], eb2[1]) + " away.", from: [a.x, a.y], to: stp };
    }

    // 7. The enemy is overseas.
    var anyFighter = f.units.some(function (u) { return UNIT_TYPES[u.typeId].attack > 0 && (UNIT_TYPES[u.typeId].domain || "land") === "land"; });
    var sameIsland = f.units.some(function (u) { return islandIdAt(enemyTiles[0][0], enemyTiles[0][1]) === islandIdAt(u.x, u.y); });
    if (anyFighter && !sameIsland) {
      if (f.buildings.indexOf("shipyard") === -1) {
        return { text: "The enemy is on another island. Build a Shipyard (under Buildings in the Build Queue box — needs a city on the coast), then build a Frigate to carry troops.", from: null, to: null };
      }
      var frig = f.units.filter(function (u) { return UNIT_TYPES[u.typeId].capacity; })[0];
      return {
        text: frig
          ? "Move land units next to your " + UNIT_TYPES[frig.typeId].name + " to load them, then sail it to the enemy island and disembark."
          : "You have a Shipyard — queue a Frigate in the Build Queue box to carry troops to the enemy island.",
        from: frig ? [frig.x, frig.y] : null, to: null
      };
    }

    return { text: "Nothing urgent. Press End Turn — your production and research keep building.", from: null, to: null };
  }

  function showHint() {
    if (!hintsEnabled()) return;
    var h = computeHint();
    hintTiles = (h.from || h.to) ? { from: h.from, to: h.to } : null;
    el.hintText.textContent = h.text;
    el.hintBox.hidden = false;
    render();
  }
  function clearHint() {
    hintTiles = null;
    if (el.hintBox) el.hintBox.hidden = true;
  }
  // Called from render(): the button only exists in Baby Mode.
  function updateHintUi() {
    el.hintBtn.hidden = !hintsEnabled();
    if (!hintsEnabled() && !el.hintBox.hidden) clearHint();
  }

  el.hintBtn.addEventListener("click", showHint);
  el.hintCloseBtn.addEventListener("click", function () { clearHint(); render(); });
