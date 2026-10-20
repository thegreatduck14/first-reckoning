  // ---------- END-OF-GAME SCORE ----------
  // Every player/AI faction carries a `stats` tally that the engine updates as
  // things actually happen (attacks, kills, cities, production). When the game
  // ends, scoreFor() turns that tally into a 0-100 score with a line-by-line
  // breakdown, so the percentage can always be explained from real numbers.
  var SCORE_BENCH_PRODUCTION = 12;   // production/turn that earns full economy points
  var SCORE_FAST_WIN_TURN = 40;      // winning by this turn earns full speed points
  var SCORE_SLOW_WIN_TURN = 150;     // winning at or after this turn earns none
  var SCORE_FULL_EXPANSION = 3;      // extra cities for full expansion points

  function newStats() {
    return {
      attacks: 0, damageDealt: 0, damageTaken: 0, unitsKilled: 0, unitsLost: 0,
      citiesOwned: 0, citiesLost: 0, citiesDestroyed: 0, campsDestroyed: 0,
      production: 0, turns: 0, partial: false
    };
  }
  // Saves from before scoring existed have no tally; start one and flag it so
  // the breakdown can say the early game wasn't recorded.
  function statsOf(f) {
    if (!f.stats) {
      f.stats = newStats();
      f.stats.partial = true;
      f.stats.citiesOwned = f.bases.length;
      f.stats.turns = state ? Math.max(0, state.turn - 1) : 0;
    }
    return f.stats;
  }
  function isScored(ownerId) { return ownerId === "player" || ownerId === "ai"; }

  // Wraps the combat engine: snapshots hp before, diffs after, and credits
  // both sides (a native or barbarian on either end simply isn't scored).
  function resolveUnitAttack(attacker, x, y) {
    var tu = unitAt(x, y), tb = baseAt(x, y);
    var defOwner = tu ? tu.owner : (tb ? tb.id : null);
    var aHp0 = attacker.hp, aCargo = attacker.cargo ? attacker.cargo.length : 0;
    var tHp0 = tu ? tu.hp : (tb ? tb.base.hp : 0), tCargo = tu && tu.cargo ? tu.cargo.length : 0;
    resolveUnitAttackCore(attacker, x, y);
    var dealt = tHp0 - (tu ? tu.hp : (tb ? tb.base.hp : 0));
    var taken = aHp0 - attacker.hp;
    var attackerDied = attacker.hp <= 0;
    var targetDied = tu ? tu.hp <= 0 : false;
    var baseDied = tb ? !tb.base.alive : false;

    if (isScored(attacker.owner)) {
      var sa = statsOf(factionOf(attacker.owner));
      sa.attacks++;
      sa.damageDealt += dealt; sa.damageTaken += taken;
      if (targetDied) sa.unitsKilled += 1 + tCargo;
      if (baseDied) {
        if (defOwner === "natives") sa.campsDestroyed++;
        else if (defOwner !== "barbarians") sa.citiesDestroyed++;
      }
      if (attackerDied) sa.unitsLost += 1 + aCargo;
    }
    if (isScored(defOwner) && defOwner !== attacker.owner) {
      var sd = statsOf(factionOf(defOwner));
      sd.damageTaken += dealt; sd.damageDealt += taken;
      if (targetDied) sd.unitsLost += 1 + tCargo;
      if (baseDied) sd.citiesLost++;
      if (attackerDied) sd.unitsKilled += 1 + aCargo;
    }
  }

  function scoreFor(sideId) {
    var f = factionOf(sideId);
    var foeId = sideId === "player" ? "ai" : "player";
    var s = statsOf(f), foe = statsOf(factionOf(foeId));
    var won = state.winner === sideId;
    var turns = Math.max(1, state.turn);
    var rows = [];
    function add(label, got, max, detail) { rows.push({ label: label, got: got, max: max, detail: detail }); }

    add("Outcome", won ? 30 : 0, 30, won ? "Won the war on turn " + turns + "." : "Lost the war on turn " + turns + ".");

    var traded = s.damageDealt + s.damageTaken;
    add("Combat", traded ? 20 * s.damageDealt / traded : 0, 20,
      s.attacks || s.damageTaken
        ? "Dealt " + s.damageDealt + " damage and took " + s.damageTaken + " (" + s.attacks + " attacks by you). Destroyed " + s.unitsKilled + " enemy units, lost " + s.unitsLost + " of yours."
        : "No fighting took place.");

    var foeCities = Math.max(1, foe.citiesOwned);
    add("Conquest", 15 * Math.min(1, s.citiesDestroyed / foeCities), 15,
      "Destroyed " + s.citiesDestroyed + " of the enemy's " + foe.citiesOwned + " cit" + (foe.citiesOwned === 1 ? "y" : "ies") + (s.campsDestroyed ? " (plus " + s.campsDestroyed + " native camp" + (s.campsDestroyed > 1 ? "s" : "") + ", which don't count)" : "") + ".");

    var owned = Math.max(1, s.citiesOwned);
    add("Defense", 10 * Math.max(0, owned - s.citiesLost) / owned, 10,
      "Kept " + Math.max(0, owned - s.citiesLost) + " of the " + owned + " cit" + (owned === 1 ? "y" : "ies") + " you owned (" + s.citiesLost + " lost).");

    var avgProd = s.production / Math.max(1, s.turns);
    var founded = Math.max(0, s.citiesOwned - 1);
    add("Economy", 10 * Math.min(1, avgProd / SCORE_BENCH_PRODUCTION) + 5 * Math.min(SCORE_FULL_EXPANSION, founded) / SCORE_FULL_EXPANSION, 15,
      "Averaged " + avgProd.toFixed(1) + " production per turn over " + s.turns + " turns (" + SCORE_BENCH_PRODUCTION + " earns full marks) and founded " + founded + " extra cit" + (founded === 1 ? "y" : "ies") + " (" + SCORE_FULL_EXPANSION + " earns full marks).");

    add("Research", 5 * f.techIndex / TECHS.length, 5, "Completed " + f.techIndex + " of " + TECHS.length + " research tiers.");

    var speed = won ? Math.max(0, Math.min(1, (SCORE_SLOW_WIN_TURN - turns) / (SCORE_SLOW_WIN_TURN - SCORE_FAST_WIN_TURN))) : 0;
    add("Speed", 5 * speed, 5, won
      ? "Won on turn " + turns + " (full marks by turn " + SCORE_FAST_WIN_TURN + ", none from turn " + SCORE_SLOW_WIN_TURN + ")."
      : "Only awarded for a win.");

    var total = rows.reduce(function (n, r) { return n + r.got; }, 0);
    return { total: Math.round(total), rows: rows, partial: !!s.partial };
  }

  function renderScore() {
    var sideId = state.hotseat ? state.winner : "player";
    var sc = scoreFor(sideId);
    el.scorePct.textContent = sc.total + "%";
    el.scoreBarFill.style.width = sc.total + "%";
    var who = state.hotseat ? sideName(sideId) + "'s score" : "Your score";
    el.scoreTitle.textContent = who + ": " + sc.total + " / 100";
    el.scoreRows.innerHTML = sc.rows.map(function (r) {
      return '<div class="score-row"><div class="score-row-head"><span>' + r.label + '</span><span>' +
        (Math.round(r.got * 10) / 10) + ' / ' + r.max + '</span></div><div class="score-row-detail">' + r.detail + '</div></div>';
    }).join("") + (sc.partial ? '<div class="score-row-detail">Note: this save was made before scoring existed, so earlier fighting and building were not recorded.</div>' : "");
  }

  el.scoreWhyBtn.addEventListener("click", function () {
    el.scoreDetail.hidden = !el.scoreDetail.hidden;
  });
