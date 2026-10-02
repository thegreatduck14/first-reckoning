  // ---------- STATE ----------
  var state = null;

  function key(x, y) { return x + "," + y; }
  function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }
  function isResourceTile(x, y) { return inBounds(x, y) && RESOURCE_GRID[y][x]; }

  function cityLabel(faction, cityObj) {
    var idx = faction.bases.indexOf(cityObj);
    if (cityObj.isCamp) return "Camp " + (idx + 1);
    if (cityObj.isBarbarianCity) return "Barbarian City " + (idx + 1);
    return idx <= 0 ? "Capital" : "City " + (idx + 1);
  }
  function findCityById(faction, id) {
    for (var i = 0; i < faction.bases.length; i++) if (faction.bases[i].id === id) return faction.bases[i];
    return null;
  }
  // kind switches a founded base over to tougher/frailer stats instead of
  // the ordinary player/AI base stats (attack 0 / defense 5): "camp" for a
  // native camp (a camp fights back on its own, a city doesn't), "barbarian"
  // for a hard-mode barbarian city (much lower HP, otherwise ordinary).
  function makeCity(x, y, kind, hasInnerArtillery) {
    var st = kind === "camp" ? NATIVE_CAMP_STATS : (kind === "barbarian" ? BARBARIAN_CITY_STATS : BASE_STATS);
    // pact / aiPact: null (unmet), "peace" (that side's Scout won't be able
    // to attack this camp), or "war" (peace, plus the camp's garrison
    // actively fights the OTHER side) — set only by a Scout negotiating
    // with the camp, player-side or AI-side respectively.
    // startledByAi: true once the AI has landed at least one hit on this
    // camp or its garrison without a war pact — a purely defensive
    // hostility, independent of any negotiated pact.
    // hasInnerArtillery: every player city (the starting capital included)
    // is built with an in-built coastal artillery — see previewCombat and
    // resolveUnitAttack for what it actually does in combat.
    return {
      id: "c" + (state.nextCityId++), x: x, y: y, hp: st.hp, maxHp: st.hp, attack: st.attack, defense: st.defense,
      alive: true, isCamp: kind === "camp", isBarbarianCity: kind === "barbarian",
      pact: null, aiPact: null, startledByAi: false, hasInnerArtillery: !!hasInnerArtillery
    };
  }
  function foundCity(f, x, y, kind) {
    // Only the player's own ordinary cities (never AI cities, never native
    // camps, never barbarian cities) are built with the in-built coastal
    // artillery — except in local hotseat, where the "ai" slot is also a
    // real human and gets the same bonus, or one of the two humans would
    // have a permanent, unearned defensive edge over the other.
    var c = makeCity(x, y, kind, (f.id === "player" || state.hotseat) && !kind);
    f.bases.push(c);
    return c;
  }
  function isValidCitySite(x, y) {
    var terrain = terrainAt(x, y);
    if (terrain === "water" || terrain === "mountain") return false;
    var all = state.player.bases.concat(state.ai.bases)
      .concat(state.natives ? state.natives.bases : [])
      .concat(state.barbarians ? state.barbarians.bases : []);
    for (var i = 0; i < all.length; i++) {
      if (all[i].alive && chebyshev([x, y], [all[i].x, all[i].y]) < MIN_CITY_DISTANCE) return false;
    }
    return true;
  }

  function makeFaction(id, isAI) {
    // The AI's colonizing unit is a distinct type (aiSettler) so it can carry
    // slightly weaker stats than the player's Settler while sharing all the
    // same founding logic.
    var unlocked = STARTING_UNLOCKS.map(function (u) { return (isAI && u === "settler") ? "aiSettler" : u; });
    return {
      id: id, isAI: isAI, bases: [],
      units: [], production: 0, research: 0, unlocked: unlocked,
      techIndex: 0, buildQueue: [], buildings: [],
      // Only ever set for a local-hotseat human seat (see startHotseatGame) —
      // lives on the faction object itself so it travels automatically with
      // whichever human owns this data when swapHotseatSeats swaps who's
      // sitting in the "player" vs "ai" slot.
      displayName: null
    };
  }

  // The natives are a third, neutral, non-playable faction: no production,
  // research, tech, or build queue, because they never build anything —
  // their camps and garrisons are placed once at map generation and that's
  // it (see placeNativeCamps). They never take a turn of their own; they
  // only ever fight back when something attacks them.
  function makeNativesFaction() {
    return { id: "natives", isAI: false, bases: [], units: [], production: 0, research: 0, unlocked: [], techIndex: 0, buildQueue: [], buildings: [] };
  }

  // The barbarians are a fifth-wheel, fully hostile faction: no cities, no
  // production, no tech — they only ever exist as raiding units placed by
  // maybeSpawnBarbarians, and they act each turn via runBarbarianTurn. Kept
  // shaped like makeNativesFaction so the many generic faction-shaped helpers
  // (factionOf, unitAt, removeUnit, etc.) work on them without special-casing.
  function makeBarbariansFaction() {
    return { id: "barbarians", isAI: false, bases: [], units: [], production: 0, research: 0, unlocked: [], techIndex: 0, buildQueue: [], buildings: [] };
  }

  // Scatters up to NATIVE_CAMP_MAX native camps across whatever open,
  // non-mountain land is left once the player's and AI's capitals exist —
  // reuses isValidCitySite's own distance rule so camps never crowd a city
  // (or each other), and never founds more once placed: natives can't
  // found new camps. Each camp gets a small, randomly-tiered garrison drawn
  // from NATIVE_GARRISON_POOL, so most are lightly held but a few pack a
  // Rocket Tube Brave, a mounted rider, or an Indian in Tank.
  function placeNativeCamps(natives) {
    var candidates = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (isValidCitySite(x, y) && !unitAt(x, y) && !baseAt(x, y)) candidates.push([x, y]);
      }
    }
    candidates = shuffled(candidates);
    var target = Math.min(NATIVE_CAMP_MAX, candidates.length, 3 + Math.floor(Math.random() * 4));
    for (var i = 0; i < target; i++) {
      var spot = candidates[i];
      // isValidCitySite was evaluated before this loop, so re-check against
      // camps placed earlier in this same loop (their distance now matters
      // too) before committing this one.
      if (!isValidCitySite(spot[0], spot[1])) continue;
      var camp = foundCity(natives, spot[0], spot[1], "camp");
      var garrisonSize = 1 + (Math.random() < 0.5 ? 1 : 0);
      for (var g = 0; g < garrisonSize; g++) {
        var spawn = findSpawnTile(spot[0], spot[1], "land");
        if (!spawn) break;
        var pick = NATIVE_GARRISON_POOL[Math.floor(Math.random() * NATIVE_GARRISON_POOL.length)];
        var garrisonUnit = newUnit(pick, "natives", spawn[0], spawn[1]);
        // Ties this unit back to its camp, so negotiating peace or a war
        // plan with the camp (see askForPeace/proposeWarPlan) covers its
        // garrison too.
        garrisonUnit.campId = camp.id;
        garrisonUnit.atWar = false;
        natives.units.push(garrisonUnit);
      }
      // A coastal camp has even odds of also crewing a Trireme — same
      // campId as the land garrison, so it's covered by the same peace/war
      // pact and counts toward the same startled-into-war hostility.
      if (isCoastal(camp) && Math.random() < 0.5) {
        var boatSpawn = findSpawnTile(spot[0], spot[1], "naval");
        if (boatSpawn) {
          var boatUnit = newUnit("trireme", "natives", boatSpawn[0], boatSpawn[1]);
          boatUnit.campId = camp.id;
          boatUnit.atWar = false;
          natives.units.push(boatUnit);
        }
      }
    }
  }

  // Hard mode only: gives the barbarians 1-2 actual cities of their own, so
  // they can run a (deliberately weak and slow) economy alongside the
  // periodic raiding parties every difficulty gets from maybeSpawnBarbarians.
  // Never called for Baby Mode or Medium — see newGame.
  function placeBarbarianCities() {
    var candidates = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (isValidCitySite(x, y) && !unitAt(x, y) && !baseAt(x, y)) candidates.push([x, y]);
      }
    }
    candidates = shuffled(candidates);
    var target = Math.min(BARBARIAN_CITY_MAX, candidates.length, 1 + Math.floor(Math.random() * BARBARIAN_CITY_MAX));
    for (var i = 0; i < target; i++) {
      var spot = candidates[i];
      // Re-check against any barbarian city already placed earlier in this
      // same loop, exactly like placeNativeCamps does for camps.
      if (!isValidCitySite(spot[0], spot[1])) continue;
      foundCity(state.barbarians, spot[0], spot[1], "barbarian");
    }
  }

