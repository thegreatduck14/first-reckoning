  // ---------- ECONOMY / TURN TICK ----------
  function factionAlive(f) { return f.bases.some(function (b) { return b.alive; }); }

  function tickFaction(f) {
    if (!factionAlive(f)) return;
    var pb = productionBreakdown(f);
    // The difficulty multiplier is a bot-pacing lever only — never applied
    // to a real human, which in local hotseat is also whoever is currently
    // sitting in the "ai" slot.
    var mult = (f.id === "ai" && state.difficulty && !state.hotseat) ? (DIFFICULTY_AI_MULT[state.difficulty] || 1) : 1;
    var gained = Math.round(pb.total * mult);
    f.production += gained;
    statsOf(f).production += gained;
    statsOf(f).turns++;
    f.research += Math.round(1 * mult);

    if (f.techIndex < TECHS.length) {
      var t = TECHS[f.techIndex];
      // A playerOnly tech (currently just Guided Missiles) never completes
      // for anyone else — the AI's research simply stalls here forever
      // rather than advancing past it, so it never reaches, and never
      // builds, a unit meant to be exclusive to the player — except in local
      // hotseat, where the "ai" slot is also a real human and gets the same
      // access (per the multiplayer spec: other players can build it too).
      if ((!t.playerOnly || f.id === "player" || state.hotseat) && f.research >= t.cost) {
        f.techIndex += 1;
        t.unlocks.forEach(function (id) { if (f.unlocked.indexOf(id) === -1) f.unlocked.push(id); });
        addLog((f.id === "player" ? "You" : "The AI") + " completed " + t.name + ".");
      }
    }

    if (f.buildQueue.length) {
      var qitem = f.buildQueue[0];
      var qtype = queueItemType(qitem);
      if (f.production >= qtype.cost) {
        if (qitem.kind === "building") {
          f.production -= qtype.cost;
          if (f.buildings.indexOf(qitem.id) === -1) f.buildings.push(qitem.id);
          if (qtype.grantsUnlocks) {
            qtype.grantsUnlocks.forEach(function (id) { if (f.unlocked.indexOf(id) === -1) f.unlocked.push(id); });
          }
          addLog((f.id === "player" ? "You" : "The AI") + " completed the " + qtype.name + ".");
          f.buildQueue.shift();
        } else {
          // Naval units need an adjacent water spawn tile, land units an
          // adjacent land one — only deduct production and advance the
          // queue once a valid spot is actually found, so a built unit is
          // never silently lost (a real bug this fixes, not just new code).
          var domain = qtype.domain || "land";
          var spot = findSpawnTileForFaction(f, domain, qitem.cityId);
          if (spot) {
            f.production -= qtype.cost;
            f.units.push(newUnit(qitem.id, f.id, spot[0], spot[1]));
            addLog((f.id === "player" ? "You" : "The AI") + " built a " + qtype.name + ".");
            f.buildQueue.shift();
          }
        }
      }
    }

    f.units.forEach(function (u) {
      if (u.typeId === "builder") {
        var damagedCity = adjacentDamagedCity(u, f);
        if (damagedCity) {
          damagedCity.hp = Math.min(damagedCity.maxHp, damagedCity.hp + BUILDER_REPAIR_HP);
          if (damagedCity.hp === damagedCity.maxHp) {
            addLog((f.id === "player" ? "Your" : "The AI's") + " Builder finishes repairing " + cityLabel(f, damagedCity) + " (" + damagedCity.hp + "/" + damagedCity.maxHp + ").");
          } else {
            addLog((f.id === "player" ? "Your" : "The AI's") + " Builder repairs " + cityLabel(f, damagedCity) + " (" + damagedCity.hp + "/" + damagedCity.maxHp + ").");
          }
        }
      }
    });

    // Medics patch up every friendly unit standing next to them.
    f.units.forEach(function (m) {
      if (m.typeId !== "medic") return;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) {
        var pal = unitAt(m.x + d[0], m.y + d[1]);
        if (!pal || pal.owner !== f.id || pal.hp >= UNIT_TYPES[pal.typeId].hp) return;
        pal.hp = Math.min(UNIT_TYPES[pal.typeId].hp, pal.hp + MEDIC_HEAL_HP);
        addLog((f.id === "player" ? "Your" : "The AI's") + " Medic heals " + UNIT_TYPES[pal.typeId].name + " (" + pal.hp + "/" + UNIT_TYPES[pal.typeId].hp + ").");
      });
    });

    runAntiAirBattery(f);

    f.units.forEach(function (u) {
      u.dugAt = u.acted ? null : [u.x, u.y];
      u.acted = false;
    });
    return pb.total;
  }

  // Once a faction has built the Anti-Air Battery (faction-wide, like the
  // other buildings), every one of its living cities takes a free shot at
  // any enemy flying unit sitting adjacent to it, every turn. A one-time-use
  // flyer (currently just the Missile) is exempt — it's a guided munition,
  // not a loitering aircraft the battery can track and down, so no city's
  // Anti-Air Battery can stop one from reaching and striking its target.
  function runAntiAirBattery(f) {
    if (f.buildings.indexOf("antiAir") === -1) return;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    f.bases.forEach(function (b) {
      if (!b.alive) return;
      dirs.forEach(function (d) {
        var u = unitAt(b.x + d[0], b.y + d[1]);
        if (!u || u.owner === f.id || u.hp <= 0) return;
        var ut = UNIT_TYPES[u.typeId];
        if (ut.category !== "air" || ut.oneTimeUse) return;
        var hpBefore = u.hp;
        u.hp = Math.max(0, u.hp - ANTI_AIR_DAMAGE);
        statsOf(f).damageDealt += hpBefore - u.hp;
        if (isScored(u.owner)) statsOf(factionOf(u.owner)).damageTaken += hpBefore - u.hp;
        addLog((f.id === "player" ? "Your" : "The AI's") + " Anti-Air Battery at " + cityLabel(f, b) +
          " hits " + ut.name + " (" + u.owner + ") for " + ANTI_AIR_DAMAGE + " (" + u.hp + "/" + ut.hp + ").");
        if (u.hp === 0) {
          addLog(ut.name + " (" + u.owner + ") shot down.", false);
          statsOf(f).unitsKilled++;
          if (isScored(u.owner)) statsOf(factionOf(u.owner)).unitsLost++;
          removeUnit(u);
        }
      });
    });
  }

  function adjacentDamagedCity(u, f) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var b = baseAt(u.x + dirs[i][0], u.y + dirs[i][1]);
      if (b && b.id === f.id && b.base.alive && b.base.hp < b.base.maxHp) return b.base;
    }
    return null;
  }

  function findSpawnTile(bx, by, domain) {
    var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (var i = 0; i < dirs.length; i++) {
      var nx = bx + dirs[i][0], ny = by + dirs[i][1];
      if (!inBounds(nx, ny) || unitAt(nx, ny) || baseAt(nx, ny)) continue;
      var isWater = terrainAt(nx, ny) === "water";
      if (domain === "naval" ? isWater : !isWater) return [nx, ny];
    }
    return null;
  }

  // Tries the city the unit was actually queued at first (if given and
  // still alive/has room), then falls back to the capital, then each
  // later-founded city in order, for an open adjacent tile (matching the
  // unit's domain) to spawn a newly built unit on.
  function findSpawnTileForFaction(f, domain, preferredCityId) {
    if (preferredCityId) {
      var preferred = findCityById(f, preferredCityId);
      if (preferred && preferred.alive) {
        var pSpot = findSpawnTile(preferred.x, preferred.y, domain);
        if (pSpot) return pSpot;
      }
    }
    for (var i = 0; i < f.bases.length; i++) {
      if (!f.bases[i].alive) continue;
      if (preferredCityId && f.bases[i].id === preferredCityId) continue; // already tried above
      var spot = findSpawnTile(f.bases[i].x, f.bases[i].y, domain);
      if (spot) return spot;
    }
    return null;
  }

