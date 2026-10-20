  // ---------- BARBARIANS ----------
  // Of the player, the AI, and the natives, whichever has the closest unit
  // or living base to u — used both to steer a raider on foot and to steer a
  // loaded Sail Boat toward whichever shore is nearest trouble.
  function nearestHostileTarget(u) {
    var factionIds = ["player", "ai", "natives"];
    var best = null, bestD = Infinity, bestFaction = null;
    factionIds.forEach(function (fid) {
      var t = nearestFactionTarget(u, fid);
      if (!t) return;
      var d = Math.abs(t[0] - u.x) + Math.abs(t[1] - u.y);
      if (d < bestD) { bestD = d; best = t; bestFaction = fid; }
    });
    return best ? { tile: best, factionId: bestFaction } : null;
  }

  // Only the player's and the AI's cities hold anything worth stealing — the
  // natives have no tech tree — so a Robber only ever targets those two.
  function nearestStealableCity(u) {
    var best = null, bestD = Infinity;
    [state.player, state.ai].forEach(function (f) {
      f.bases.forEach(function (b) {
        if (!b.alive) return;
        var d = Math.abs(b.x - u.x) + Math.abs(b.y - u.y);
        if (d < bestD) { bestD = d; best = b; }
      });
    });
    return best;
  }
  function adjacentStealableCity(u) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var b = baseAt(u.x + dirs[i][0], u.y + dirs[i][1]);
      if (b && (b.id === "player" || b.id === "ai") && b.base.alive) return b;
    }
    return null;
  }
  // A researched unlock is only "stealable" if it was actually earned via
  // tech or a building, not one of the free units every faction starts with.
  function stealableUnlocks(f) {
    return f.unlocked.filter(function (id) {
      return STARTING_UNLOCKS.indexOf(id) === -1 && id !== "aiSettler";
    });
  }
  // Sneaks in, takes one random earned unlock away from the victim faction
  // for good, hands the barbarians that same design (this is how a hard-mode
  // Barbarian City ever gets to build a Frigate — see tickBarbarianEconomy),
  // and instantly disappears — returns false (and does nothing) if that
  // city's owner has nothing worth stealing yet.
  function runBarbarianRobberSteal(robberUnit, targetBaseInfo) {
    var f = targetBaseInfo.faction;
    var pool = stealableUnlocks(f);
    if (!pool.length) return false;
    var stolenId = pool[Math.floor(Math.random() * pool.length)];
    f.unlocked = f.unlocked.filter(function (id) { return id !== stolenId; });
    if (state.barbarians.unlocked.indexOf(stolenId) === -1) state.barbarians.unlocked.push(stolenId);
    var label = cityLabel(f, targetBaseInfo.base);
    addLog("A Barbarian Robber sneaks into " + possessiveLabel(targetBaseInfo.id) + " " + label +
      " and steals the plans for the " + UNIT_TYPES[stolenId].name + "! " +
      (targetBaseInfo.id === "player" ? "You" : "The AI") + " can no longer build it, and the barbarians can now build it themselves.", false);
    removeUnit(robberUnit);
    return true;
  }

  // Barbarians never build or research anything — this is their entire turn.
  // Loaded Sail Boats make for the nearest hostile shore and unload; empty
  // ones fight like any other unit (they have their own attack/defense).
  // Robbers never initiate combat — they beeline for the nearest player/AI
  // city, sneak in and steal the moment they're adjacent to one, and vanish.
  // Every other raider (Legion, Trike) attacks the player, the AI, and the
  // natives alike, exactly like a native garrison hunting an enemy.
  function runBarbarianTurn() {
    state.barbarians.units.forEach(function (u) { u.acted = false; });
    state.barbarians.units.slice().forEach(function (u) {
      if (u.hp <= 0 || u.acted) return;
      var type = UNIT_TYPES[u.typeId];

      if (type.domain === "naval" && u.cargo.length) {
        var landingTiles = findAllDisembarkTiles(u);
        if (landingTiles.length) {
          while (u.cargo.length) {
            var tiles = findAllDisembarkTiles(u);
            if (!tiles.length) break;
            disembarkUnitAt(u, 0, tiles[0][0], tiles[0][1]);
          }
          u.acted = true;
          return;
        }
        var dest = nearestHostileTarget(u);
        if (dest) moveToward(u, dest.tile[0], dest.tile[1]);
        u.acted = true;
        return;
      }

      if (u.typeId === "barbarianRobber") {
        var stealTarget = adjacentStealableCity(u);
        if (stealTarget && runBarbarianRobberSteal(u, stealTarget)) return;
        var cityTarget = nearestStealableCity(u);
        if (cityTarget) moveToward(u, cityTarget.x, cityTarget.y);
        u.acted = true;
        return;
      }

      if (type.attack > 0) {
        var reachable = reachableTiles(u);
        var attackable = attackableTiles(u, reachable);
        if (attackable.length) {
          var t = pickWeakestTarget(attackable);
          resolveUnitAttack(u, t[0], t[1]);
          return;
        }
        var hostile = nearestHostileTarget(u);
        var beforeX = u.x, beforeY = u.y;
        if (hostile) moveToward(u, hostile.tile[0], hostile.tile[1]);
        // moveToward only steps when it strictly shortens the distance, so a
        // raider that's boxed in by the map (or already at its nearest
        // reachable approach) would otherwise camp in the same spot forever.
        // For a Sail Boat that means permanently jamming the one water tile
        // its own Barbarian City needs to launch the next one — so a raider
        // that made no progress wanders to a random reachable tile instead,
        // keeping the coast clear rather than standing still.
        if (u.x === beforeX && u.y === beforeY && reachable.length) {
          var wander = reachable[Math.floor(Math.random() * reachable.length)];
          u.x = wander[0]; u.y = wander[1];
        }
      }
      u.acted = true;
    });
  }

  // Rolls the odds of a new landing party once turn 30 is reached, capped so
  // no more than BARBARIAN_MAX_ACTIVE_BOATS Sail Boats are ever at sea at
  // once. Anchors on a random living player/AI city (preferring a coastal
  // one) and drops a loaded Sail Boat on nearby open water.
  function maybeSpawnBarbarians() {
    if (state.turn < BARBARIAN_START_TURN) return;
    var activeBoats = state.barbarians.units.filter(function (u) { return UNIT_TYPES[u.typeId].domain === "naval"; });
    if (activeBoats.length >= BARBARIAN_MAX_ACTIVE_BOATS) return;
    if (Math.random() >= BARBARIAN_SPAWN_CHANCE) return;

    var targets = [state.player, state.ai].filter(factionAlive);
    if (!targets.length) return;
    var targetFaction = targets[Math.floor(Math.random() * targets.length)];
    var aliveCities = targetFaction.bases.filter(function (b) { return b.alive; });
    if (!aliveCities.length) return;
    var coastalCities = aliveCities.filter(isCoastal);
    var anchor = (coastalCities.length ? coastalCities : aliveCities)[Math.floor(Math.random() * (coastalCities.length ? coastalCities.length : aliveCities.length))];

    var waterSpots = bfsFindTiles(anchor.x, anchor.y, function (x, y) {
      return terrainAt(x, y) === "water" && !unitAt(x, y);
    }, 6);
    if (!waterSpots.length) return;
    var spot = waterSpots[Math.floor(Math.random() * waterSpots.length)];

    var boat = newUnit("barbarianSailboat", "barbarians", spot[0], spot[1]);
    var partySize = BARBARIAN_PARTY_MIN + Math.floor(Math.random() * (BARBARIAN_PARTY_MAX - BARBARIAN_PARTY_MIN + 1));
    for (var i = 0; i < partySize; i++) {
      var pickId = BARBARIAN_UNIT_POOL[Math.floor(Math.random() * BARBARIAN_UNIT_POOL.length)];
      boat.cargo.push(newUnit(pickId, "barbarians", spot[0], spot[1]));
    }
    state.barbarians.units.push(boat);
    addLog("Barbarians have been sighted! A raiding party sails toward " +
      (targetFaction.id === "player" ? "your" : "the AI's") + " shores.", false);
  }

  // Hard mode only: runs a (deliberately weak) economy for any Barbarian
  // Cities placed by placeBarbarianCities — a no-op in Baby Mode and Medium,
  // where state.barbarians.bases is always empty. Production accrues at
  // BARBARIAN_PROD_MULT of a normal faction's rate, and the build queue is
  // hardcoded rather than player-chosen: a Shipyard first (needs a coastal
  // city, same rule as the player/AI), then Sail Boats forever after — plus
  // occasional Frigates once a Robber has stolen "frigate" from someone (see
  // runBarbarianRobberSteal). Never Anti-Air, Barracks, or Foundry.
  function tickBarbarianEconomy() {
    var f = state.barbarians;
    if (!factionAlive(f)) return;
    var pb = productionBreakdown(f);
    f.production += Math.round(pb.total * BARBARIAN_PROD_MULT);

    if (!f.buildQueue.length) {
      if (f.buildings.indexOf("shipyard") === -1) {
        if (factionHasCoastalCity(f)) f.buildQueue.push({ kind: "building", id: "shipyard" });
      } else {
        var canFrigate = f.unlocked.indexOf("frigate") !== -1;
        var pickId = (canFrigate && Math.random() < 0.3) ? "frigate" : "barbarianSailboat";
        f.buildQueue.push({ kind: "unit", id: pickId });
      }
    }

    if (f.buildQueue.length) {
      var qitem = f.buildQueue[0];
      var qtype = queueItemType(qitem);
      if (f.production >= qtype.cost) {
        if (qitem.kind === "building") {
          f.production -= qtype.cost;
          if (f.buildings.indexOf(qitem.id) === -1) f.buildings.push(qitem.id);
          addLog("A Barbarian City completes a " + qtype.name + ".", false);
          f.buildQueue.shift();
        } else {
          var domain = qtype.domain || "land";
          var spot = findSpawnTileForFaction(f, domain, null);
          if (spot) {
            f.production -= qtype.cost;
            f.units.push(newUnit(qitem.id, "barbarians", spot[0], spot[1]));
            addLog("A Barbarian City launches a new " + qtype.name + ".", false);
            f.buildQueue.shift();
          }
        }
      }
    }
  }

  // { base: flat rate, harvest: bonus from a harvester on a goods tile,
  //   cities: +1 per city beyond the capital, buildings: sum of built
  //   production buildings, total: what gets added each turn }
  function productionBreakdown(f) {
    var base = 2;
    var harvest = f.units.some(function (u) { return u.typeId === "harvester" && isResourceTile(u.x, u.y); }) ? 2 : 0;
    var cities = Math.max(0, f.bases.filter(function (b) { return b.alive; }).length - 1);
    var buildings = f.buildings.reduce(function (sum, id) { return sum + BUILDING_TYPES[id].prodBonus; }, 0);
    return { base: base, harvest: harvest, cities: cities, buildings: buildings, total: base + harvest + cities + buildings };
  }

  function queueItemType(item) { return item.kind === "building" ? BUILDING_TYPES[item.id] : UNIT_TYPES[item.id]; }

  function newUnit(typeId, owner, x, y) {
    return { id: "u" + (state.nextUnitId++), typeId: typeId, owner: owner, x: x, y: y, hp: UNIT_TYPES[typeId].hp, acted: false, cargo: [] };
  }

  // BFS out from (cx,cy) over the 4-neighborhood, collecting up to `count`
  // tiles matching predicate, nearest first. Used to seat starting units
  // around a freshly founded capital without hardcoding offsets that might
  // land in water or off a small island.
  function bfsFindTiles(cx, cy, predicate, count) {
    var visited = {}; visited[key(cx, cy)] = true;
    var queue = [[cx, cy]];
    var found = [];
    var qi = 0;
    while (qi < queue.length && found.length < count) {
      var cur = queue[qi++];
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < dirs.length; i++) {
        var nx = cur[0] + dirs[i][0], ny = cur[1] + dirs[i][1];
        if (!inBoundsRaw(nx, ny)) continue;
        var k = key(nx, ny);
        if (visited[k]) continue;
        visited[k] = true;
        if (predicate(nx, ny)) found.push([nx, ny]);
        queue.push([nx, ny]);
      }
    }
    return found;
  }

  function placeStartingUnits(f, cap) {
    var landSpots = bfsFindTiles(cap[0], cap[1], function (x, y) {
      return terrainAt(x, y) !== "water" && !unitAt(x, y) && !baseAt(x, y);
    }, 3);
    var kinds = ["harvester", "scout", f.isAI ? "aiSettler" : "settler"];
    for (var i = 0; i < kinds.length && i < landSpots.length; i++) {
      f.units.push(newUnit(kinds[i], f.id, landSpots[i][0], landSpots[i][1]));
    }
    var waterSpots = bfsFindTiles(cap[0], cap[1], function (x, y) {
      return terrainAt(x, y) === "water" && !unitAt(x, y);
    }, 1);
    if (waterSpots.length) f.units.push(newUnit("frigate", f.id, waterSpots[0][0], waterSpots[0][1]));
  }

  function newGame(difficulty, hotseat) {
    var map = generateMap();
    TERRAIN_GRID = map.terrain;
    RESOURCE_GRID = map.resource;
    RESOURCE_LIST = map.resourceList;
    ISLAND_GRID = map.islandGrid;

    state = {
      turn: 1, nextUnitId: 1, nextCityId: 1, over: false, winner: null, hofRecorded: false,
      difficulty: difficulty || (state && state.difficulty) || "medium",
      selectedUnitId: null, selectedBaseId: null, pendingDisembark: null, log: [],
      // Local hotseat multiplayer: hotseat is on/off for the whole game;
      // hotseatSecondTurn tracks which of the two humans' sub-turns within
      // the current round is in progress (see the End Turn handler and
      // swapHotseatSeats). Set up front (not after newGame returns) so that
      // foundCity, called below for both starting capitals, already sees
      // it and gives both humans the same coastal-artillery bonus.
      hotseat: !!hotseat, hotseatSecondTurn: false
    };
    state.player = makeFaction("player", false);
    state.ai = makeFaction("ai", true);
    state.natives = makeNativesFaction();
    state.barbarians = makeBarbariansFaction();

    state.player.explored = makeVisionGrid();
    state.player.visible = makeVisionGrid();
    state.ai.explored = makeVisionGrid();
    state.ai.visible = makeVisionGrid();

    foundCity(state.player, map.playerCapital[0], map.playerCapital[1]);
    foundCity(state.ai, map.aiCapital[0], map.aiCapital[1]);

    placeStartingUnits(state.player, map.playerCapital);
    placeStartingUnits(state.ai, map.aiCapital);

    // Camps go last, once the capitals (and the distance they keep other
    // sites away from) are settled.
    placeNativeCamps(state.natives);
    // Barbarian cities are a hard-mode-only feature — Baby Mode and Medium
    // never get them, only the periodic raiding parties every difficulty
    // shares (see maybeSpawnBarbarians).
    if (state.difficulty === "hard") placeBarbarianCities();

    updateFogOfWar();

    setBoardCssVars();

    addLog("Turn 1 begins.");
    render();
  }

  // Starts a local, same-device, 2-human hotseat game: an ordinary newGame
  // plus the hotseat flag and each seat's display name (which lives on the
  // faction object itself, see makeFaction, so it travels with that human
  // when swapHotseatSeats swaps who occupies the "player"/"ai" slot).
  function startHotseatGame(name1, name2, difficulty) {
    newGame(difficulty, true);
    state.player.displayName = (name1 || "Player 1").trim().slice(0, 20) || "Player 1";
    state.ai.displayName = (name2 || "Player 2").trim().slice(0, 20) || "Player 2";
  }

  // Swaps which human's data currently occupies the "player" slot (the one
  // every piece of UI, input handling, and fog-of-war renders as "you") and
  // the "ai" slot (rendered as the opponent) — see the long comment at
  // factionOf for why this is safe: every other part of the engine already
  // treats "player"/"ai" purely as faction-object slots, not fixed human
  // identities, so re-pointing state.player/state.ai is enough to hand
  // control to the other human with zero changes anywhere else. Only data
  // that's stored OUTSIDE the faction object as a literal "player"/"ai"
  // string has to be fixed up by hand here:
  //  - unit.owner (units live in f.units, but still carry their owner's id)
  //  - native camp pact/aiPact and native unit atWar/atWarVsPlayer, which
  //    track each camp's relationship with "whichever human is in the
  //    player slot" / "...the ai slot" — exactly the same slot-scoped
  //    relationship that needs to follow its human when the humans swap.
  // (camp.startledByAi is left as-is: it has no "startledByPlayer" twin, so
  // it's the one small, intentionally-accepted inconsistency here — a camp
  // startled against whoever was in the "ai" slot stays hostile to whoever
  // is in that slot next, rather than following the specific human. Minor
  // and rare enough not to be worth a new field for.)
  function swapHotseatSeats() {
    var tmp = state.player;
    state.player = state.ai;
    state.ai = tmp;
    state.player.id = "player";
    state.ai.id = "ai";
    state.player.units.forEach(function (u) { u.owner = "player"; });
    state.ai.units.forEach(function (u) { u.owner = "ai"; });
    state.natives.bases.forEach(function (c) {
      var p = c.pact; c.pact = c.aiPact; c.aiPact = p;
      var sp = !!c.startledByPlayer; c.startledByPlayer = !!c.startledByAi; c.startledByAi = sp;
    });
    state.natives.units.forEach(function (u) {
      var w = !!u.atWar, wv = !!u.atWarVsPlayer;
      u.atWar = wv; u.atWarVsPlayer = w;
    });
    state.selectedUnitId = null;
    state.selectedBaseId = null;
    state.pendingDisembark = null;
  }

  function makeVisionGrid() {
    var grid = [];
    for (var y = 0; y < ROWS; y++) grid.push(new Array(COLS).fill(false));
    return grid;
  }

  // Real fog of war, per faction: "explored" is permanent (terrain, once
  // seen, is never forgotten — it just renders as remembered rather than
  // pitch black), while "visible" is recomputed fresh every call and only
  // ever true for tiles currently within sight of one of that faction's
  // own units or cities. Units/bases only ever show up on tiles that are
  // BOTH explored and currently visible (see renderBoard and the fog-aware
  // combat/targeting checks), so a faction can lose track of an enemy the
  // moment it looks away — the AI genuinely can't see the player (or vice
  // versa) until one of its own units or cities re-establishes sight.
  function revealAround(f, cx, cy, r) {
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        var x = cx + dx, y = cy + dy;
        if (!inBoundsRaw(x, y)) continue;
        f.explored[y][x] = true;
        // Forest cover: an enemy unit hiding in a forest can only be spotted
        // from an adjacent tile, however far the viewer can otherwise see.
        // Submarines hide the same way, in open water.
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 1 && terrainAt(x, y) !== "plain" && terrainAt(x, y) !== "mountain") {
          var hidden = unitAt(x, y);
          if (hidden && hidden.owner !== f.id && (terrainAt(x, y) === "forest" || hidden.typeId === "submarine")) continue;
        }
        f.visible[y][x] = true;
      }
    }
  }
  function updateVisionFor(f) {
    f.visible = makeVisionGrid();
    f.units.forEach(function (u) {
      // High ground: a unit on a mountain sees one tile further.
      revealAround(f, u.x, u.y, (u.typeId === "scout" ? 3 : (UNIT_TYPES[u.typeId].range > 1 ? 2 : 1)) + (terrainAt(u.x, u.y) === "mountain" ? 1 : 0));
    });
    f.bases.forEach(function (b) {
      if (b.alive) revealAround(f, b.x, b.y, 2);
    });
  }
  function updateFogOfWar() {
    updateVisionFor(state.player);
    updateVisionFor(state.ai);
  }

  function addLog(text, isWin) {
    state.log.unshift({ text: text, win: !!isWin });
    if (state.log.length > 40) state.log.pop();
  }

  // The natives are a third, non-playable faction (see factionOf) — they
  // never take a faction id of "player" or "ai" themselves, so anything
  // keyed strictly off those two ids (enemyOf, the AI's build queue, etc.)
  // correctly never targets or acts as them.
  function factionOf(id) { return id === "player" ? state.player : (id === "ai" ? state.ai : (id === "barbarians" ? state.barbarians : state.natives)); }
  function enemyOf(id) { return id === "player" ? state.ai : state.player; }

  function unitAt(x, y) {
    var all = state.player.units.concat(state.ai.units).concat(state.natives.units).concat(state.barbarians.units);
    for (var i = 0; i < all.length; i++) if (all[i].x === x && all[i].y === y && all[i].hp > 0) return all[i];
    return null;
  }
  function baseAt(x, y) {
    var i;
    for (i = 0; i < state.player.bases.length; i++) {
      var pb = state.player.bases[i];
      if (pb.alive && pb.x === x && pb.y === y) return { id: "player", base: pb, faction: state.player };
    }
    for (i = 0; i < state.ai.bases.length; i++) {
      var ab = state.ai.bases[i];
      if (ab.alive && ab.x === x && ab.y === y) return { id: "ai", base: ab, faction: state.ai };
    }
    for (i = 0; i < state.natives.bases.length; i++) {
      var nb = state.natives.bases[i];
      if (nb.alive && nb.x === x && nb.y === y) return { id: "natives", base: nb, faction: state.natives };
    }
    for (i = 0; i < state.barbarians.bases.length; i++) {
      var bb = state.barbarians.bases[i];
      if (bb.alive && bb.x === x && bb.y === y) return { id: "barbarians", base: bb, faction: state.barbarians };
    }
    return null;
  }

  // Dijkstra over the movement budget: 4-directional, cost per tile from
  // terrain (blocked outright if the unit's domain can't cross it), blocked
  // by any unit or base. Small grid, so a plain "scan the frontier" relax
  // loop is plenty fast — no priority queue needed.
  function reachableTiles(unit) {
    var unitType = UNIT_TYPES[unit.typeId];
    var domain = unitType.domain || "land";
    var movement = unitType.movement;
    var dist = {}; dist[key(unit.x, unit.y)] = 0;
    var frontier = [[unit.x, unit.y, 0]];
    var result = [];
    while (frontier.length) {
      var next = [];
      frontier.forEach(function (cur) {
        var cx = cur[0], cy = cur[1], d = cur[2];
        var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        dirs.forEach(function (dir) {
          var nx = cx + dir[0], ny = cy + dir[1];
          if (!inBounds(nx, ny)) return;
          var cost = moveCost(terrainAt(nx, ny), domain, unitType.category);
          if (!isFinite(cost)) return;
          var nd = d + cost;
          // Mountains (cost 3) are meant to be a defense/attack perch, not a
          // tile only fast units can ever set foot on — a unit stepping
          // directly off its own tile (d === 0) can always afford one step,
          // even a costly one, same as any other 4X's "at least one move"
          // rule; it just spends the rest of that turn's movement getting
          // there. Only the very first step of the turn gets this exception,
          // so a unit already mid-move still can't chain through terrain it
          // can't afford.
          if (nd > movement) {
            if (d === 0) nd = movement;
            else return;
          }
          var k = key(nx, ny);
          if (dist.hasOwnProperty(k) && dist[k] <= nd) return;
          if (unitAt(nx, ny) || baseAt(nx, ny)) return;
          dist[k] = nd;
          next.push([nx, ny, nd]);
        });
      });
      next.forEach(function (t) {
        if (!result.some(function (r) { return r[0] === t[0] && r[1] === t[1]; })) result.push([t[0], t[1]]);
      });
      frontier = next;
    }
    return result;
  }

  function attackableTiles(unit, reachable) {
    var type = UNIT_TYPES[unit.typeId];
    if (!type.attack) return [];
    // Natives have no fog of war of their own (they act on full knowledge,
    // unchanged); the player and the AI each only see what's currently
    // within their own vision, so a target hidden in fog can't be targeted
    // even if it happens to be adjacent to a reachable tile.
    var visGrid = factionOf(unit.owner).visible;
    var frontier = reachable.concat([[unit.x, unit.y]]);
    var found = {};
    var out = [];
    frontier.forEach(function (t) {
      var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      // Ranged units can also hit tiles 2 away from where they stand.
      if (type.range > 1 && t[0] === unit.x && t[1] === unit.y) {
        dirs = dirs.concat([[2,0],[-2,0],[0,2],[0,-2],[1,1],[1,-1],[-1,1],[-1,-1]]);
      }
      dirs.forEach(function (d) {
        var nx = t[0] + d[0], ny = t[1] + d[1];
        if (!inBounds(nx, ny)) return;
        if (visGrid && !visGrid[ny][nx]) return;
        var k = key(nx, ny);
        if (found[k]) return;
        var eu = unitAt(nx, ny);
        var eb = baseAt(nx, ny);
        if (eu && eu.owner !== unit.owner) {
          if (type.attackOnly && UNIT_TYPES[eu.typeId].category !== type.attackOnly) return;
          // A camp either side has made peace (or a war pact) with, and its
          // garrison, are off-limits to that side specifically.
          // (The player may still pick a fight with a camp it merely has
          // peace with — the UI asks "Break treaty?" first. War allies stay off-limits.)
          if (unit.owner === "player" && eu.owner === "natives" && campById(eu.campId) && campById(eu.campId).pact === "war") return;
          if (unit.owner === "ai" && eu.owner === "natives" && isAtPeaceWithAi(eu.campId)) return;
          found[k] = true; out.push([nx, ny]);
        } else if (eb && eb.id !== unit.owner) {
          if (type.attackOnly) return; // e.g. the Harvester can't run over a base
          if (unit.owner === "player" && eb.id === "natives" && eb.base.pact === "war") return;
          if (unit.owner === "ai" && eb.id === "natives" && isAtPeaceWithAi(eb.base.id)) return;
          found[k] = true; out.push([nx, ny]);
        }
      });
    });
    return out;
  }

  // Adjacent tiles holding a friendly ship (Frigate/Carrier/Battleship) with
  // room left in its cargo hold. Only land-domain units board — ships are
  // naval, so this only ever matters for units standing on land next to one.
  function boardableTiles(unit, reachable) {
    var type = UNIT_TYPES[unit.typeId];
    if ((type.domain || "land") !== "land" || type.category === "air") return [];
    var frontier = reachable.concat([[unit.x, unit.y]]);
    var found = {};
    var out = [];
    frontier.forEach(function (t) {
      var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      dirs.forEach(function (d) {
        var nx = t[0] + d[0], ny = t[1] + d[1];
        if (!inBounds(nx, ny)) return;
        var k = key(nx, ny);
        if (found[k]) return;
        var eu = unitAt(nx, ny);
        var euType = eu ? UNIT_TYPES[eu.typeId] : null;
        if (eu && eu.owner === unit.owner && euType.capacity && cargoOccupied(eu) + cargoSlotCost(unit.typeId) <= euType.capacity) {
          found[k] = true;
          out.push([nx, ny]);
        }
      });
    });
    return out;
  }

  function boardFrigate(landUnit, frigate) {
    var f = factionOf(landUnit.owner);
    f.units = f.units.filter(function (x) { return x.id !== landUnit.id; });
    landUnit.acted = true;
    frigate.cargo.push(landUnit);
    addLog(UNIT_TYPES[landUnit.typeId].name + " (" + landUnit.owner + ") boards the " + UNIT_TYPES.frigate.name + ".");
    state.selectedUnitId = null;
  }

  // All open, non-water adjacent tiles a ship could set cargo down on —
  // used both to auto-pick a spot for the AI and to offer the player a
  // choice of landing tile.
  function findAllDisembarkTiles(frigate) {
    var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    var out = [];
    for (var i = 0; i < dirs.length; i++) {
      var nx = frigate.x + dirs[i][0], ny = frigate.y + dirs[i][1];
      if (!inBounds(nx, ny)) continue;
      if (terrainAt(nx, ny) === "water") continue;
      if (unitAt(nx, ny) || baseAt(nx, ny)) continue;
      out.push([nx, ny]);
    }
    return out;
  }
  function findDisembarkTile(frigate) {
    var tiles = findAllDisembarkTiles(frigate);
    return tiles.length ? tiles[0] : null;
  }

  // Actually lands cargo slot cargoIdx from frigate onto (x, y) — the caller
  // is responsible for having confirmed (x, y) is a valid landing tile.
  function disembarkUnitAt(frigate, cargoIdx, x, y) {
    var landUnit = frigate.cargo[cargoIdx];
    if (!landUnit) return;
    frigate.cargo.splice(cargoIdx, 1);
    landUnit.x = x;
    landUnit.y = y;
    landUnit.acted = true;
    var f = factionOf(landUnit.owner);
    f.units.push(landUnit);
    addLog(UNIT_TYPES[landUnit.typeId].name + " (" + landUnit.owner + ") disembarks.");
  }

  // Auto-picks the first open landing tile — used by the AI, which has no
  // UI to offer a choice through.
  function disembarkUnit(frigate, cargoIdx) {
    var spot = findDisembarkTile(frigate);
    if (!spot) { addLog("No open ground to disembark onto."); return; }
    disembarkUnitAt(frigate, cargoIdx, spot[0], spot[1]);
  }

  // Shared by the combat-analysis modal (preview) and the actual resolve, so
  // the numbers shown before confirming are exactly what happens after.
  // A base target's own attack/defense/hp now live on the city object itself
  // (set at founding — see makeCity) rather than a single shared BASE_STATS,
  // since a native camp fights back much harder than an ordinary city.
  function previewCombat(attackerUnit, targetX, targetY) {
    var attType = UNIT_TYPES[attackerUnit.typeId];
    var targetUnit = unitAt(targetX, targetY);
    var targetBase = baseAt(targetX, targetY);
    // A player city's in-built coastal artillery only ever cares about
    // naval attackers: against one, the city fights back with a regular
    // artillery's attack (instead of its normal 0), but still takes normal
    // damage. Against a land attacker none of this applies.
    var innerArtilleryActive = !!(targetBase && targetBase.base.hasInnerArtillery && targetBase.base.alive
      && attType.category === "naval");
    var baseEffectiveAttack = targetBase ? (innerArtilleryActive ? UNIT_TYPES.artillery.attack : targetBase.base.attack) : 0;
    var defenderType = targetUnit ? UNIT_TYPES[targetUnit.typeId]
      : (targetBase ? { name: targetBase.base.isCamp ? NATIVE_CAMP_STATS.name : BASE_STATS.name, attack: baseEffectiveAttack, defense: targetBase.base.defense, hp: targetBase.base.maxHp, category: "base" } : BASE_STATS);
    var defenderTerrain = terrainAt(targetX, targetY);
    var attackerTerrain = terrainAt(attackerUnit.x, attackerUnit.y);
    var defBonus = defenseBonus(defenderTerrain) + (targetUnit ? dugInBonus(targetUnit) : 0);
    var attBonus = defenseBonus(attackerTerrain) + dugInBonus(attackerUnit);
    var dealt = computeDamage(attType, defenderType, defBonus, defenderTerrain);
    var outranged = attType.range > 1 && !(defenderType.range > 1) && Math.abs(attackerUnit.x - targetX) + Math.abs(attackerUnit.y - targetY) > 1;
    var taken = (defenderType.attack > 0 && !outranged) ? computeDamage(defenderType, attType, attBonus, attackerTerrain) : 0;
    return {
      attType: attType, defenderType: defenderType, targetUnit: targetUnit, targetBase: targetBase,
      defenderTerrain: defenderTerrain, attackerTerrain: attackerTerrain, defBonus: defBonus, attBonus: attBonus, dealt: dealt, taken: taken,
      innerArtilleryActive: innerArtilleryActive
    };
  }

  function resolveUnitAttackCore(attackerUnit, targetX, targetY) {
    var p = previewCombat(attackerUnit, targetX, targetY);
    var attType = p.attType, defenderType = p.defenderType, dmg = p.dealt;

    // One hit against any native unit or base provokes that camp against
    // the attacker (checked before hp changes, so it fires on a killing blow).
    if (p.targetUnit && p.targetUnit.owner === "natives" && p.targetUnit.campId) {
      provokeCamp(campById(p.targetUnit.campId), attackerUnit.owner);
    } else if (p.targetBase && p.targetBase.id === "natives") {
      provokeCamp(p.targetBase.base, attackerUnit.owner);
    }

    if (p.targetUnit) {
      var targetUnit = p.targetUnit;
      targetUnit.hp = Math.max(0, targetUnit.hp - dmg);
      var verb = attType.id === "harvester" ? " runs over " : " hits ";
      addLog(attType.name + " (" + attackerUnit.owner + ")" + verb + defenderType.name + " for " + dmg + ".");
      if (targetUnit.hp === 0) {
        addLog(defenderType.name + " (" + targetUnit.owner + ") destroyed.", false);
        if (targetUnit.cargo && targetUnit.cargo.length) {
          addLog(targetUnit.cargo.length + " unit(s) aboard were lost with the ship.", false);
          targetUnit.cargo = [];
        }
        removeUnit(targetUnit);
      } else if (defenderType.attack > 0) {
        var back = p.taken;
        attackerUnit.hp = Math.max(0, attackerUnit.hp - back);
        addLog(defenderType.name + " returns " + back + ".");
        if (attackerUnit.hp === 0) {
          addLog(attType.name + " (" + attackerUnit.owner + ") destroyed.", false);
          if (attackerUnit.cargo && attackerUnit.cargo.length) {
            addLog(attackerUnit.cargo.length + " unit(s) aboard were lost with the ship.", false);
            attackerUnit.cargo = [];
          }
          removeUnit(attackerUnit);
        }
      }
    } else if (p.targetBase) {
      var targetBase = p.targetBase;
      var label = cityLabel(targetBase.faction, targetBase.base);
      targetBase.base.hp = Math.max(0, targetBase.base.hp - dmg);
      addLog(attType.name + " (" + attackerUnit.owner + ") hits " + possessiveLabel(targetBase.id) + " " + label + " for " + dmg + " (" + targetBase.base.hp + "/" + targetBase.base.maxHp + ").");
      if (targetBase.base.hp === 0) {
        targetBase.base.alive = false;
        addLog(possessiveLabel(targetBase.id) + " " + label + " destroyed.", false);
        // The city's in-built coastal artillery only ever protected it
        // against naval fire — it can still be razed by land attackers, and
        // when it finally falls this way, that same artillery survives the
        // ruin as a standalone, ordinary Artillery unit (full HP, and no
        // longer naval-only — "goes back to normal" once the city breaks).
        if (targetBase.base.hasInnerArtillery && targetBase.id === "player" && !unitAt(targetBase.base.x, targetBase.base.y)) {
          var popArtillery = newUnit("artillery", "player", targetBase.base.x, targetBase.base.y);
          state.player.units.push(popArtillery);
          addLog("An Artillery emerges from the ruins of " + label + ".", false);
        }
        // Wiping out every native camp — or every hard-mode barbarian city —
        // is not a win/loss condition — only the player's and the AI's own
        // cities decide the game.
        if (targetBase.id !== "natives" && targetBase.id !== "barbarians" && targetBase.faction.bases.every(function (b) { return !b.alive; })) {
          // A native or a barbarian landing the finishing blow still needs to
          // resolve to a player/AI winner — neither "the natives win" nor
          // "the barbarians win" is a state the result screen has. A native
          // only ever destroys the player's last base while hunting the
          // player (an AI war pact), and only ever destroys the AI's last
          // base while hunting the AI (a player war pact, or being startled
          // into it) — atWarVsPlayer is what tells the two apart. A
          // barbarian is hostile to both sides equally, so whichever side
          // didn't just lose its last city is credited with the win.
          var raidWinner;
          if (attackerUnit.owner === "natives") raidWinner = targetBase.id === "player" ? "ai" : "player";
          else if (attackerUnit.owner === "barbarians") raidWinner = targetBase.id === "player" ? "ai" : "player";
          else raidWinner = attackerUnit.owner;
          endGame(raidWinner);
        }
      } else if (defenderType.attack > 0) {
        // A camp (or, in principle, any base with an attack stat) fights
        // back directly — mirrors the unit-vs-unit retaliation below.
        var backB = p.taken;
        attackerUnit.hp = Math.max(0, attackerUnit.hp - backB);
        addLog(label + " fights back for " + backB + ".");
        if (attackerUnit.hp === 0) {
          addLog(attType.name + " (" + attackerUnit.owner + ") destroyed.", false);
          if (attackerUnit.cargo && attackerUnit.cargo.length) {
            addLog(attackerUnit.cargo.length + " unit(s) aboard were lost with the ship.", false);
            attackerUnit.cargo = [];
          }
          removeUnit(attackerUnit);
        }
      }
    }
    // One-time use: a Missile that's still standing after its own strike
    // (i.e. it wasn't the one that just died to a counterattack above,
    // which already removed and logged it) is spent and disappears,
    // win or lose, hit a unit, a city, or a native — it doesn't stick
    // around to attack again.
    if (attType.oneTimeUse && attackerUnit.hp > 0) {
      addLog(attType.name + " (" + attackerUnit.owner + ") is spent after the strike and disappears.", false);
      removeUnit(attackerUnit);
    }
    attackerUnit.acted = true;
  }

  function removeUnit(u) {
    var f = factionOf(u.owner);
    f.units = f.units.filter(function (x) { return x.id !== u.id; });
  }

  // The real name of whoever ("You"/"The AI" or a hotseat human's own name)
  // is in the given slot right now — used for the handful of high-visibility
  // spots (victory/defeat screen, Hall of Fame, the pass-device prompt, the
  // HUD label) where showing "The AI" during a 2-human hotseat game would
  // be actively confusing. Most in-game log lines are left saying "You"/
  // "The AI" regardless — cosmetic, and correct in the moment they're
  // logged (see swapHotseatSeats), just stale if read back later.
  function sideName(id) {
    if (state.hotseat) {
      if (id === "player" && state.player.displayName) return state.player.displayName;
      if (id === "ai" && state.ai.displayName) return state.ai.displayName;
    }
    return id === "player" ? "You" : "The AI";
  }
  function ownerLabel(id) { return id === "player" ? "Your" : (id === "natives" ? "Native" : (id === "barbarians" ? "Barbarian" : "Enemy")); }
  function possessiveLabel(id) { return id === "natives" ? "natives'" : (id === "barbarians" ? "barbarians'" : id + "'s"); }
  // Short parenthetical for tooltips summarizing a camp's standing with
  // both sides at once, e.g. " (peace w/ you, war ally of the AI)".
  function campStatusSuffix(camp) {
    if (!camp) return "";
    var bits = [];
    if (camp.pact === "peace") bits.push("peace w/ you");
    if (camp.pact === "war") bits.push("war ally of yours");
    if (camp.aiPact === "peace") bits.push("peace w/ AI");
    if (camp.aiPact === "war") bits.push("war ally of the AI");
    if (camp.startledByAi) bits.push("hostile to AI");
    if (camp.startledByPlayer) bits.push("hostile to you");
    return bits.length ? " (" + bits.join(", ") + ")" : "";
  }

  function endGame(winnerId) {
    state.over = true;
    state.winner = winnerId;
    addLog(sideName(winnerId) + " win the war.", true);
  }

