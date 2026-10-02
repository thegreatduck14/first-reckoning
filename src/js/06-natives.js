  // ---------- NATIVE DIPLOMACY ----------
  // A Scout — the player's or the AI's — standing next to a still-unmet
  // camp can ask for peace (free — the camp and its garrison stop being
  // valid targets for that side) or propose a war plan against the OTHER
  // side (costs one weak unit as tribute from whichever side is asking, but
  // the camp's garrison then actively fights that side's enemy for them).
  // A camp can only ever be allied with one side's war plan at a time —
  // negotiatingSide() below is what enforces that.
  var TRIBUTE_ELIGIBLE = ["lightInfantry", "antiArmorInfantry"]; // "an infantry unit or something weak" — never a ship

  function campById(id) {
    for (var i = 0; i < state.natives.bases.length; i++) {
      if (state.natives.bases[i].id === id) return state.natives.bases[i];
    }
    return null;
  }
  function isAtPeaceWithPlayer(campId) {
    var c = campById(campId);
    return !!c && !!c.pact;
  }
  // Symmetric to isAtPeaceWithPlayer, but for the AI — used to keep the AI
  // from targeting a camp it's made peace (or a war pact) with.
  function isAtPeaceWithAi(campId) {
    var c = campById(campId);
    return !!c && !!c.aiPact;
  }
  // A camp that already has a live war pact with one side, or that's been
  // startled into defensive hostility against the AI, won't hear out the
  // other side's Scout at all.
  function campWillNegotiateWith(camp, side) {
    if (side === "player") return camp.aiPact !== "war";
    return camp.pact !== "war" && !camp.startledByAi;
  }
  // The living native camp (if any) adjacent to a unit's own tile.
  function adjacentNativeCamp(u) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var b = baseAt(u.x + dirs[i][0], u.y + dirs[i][1]);
      if (b && b.id === "natives" && b.base.alive) return b.base;
    }
    return null;
  }
  function findTributeUnit(f) {
    for (var i = 0; i < f.units.length; i++) {
      if (TRIBUTE_ELIGIBLE.indexOf(f.units[i].typeId) !== -1) return f.units[i];
    }
    return null;
  }
  function campGarrison(camp) {
    return state.natives.units.filter(function (u) { return u.campId === camp.id; });
  }
  function askForPeace(scoutUnit, camp) {
    if (camp.pact || !campWillNegotiateWith(camp, "player")) return;
    camp.pact = "peace";
    addLog("You make peace with the natives' " + cityLabel(state.natives, camp) + ".");
    scoutUnit.acted = true;
    state.selectedUnitId = null;
  }
  function proposeWarPlan(scoutUnit, camp) {
    if (camp.pact === "war" || !campWillNegotiateWith(camp, "player")) return;
    var tribute = findTributeUnit(state.player);
    if (!tribute) {
      addLog("No weak unit (Infantry) available to offer as tribute.");
      return;
    }
    removeUnit(tribute);
    camp.pact = "war";
    campGarrison(camp).forEach(function (u) { u.atWar = true; });
    addLog("You strike a war plan with the natives' " + cityLabel(state.natives, camp) + " against the AI, handing over a " + UNIT_TYPES[tribute.typeId].name + " as tribute.");
    scoutUnit.acted = true;
    state.selectedUnitId = null;
  }
  // AI-side mirrors of askForPeace/proposeWarPlan. No UI to drive them —
  // called from runAiTurn against the AI's own Scout(s).
  function aiAskForPeace(scoutUnit, camp) {
    if (camp.aiPact || !campWillNegotiateWith(camp, "ai")) return false;
    camp.aiPact = "peace";
    addLog("The AI makes peace with the natives' " + cityLabel(state.natives, camp) + ".");
    scoutUnit.acted = true;
    return true;
  }
  function aiProposeWarPlan(scoutUnit, camp) {
    if (camp.aiPact === "war" || !campWillNegotiateWith(camp, "ai")) return false;
    var tribute = findTributeUnit(state.ai);
    if (!tribute) return false;
    removeUnit(tribute);
    camp.aiPact = "war";
    campGarrison(camp).forEach(function (u) { u.atWarVsPlayer = true; });
    addLog("The AI strikes a war plan with the natives' " + cityLabel(state.natives, camp) + " against you, handing over a " + UNIT_TYPES[tribute.typeId].name + " as tribute.");
    scoutUnit.acted = true;
    return true;
  }
  // Called whenever the AI's attack actually lands on a native unit or base
  // that hadn't already allied with the AI — one hit is enough to startle
  // that camp's whole garrison into permanent defensive hostility against
  // the AI, independent of any negotiated pact.
  function startleCampAgainstAi(camp) {
    if (!camp || camp.startledByAi || camp.aiPact === "war") return;
    camp.startledByAi = true;
    addLog("The natives' " + cityLabel(state.natives, camp) + " are startled into war against the AI.");
  }

  // Nearest living camp the AI hasn't yet settled anything with — used to
  // give the AI's Scout somewhere to actually walk toward, the same way a
  // player would explore toward one.
  function nearestUnnegotiatedCampForAi(u) {
    var best = null, bestD = Infinity;
    state.natives.bases.forEach(function (c) {
      if (!c.alive || c.aiPact !== null || !campWillNegotiateWith(c, "ai")) return;
      var d = Math.abs(c.x - u.x) + Math.abs(c.y - u.y);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

  function nearestFactionTarget(u, factionId) {
    var f = factionOf(factionId);
    var candidates = f.units.map(function (e) { return [e.x, e.y]; });
    f.bases.forEach(function (b) { if (b.alive) candidates.push([b.x, b.y]); });
    var best = null, bestD = Infinity;
    candidates.forEach(function (c) {
      var d = Math.abs(c[0] - u.x) + Math.abs(c[1] - u.y);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

  // A garrison unit acts on its own only once its camp has a live reason to
  // fight someone: a player-struck war pact or AI-startled hostility means
  // it hunts the AI; an AI-struck war pact means it hunts the player.
  // Peace-only and fully un-negotiated natives stay passive, as before.
  function runNativesTurn() {
    state.natives.units.forEach(function (u) { u.acted = false; });
    state.natives.units.slice().forEach(function (u) {
      if (u.hp <= 0) return;
      var camp = u.campId ? campById(u.campId) : null;
      var huntsAi = u.atWar || (camp && camp.startledByAi);
      var huntsPlayer = !!u.atWarVsPlayer;
      if (!huntsAi && !huntsPlayer) return;
      // A unit hostile to both sides at once (theoretically possible only
      // if it were startled while also AI-war-pacted, which
      // campWillNegotiateWith prevents) prefers whichever enemy is closer.
      var targetFactionId = huntsAi && huntsPlayer
        ? (function () {
            var da = nearestFactionTarget(u, "ai");
            var dp = nearestFactionTarget(u, "player");
            if (!da) return "player";
            if (!dp) return "ai";
            var distTo = function (t) { return Math.abs(t[0] - u.x) + Math.abs(t[1] - u.y); };
            return distTo(da) <= distTo(dp) ? "ai" : "player";
          })()
        : (huntsAi ? "ai" : "player");

      var reachable = reachableTiles(u);
      var attackable = attackableTiles(u, reachable).filter(function (t) {
        var eu = unitAt(t[0], t[1]);
        var eb = baseAt(t[0], t[1]);
        return (eu && eu.owner === targetFactionId) || (eb && eb.id === targetFactionId);
      });
      if (attackable.length) {
        var t = pickWeakestTarget(attackable);
        resolveUnitAttack(u, t[0], t[1]);
        return;
      }
      var target = nearestFactionTarget(u, targetFactionId);
      if (target) moveToward(u, target[0], target[1]);
      u.acted = true;
    });
  }

