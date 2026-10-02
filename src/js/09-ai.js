  // ---------- AI ----------
  // Every valid, empty city site on the map, nearest-first to (fx,fy).
  function validCitySitesByDistance(fx, fy) {
    var out = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (isValidCitySite(x, y) && !unitAt(x, y) && !baseAt(x, y)) out.push([x, y]);
      }
    }
    out.sort(function (a, b) {
      var da = Math.abs(a[0] - fx) + Math.abs(a[1] - fy);
      var db = Math.abs(b[0] - fx) + Math.abs(b[1] - fy);
      return da - db;
    });
    return out;
  }
  function nearestFriendlyShip(f, u) {
    var best = null, bestD = Infinity;
    f.units.forEach(function (s) {
      if ((UNIT_TYPES[s.typeId].domain || "land") !== "naval") return;
      var d = Math.abs(s.x - u.x) + Math.abs(s.y - u.y);
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
  }

  function runAiTurn() {
    var f = state.ai;
    if (!factionAlive(f)) return;
    var hard = isHardAi();

    if (!f.buildQueue.length && hard) {
      aiChooseBuildHard(f);
    } else if (!f.buildQueue.length) {
      var aliveSettlers = f.units.filter(function (u) { return UNIT_TYPES[u.typeId].canFoundCity; }).length;
      var availableBuildings = BUILDING_ORDER.filter(function (id) {
        return f.buildings.indexOf(id) === -1 && (id !== "shipyard" || factionHasCoastalCity(f));
      });
      if (availableBuildings.length && Math.random() < 0.3) {
        f.buildQueue.push({ kind: "building", id: availableBuildings[0] });
      } else if (aliveSettlers < 2 && Math.random() < 0.25) {
        f.buildQueue.push({ kind: "unit", id: "aiSettler" });
      } else {
        var pool = f.unlocked.filter(function (id) {
          return id !== "harvester" && id !== "scout" && id !== "aiSettler" && id !== "settler";
        });
        var pick = pool[Math.floor(Math.random() * pool.length)] || "lightInfantry";
        f.buildQueue.push({ kind: "unit", id: pick });
      }
    }

    f.units.slice().forEach(function (u) {
      if (u.hp <= 0 || u.acted) return;
      var type = UNIT_TYPES[u.typeId];

      if (u.typeId === "harvester") {
        if (isResourceTile(u.x, u.y)) { u.acted = true; return; }
        var target = nearestResourceTile(u);
        if (target) moveToward(u, target[0], target[1]);
        u.acted = true;
        return;
      }

      // The AI's Builder heads for its most damaged city and sits beside it
      // to make repairs each turn; with nothing to fix, it just holds put
      // near the capital so it's ready when a city does take damage.
      if (u.typeId === "builder") {
        if (adjacentDamagedCity(u, f)) { u.acted = true; return; }
        var neediestCity = nearestDamagedCity(u, f);
        if (neediestCity) moveToward(u, neediestCity.x, neediestCity.y);
        u.acted = true;
        return;
      }

      // Settlers found cities on their own island; if the island is full,
      // they head for the coast to hitch a ride on a friendly ship instead.
      if (type.canFoundCity) {
        if (isValidCitySite(u.x, u.y)) { foundCityAction(u); return; }
        var homeIsland = islandIdAt(u.x, u.y);
        var sites = validCitySitesByDistance(u.x, u.y);
        var sameIslandSite = null;
        for (var i = 0; i < sites.length; i++) {
          if (islandIdAt(sites[i][0], sites[i][1]) === homeIsland) { sameIslandSite = sites[i]; break; }
        }
        if (sameIslandSite) { moveToward(u, sameIslandSite[0], sameIslandSite[1]); u.acted = true; return; }
        var reachable = reachableTiles(u);
        var boardable = boardableTiles(u, reachable);
        if (boardable.length) { boardFrigate(u, unitAt(boardable[0][0], boardable[0][1])); return; }
        var ship = nearestFriendlyShip(f, u);
        if (ship) moveToward(u, ship.x, ship.y);
        u.acted = true;
        return;
      }

      // A ship ferrying a Settler sails toward a valid site on a different
      // island and drops it off as soon as it's alongside open land there.
      if ((type.domain || "land") === "naval" && u.cargo.length) {
        var cargoSettlerIdx = -1;
        for (var ci = 0; ci < u.cargo.length; ci++) {
          if (UNIT_TYPES[u.cargo[ci].typeId].canFoundCity) { cargoSettlerIdx = ci; break; }
        }
        if (cargoSettlerIdx !== -1) {
          var homeIslandForShip = islandIdAt(f.bases[0].x, f.bases[0].y);
          var farSites = validCitySitesByDistance(u.x, u.y).filter(function (s) {
            return islandIdAt(s[0], s[1]) !== homeIslandForShip;
          });
          if (farSites.length) moveToward(u, farSites[0][0], farSites[0][1]);
          var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (var di = 0; di < dirs.length; di++) {
            var nx = u.x + dirs[di][0], ny = u.y + dirs[di][1];
            if (isValidCitySite(nx, ny) && !unitAt(nx, ny) && !baseAt(nx, ny)) {
              disembarkUnit(u, cargoSettlerIdx);
              break;
            }
          }
          u.acted = true;
          return;
        }
      }

      // The AI's Scout can negotiate with native camps just like the
      // player's can — ask for peace, or strike a war plan against the
      // player if it has a weak unit spare to hand over as tribute.
      if (u.typeId === "scout") {
        var nearCampAi = adjacentNativeCamp(u);
        if (nearCampAi && nearCampAi.aiPact === null && campWillNegotiateWith(nearCampAi, "ai")) {
          var wantsWar = Math.random() < 0.5;
          var negotiated = wantsWar ? aiProposeWarPlan(u, nearCampAi) : aiAskForPeace(u, nearCampAi);
          if (!negotiated) negotiated = wantsWar ? aiAskForPeace(u, nearCampAi) : aiProposeWarPlan(u, nearCampAi);
          if (negotiated) return;
        }
        var targetCamp = nearestUnnegotiatedCampForAi(u);
        if (targetCamp) moveToward(u, targetCamp.x, targetCamp.y);
        u.acted = true;
        return;
      }

      if (hard) { aiHardActUnit(u, f); return; }

      var reachable = reachableTiles(u);
      var attackable = attackableTiles(u, reachable);
      if (attackable.length) {
        var t = pickWeakestTarget(attackable);
        resolveUnitAttack(u, t[0], t[1]);
        return;
      }

      if (type.attack > 0) {
        var enemyTarget = nearestEnemy(u);
        if (enemyTarget) moveToward(u, enemyTarget[0], enemyTarget[1]);
      }
      u.acted = true;
    });
  }

  function pickWeakestTarget(tiles) {
    var best = tiles[0], bestHp = Infinity;
    tiles.forEach(function (t) {
      var eu = unitAt(t[0], t[1]);
      var hp = eu ? eu.hp : (baseAt(t[0], t[1]) ? baseAt(t[0], t[1]).base.hp : Infinity);
      if (hp < bestHp) { bestHp = hp; best = t; }
    });
    return best;
  }

  function nearestDamagedCity(u, f) {
    var best = null, bestD = Infinity;
    f.bases.forEach(function (b) {
      if (!b.alive || b.hp >= b.maxHp) return;
      var d = Math.abs(b.x - u.x) + Math.abs(b.y - u.y);
      if (d < bestD) { bestD = d; best = b; }
    });
    return best;
  }

  function nearestResourceTile(u) {
    var best = null, bestD = Infinity;
    RESOURCE_LIST.forEach(function (r) {
      var d = Math.abs(r[0] - u.x) + Math.abs(r[1] - u.y);
      if (d < bestD) { bestD = d; best = r; }
    });
    return best;
  }

  // Only ever considers enemy units/bases the acting faction can currently
  // see — a faction with no vision grid of its own (natives) falls back to
  // full knowledge, unchanged.
  function nearestEnemy(u) {
    var enemy = enemyOf(u.owner);
    var visGrid = factionOf(u.owner).visible;
    var isVisible = function (x, y) { return !visGrid || (visGrid[y] && visGrid[y][x]); };
    var candidates = enemy.units.filter(function (e) { return isVisible(e.x, e.y); }).map(function (e) { return [e.x, e.y]; });
    enemy.bases.forEach(function (b) { if (b.alive && isVisible(b.x, b.y)) candidates.push([b.x, b.y]); });
    var best = null, bestD = Infinity;
    candidates.forEach(function (c) {
      var d = Math.abs(c[0] - u.x) + Math.abs(c[1] - u.y);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

  function moveToward(u, tx, ty) {
    var reachable = reachableTiles(u);
    if (!reachable.length) return;
    // Hard's AI measures distance along real paths, so it walks around
    // water and mountains instead of getting stuck against them.
    var dist = (u.owner === "ai" && isHardAi()) ? pathDistancesTo(u, tx, ty) : null;
    if (dist && !isFinite(dist[u.y][u.x])) dist = null;
    var distOf = function (x, y) { return dist ? dist[y][x] : Math.abs(x - tx) + Math.abs(y - ty); };
    var best = null, bestD = Infinity;
    reachable.forEach(function (t) {
      var d = distOf(t[0], t[1]);
      if (d < bestD) { bestD = d; best = t; }
    });
    var curD = distOf(u.x, u.y);
    if (best && bestD < curD) { u.x = best[0]; u.y = best[1]; }
  }

  // Movement-cost distance from every tile to (tx, ty) for this unit's kind
  // of movement, ignoring other units (they'll have moved by the time it
  // gets there). The target tile itself is always enterable.
  function pathDistancesTo(u, tx, ty) {
    var type = UNIT_TYPES[u.typeId];
    var domain = type.domain || "land";
    var dist = [];
    for (var y = 0; y < ROWS; y++) dist.push(new Array(COLS).fill(Infinity));
    dist[ty][tx] = 0;
    var queue = [[tx, ty]];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
      // Small grid: a linear scan for the closest open tile is plenty fast.
      var bi = 0;
      for (var i = 1; i < queue.length; i++) if (dist[queue[i][1]][queue[i][0]] < dist[queue[bi][1]][queue[bi][0]]) bi = i;
      var cur = queue.splice(bi, 1)[0];
      var cd = dist[cur[1]][cur[0]];
      for (var di = 0; di < 4; di++) {
        var nx = cur[0] + dirs[di][0], ny = cur[1] + dirs[di][1];
        if (!inBounds(nx, ny)) continue;
        // Cost of stepping from (nx,ny) onto cur — cur's terrain decides.
        var step = (cur[0] === tx && cur[1] === ty) ? 1 : moveCost(terrainAt(cur[0], cur[1]), domain, type.category);
        if (!isFinite(step) || !isFinite(moveCost(terrainAt(nx, ny), domain, type.category))) continue;
        if (cd + step < dist[ny][nx]) {
          if (!isFinite(dist[ny][nx])) queue.push([nx, ny]);
          dist[ny][nx] = cd + step;
        }
      }
    }
    return dist;
  }


  // ---------- HARD-MODE AI ----------
  // Hard doesn't only out-produce you (see DIFFICULTY_AI_MULT): its units
  // also fight smarter. They only take attacks that pay off, pull badly
  // hurt units back home, rally to a threatened city, and ship land armies
  // across the water to invade. Baby Mode and Medium keep the simpler
  // behaviour in runAiTurn. Hard knows where your cities are when planning
  // an invasion, but still has to actually see a unit to attack it.
  var AI_RETREAT_HP_FRACTION = 0.35;
  var AI_THREAT_RADIUS = 4;   // enemy this close to an AI city counts as a threat
  var AI_RALLY_RADIUS = 10;   // units this close to a threatened city go to defend it
  var AI_INVASION_MIN_CARGO = 2;

  function isHardAi() { return state.difficulty === "hard" && !state.hotseat; }

  function manhattan(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }
  function aiUnitValue(id) {
    var t = UNIT_TYPES[id];
    return t.attack * 2 + t.defense + t.hp / 2;
  }
  function aiIsCombatUnit(u) {
    var t = UNIT_TYPES[u.typeId];
    return t.attack > 0 && !t.canFoundCity && u.typeId !== "harvester";
  }
  function aiCanCrossWater(u) {
    var t = UNIT_TYPES[u.typeId];
    return t.category === "air" || (t.domain || "land") === "naval";
  }
  // Ships with room for at least two units count as troop transports.
  function aiIsTransportType(t) { return (t.capacity || 0) >= 2; }
  function aliveCities(f) { return f.bases.filter(function (b) { return b.alive; }); }
  function nearestCityOf(f, x, y) {
    var best = null, bestD = Infinity;
    aliveCities(f).forEach(function (b) {
      var d = manhattan(b.x, b.y, x, y);
      if (d < bestD) { bestD = d; best = b; }
    });
    return best;
  }

  // Native units/camps are only worth hitting when they're already hostile
  // to the AI — attacking a neutral camp just turns it against the AI.
  function aiNativeTargetIsHostile(p) {
    if (p.targetUnit && p.targetUnit.owner === "natives") {
      var camp = campById(p.targetUnit.campId);
      return !!(p.targetUnit.atWar || (camp && (camp.pact === "war" || camp.startledByAi)));
    }
    if (p.targetBase && p.targetBase.id === "natives") {
      return p.targetBase.base.pact === "war" || !!p.targetBase.base.startledByAi;
    }
    return true;
  }

  // Scores every attack the unit could make right now using the exact
  // combat preview, and returns the best tile — or null when no attack is
  // worth making (a losing trade, or one that would get the unit killed).
  function aiBestAttack(u, tiles) {
    var best = null, bestScore = 0;
    tiles.forEach(function (t) {
      var p = previewCombat(u, t[0], t[1]);
      if (p.innerArtilleryActive || !aiNativeTargetIsHostile(p)) return;
      var targetHp = p.targetUnit ? p.targetUnit.hp : p.targetBase.base.hp;
      var kills = p.dealt >= targetHp;
      var taken = kills ? 0 : p.taken;
      var score = Math.min(p.dealt, targetHp) * 2 - taken * 1.5;
      if (kills) score += p.targetBase ? 200 : 15 + (p.targetUnit ? aiUnitValue(p.targetUnit.typeId) : 0);
      if (p.targetBase && !p.targetBase.base.isCamp) score += 10; // cities win the game
      if (taken >= u.hp) score -= 40 + aiUnitValue(u.typeId);
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return best;
  }

  // The closest visible enemy unit to any AI city, if one is within
  // AI_THREAT_RADIUS of it.
  function aiCityThreat(f) {
    var enemy = enemyOf(f.id);
    var best = null, bestD = Infinity;
    aliveCities(f).forEach(function (b) {
      enemy.units.forEach(function (e) {
        if (!f.visible || !f.visible[e.y][e.x]) return;
        var d = manhattan(b.x, b.y, e.x, e.y);
        if (d <= AI_THREAT_RADIUS && d < bestD) { bestD = d; best = { unit: e, city: b }; }
      });
    });
    return best;
  }

  function aiVisibleEnemyNear(u, radius) {
    var f = factionOf(u.owner);
    return enemyOf(u.owner).units.some(function (e) {
      return f.visible && f.visible[e.y][e.x] && manhattan(u.x, u.y, e.x, e.y) <= radius;
    });
  }

  function aiChooseBuildHard(f) {
    var enemy = enemyOf(f.id);
    var military = f.units.filter(aiIsCombatUnit).length;
    var cities = aliveCities(f).length;
    var settlers = f.units.filter(function (u) { return UNIT_TYPES[u.typeId].canFoundCity; }).length;
    var home = aliveCities(f)[0];
    var enemyOverseas = !!home && aliveCities(enemy).some(function (b) { return islandIdAt(b.x, b.y) !== islandIdAt(home.x, home.y); });
    var enemyHasAir = enemy.units.some(function (u) { return UNIT_TYPES[u.typeId].category === "air"; });
    var has = function (id) { return f.buildings.indexOf(id) !== -1; };

    var wantBuilding = null;
    if (!has("barracks") && military >= 2) wantBuilding = "barracks";
    else if (!has("foundry") && military >= 3) wantBuilding = "foundry";
    else if (!has("shipyard") && enemyOverseas && factionHasCoastalCity(f) && military >= 4) wantBuilding = "shipyard";
    else if (!has("antiAir") && enemyHasAir && military >= 6) wantBuilding = "antiAir";
    if (wantBuilding) { f.buildQueue.push({ kind: "building", id: wantBuilding }); return; }

    if (settlers === 0 && cities < 4 && military >= 2) { f.buildQueue.push({ kind: "unit", id: "aiSettler" }); return; }

    var transports = f.units.filter(function (u) { return aiIsTransportType(UNIT_TYPES[u.typeId]); }).length;
    var landArmy = f.units.filter(function (u) { return aiIsCombatUnit(u) && !aiCanCrossWater(u); }).length;
    if (enemyOverseas && has("shipyard") && transports === 0 && landArmy >= 2 && f.unlocked.indexOf("frigate") !== -1) {
      f.buildQueue.push({ kind: "unit", id: "frigate" });
      return;
    }

    // Otherwise the strongest combat unit it can field, now and then
    // taking the runner-up so its army isn't all one type. With the enemy
    // overseas and no way to ship troops, it switches to aircraft once its
    // home defence is in place — more land units would just sit at home.
    var coastal = factionHasCoastalCity(f);
    var stranded = enemyOverseas && !(has("shipyard") && coastal);
    var pool = f.unlocked.filter(function (id) {
      var t = UNIT_TYPES[id];
      if (!t.attack || t.canFoundCity || id === "harvester" || t.oneTimeUse) return false;
      // Warships can't touch a city's coastal artillery, so naval units
      // are only ever built as transports (handled above).
      if ((t.domain || "land") === "naval") return false;
      return true;
    });
    if (stranded && landArmy >= 6) {
      var air = pool.filter(function (id) { return UNIT_TYPES[id].category === "air"; });
      if (air.length) pool = air;
    }
    pool.sort(function (a, b) { return aiUnitValue(b) - aiUnitValue(a); });
    var pick = pool.length ? pool[(Math.random() < 0.65 || pool.length === 1) ? 0 : 1] : "lightInfantry";
    f.buildQueue.push({ kind: "unit", id: pick });
  }

  function aiHardActUnit(u, f) {
    var type = UNIT_TYPES[u.typeId];
    var naval = (type.domain || "land") === "naval";

    // A transport carrying troops sails for the enemy and lands them.
    if (naval && aiIsTransportType(type) && u.cargo.length) { aiHardSailTransport(u, f); return; }

    var reachable = reachableTiles(u);
    var target = aiBestAttack(u, attackableTiles(u, reachable));
    if (target) { resolveUnitAttack(u, target[0], target[1]); return; }
    u.acted = true;
    if (!type.attack) return;

    // Badly hurt and under threat: fall back toward the nearest friendly city.
    if (u.hp <= Math.ceil(type.hp * AI_RETREAT_HP_FRACTION) && aiVisibleEnemyNear(u, 3)) {
      var refuge = nearestCityOf(f, u.x, u.y);
      if (refuge) moveToward(u, refuge.x, refuge.y);
      return;
    }

    // An empty transport waits in port for troops to board.
    if (naval && aiIsTransportType(type)) { aiReturnToPort(u, f); return; }

    var myIsland = islandIdAt(u.x, u.y);
    var canReach = function (x, y) { return aiCanCrossWater(u) || islandIdAt(x, y) === myIsland; };

    var threat = aiCityThreat(f);
    if (threat && manhattan(u.x, u.y, threat.city.x, threat.city.y) <= AI_RALLY_RADIUS && canReach(threat.unit.x, threat.unit.y)) {
      moveToward(u, threat.unit.x, threat.unit.y);
      return;
    }

    var seen = nearestEnemy(u);
    if (seen && canReach(seen[0], seen[1])) { moveToward(u, seen[0], seen[1]); return; }

    var city = nearestCityOf(enemyOf(f.id), u.x, u.y);
    if (!city) return;
    if (canReach(city.x, city.y)) { moveToward(u, city.x, city.y); return; }

    // A land unit with the enemy overseas heads for a transport and boards.
    var boardable = boardableTiles(u, reachable).filter(function (t) { return aiIsTransportType(UNIT_TYPES[unitAt(t[0], t[1]).typeId]); });
    if (boardable.length) { boardFrigate(u, unitAt(boardable[0][0], boardable[0][1])); return; }
    var ship = aiNearestTransportWithRoom(f, u);
    if (ship) moveToward(u, ship.x, ship.y);
  }

  // The water tile nearest (nearX, nearY) with open land of the given island
  // beside it — somewhere troops can board from, or be landed onto (a city
  // tile itself can't be stood on).
  function aiDockTile(ship, island, nearX, nearY) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var best = null, bestD = Infinity;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (terrainAt(x, y) !== "water") continue;
        var other = unitAt(x, y);
        if (other && other.id !== ship.id) continue;
        var dock = dirs.some(function (d) {
          var nx = x + d[0], ny = y + d[1];
          return inBounds(nx, ny) && terrainAt(nx, ny) !== "water" && islandIdAt(nx, ny) === island && !baseAt(nx, ny);
        });
        if (!dock) continue;
        var dd = manhattan(x, y, nearX, nearY);
        if (dd < bestD) { bestD = dd; best = [x, y]; }
      }
    }
    return best;
  }
  function aiSailTo(ship, tile) {
    if (tile && (tile[0] !== ship.x || tile[1] !== ship.y)) moveToward(ship, tile[0], tile[1]);
  }
  function aiReturnToPort(ship, f) {
    var home = aliveCities(f)[0];
    if (home) aiSailTo(ship, aiDockTile(ship, islandIdAt(home.x, home.y), home.x, home.y));
  }

  function aiNearestTransportWithRoom(f, u) {
    var best = null, bestD = Infinity;
    f.units.forEach(function (s) {
      var t = UNIT_TYPES[s.typeId];
      if (!aiIsTransportType(t) || cargoOccupied(s) + cargoSlotCost(u.typeId) > t.capacity) return;
      var d = manhattan(s.x, s.y, u.x, u.y);
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
  }

  function aiHardSailTransport(u, f) {
    var type = UNIT_TYPES[u.typeId];
    u.acted = true;
    // Wait in port until enough troops are aboard, unless nobody else is
    // coming (no land combat units left ashore on the home island).
    var home = aliveCities(f)[0];
    var stillComing = !!home && f.units.some(function (o) {
      return aiIsCombatUnit(o) && !aiCanCrossWater(o) && islandIdAt(o.x, o.y) === islandIdAt(home.x, home.y);
    });
    if (cargoOccupied(u) < Math.min(type.capacity, AI_INVASION_MIN_CARGO) && stillComing) { aiReturnToPort(u, f); return; }

    var city = nearestCityOf(enemyOf(f.id), u.x, u.y);
    if (!city) return;
    var targetIsland = islandIdAt(city.x, city.y);
    if (!aiUnloadOnto(u, targetIsland)) {
      aiSailTo(u, aiDockTile(u, targetIsland, city.x, city.y));
      aiUnloadOnto(u, targetIsland);
    }
  }

  // Lands every unit it can onto open ground of the given island next to
  // the ship. Returns true if anything disembarked.
  function aiUnloadOnto(ship, island) {
    var landed = false;
    for (var i = ship.cargo.length - 1; i >= 0; i--) {
      var spots = findAllDisembarkTiles(ship).filter(function (t) { return islandIdAt(t[0], t[1]) === island; });
      if (!spots.length) break;
      disembarkUnitAt(ship, i, spots[0][0], spots[0][1]);
      landed = true;
    }
    return landed;
  }
