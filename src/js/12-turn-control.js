  // ---------- TURN CONTROL ----------
  var queueBtn = document.createElement("button");
  queueBtn.className = "wide";
  queueBtn.textContent = "Queue Unit";
  queueBtn.style.marginTop = "4px";
  el.buildSelect.insertAdjacentElement("afterend", queueBtn);
  queueBtn.addEventListener("click", function () {
    var raw = el.buildSelect.value;
    if (!raw) return;
    var parts = raw.split(":");
    var item = { kind: parts[0], id: parts[1] };
    // A unit remembers which city was selected when it was queued, so it
    // spawns near that city specifically rather than always defaulting to
    // the capital — buildings aren't tied to a spawn location, so this only
    // applies to units.
    if (item.kind === "unit" && state.selectedBaseId && findCityById(state.player, state.selectedBaseId)) {
      item.cityId = state.selectedBaseId;
    }
    state.player.buildQueue.push(item);
    renderBuildPanel();
    if (!el.cityOverlay.hidden) renderCityView();
  });

  el.endTurnBtn.addEventListener("click", function () {
    if (state.over) return;
    clearHint();
    state.selectedUnitId = null;
    state.selectedBaseId = null;
    state.pendingDisembark = null;

    // Local hotseat: the first of the two humans ending their turn only
    // ticks their own economy, then hands off to the other human — the
    // shared, no-one-in-particular end-of-round processing below (natives,
    // barbarians, the turn counter) waits until the second human has also
    // had their turn.
    if (state.hotseat && !state.hotseatSecondTurn) {
      tickFaction(state.player);
      if (state.over) { render(); return; }
      state.hotseatSecondTurn = true;
      swapHotseatSeats();
      render();
      showPassDevice(state.player.displayName);
      return;
    }

    tickFaction(state.player);
    if (state.over) { render(); return; }
    if (!state.hotseat) {
      tickFaction(state.ai);
      if (state.over) { render(); return; }

      runAiTurn();
      if (state.over) { render(); return; }
    }

    runNativesTurn();
    if (state.over) { render(); return; }

    tickBarbarianEconomy();
    if (state.over) { render(); return; }

    runBarbarianTurn();
    if (state.over) { render(); return; }

    if (state.hotseat) {
      state.hotseatSecondTurn = false;
      swapHotseatSeats();
    }

    state.turn += 1;
    addLog("Turn " + state.turn + " begins.");
    maybeSpawnBarbarians();
    render();
    // The round-end swap hands control back to the first human, so they
    // need the same cover screen the mid-round handoff gets — otherwise the
    // second player is left looking at the first player's board.
    if (state.hotseat && !state.over) showPassDevice(state.player.displayName);
  });

  el.restartBtn.addEventListener("click", function () {
    if (state.hotseat) {
      // Re-use the same two names rather than dropping back to a
      // single-player game on "Play Again".
      startHotseatGame(state.player.displayName, state.ai.displayName, state.difficulty);
      beginPlay();
    } else {
      startNewGame(state.difficulty);
    }
  });
  el.resultMenuBtn.addEventListener("click", function () { showHome(); });

  el.homePlayBtn.addEventListener("click", showDifficulty);
  el.homeLoadBtn.addEventListener("click", showLoadGame);
  el.homeHowToBtn.addEventListener("click", showHowToPlay);
  el.homeHofBtn.addEventListener("click", showHallOfFame);
  el.homeMpBtn.addEventListener("click", showMultiplayer);

  el.mpBackBtn.addEventListener("click", showHome);
  function startHotseatFromForm(difficulty) {
    startHotseatGame(el.mpName1Input.value, el.mpName2Input.value, difficulty);
    beginPlay();
  }
  el.mpDiffBabyBtn.addEventListener("click", function () { startHotseatFromForm("baby"); });
  el.mpDiffMediumBtn.addEventListener("click", function () { startHotseatFromForm("medium"); });
  el.mpDiffHardBtn.addEventListener("click", function () { startHotseatFromForm("hard"); });

  el.passDeviceBtn.addEventListener("click", function () {
    el.passDeviceOverlay.hidden = true;
  });

  el.confirmOkBtn.addEventListener("click", function () {
    var fn = pendingConfirm;
    closeConfirm();
    if (fn) fn();
  });
  el.confirmCancelBtn.addEventListener("click", closeConfirm);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !el.confirmOverlay.hidden) closeConfirm();
  });

  el.importSaveBtn.addEventListener("click", function () { el.importSaveInput.click(); });
  el.importSaveInput.addEventListener("change", function () {
    var file = el.importSaveInput.files && el.importSaveInput.files[0];
    el.importSaveInput.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var result = importSaveText(String(reader.result));
      if (result.error) { showToast("Import failed: " + result.error, true); return; }
      renderSlotList(el.loadSlotList, "load");
      showToast("Imported into Slot " + (result.slot + 1) + ".");
    };
    reader.onerror = function () { showToast("Couldn't read that file.", true); };
    reader.readAsText(file);
  });

  el.diffBabyBtn.addEventListener("click", function () { startNewGame("baby"); });
  el.diffMediumBtn.addEventListener("click", function () { startNewGame("medium"); });
  el.diffHardBtn.addEventListener("click", function () { startNewGame("hard"); });
  el.diffBackBtn.addEventListener("click", showHome);

  el.loadBackBtn.addEventListener("click", showHome);
  el.howToBackBtn.addEventListener("click", showHome);
  el.hofBackBtn.addEventListener("click", showHome);
  el.saveBackBtn.addEventListener("click", function () {
    hideAllMenus();
    el.gameScreen.hidden = false;
  });

  el.saveIconBtn.addEventListener("click", showSaveGame);
  el.menuIconBtn.addEventListener("click", showHome);

  // Enter also ends the turn, as long as a game is actually in progress and
  // no overlay (combat analysis, base view, a menu screen, etc.) is open —
  // otherwise Enter would silently end your turn out from under a dialog.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    if (!state || state.over) return;
    if (el.gameScreen.hidden) return;
    if (!el.combatOverlay.hidden || !el.cityOverlay.hidden || !el.resultOverlay.hidden ||
        !el.homeOverlay.hidden || !el.difficultyOverlay.hidden || !el.loadOverlay.hidden ||
        !el.saveOverlay.hidden || !el.howToPlayOverlay.hidden || !el.hallOfFameOverlay.hidden ||
        !el.multiplayerOverlay.hidden || !el.passDeviceOverlay.hidden || !el.confirmOverlay.hidden) return;
    e.preventDefault();
    el.endTurnBtn.click();
  });

  el.combatConfirmBtn.addEventListener("click", function () {
    if (!pendingAttack) return;
    var attacker = null;
    var all = state.player.units.concat(state.ai.units);
    for (var i = 0; i < all.length; i++) if (all[i].id === pendingAttack.unitId) attacker = all[i];
    var tx = pendingAttack.x, ty = pendingAttack.y;
    closeCombatAnalysis();
    if (attacker) resolveUnitAttack(attacker, tx, ty);
    state.selectedUnitId = null;
    render();
  });
  el.combatCancelBtn.addEventListener("click", function () {
    closeCombatAnalysis();
    render();
  });

  el.cityCloseBtn.addEventListener("click", closeCityView);

  // Test hook: the jsdom tests in test/ set window.__FR_TEST__ before the
  // page runs to reach engine internals. Never present in a real browser.
  if (window.__FR_TEST__) {
    window.__FR_TEST__.game = {
      get state() { return state; },
      set state(s) { state = s; },
      el: el, newGame: newGame, startHotseatGame: startHotseatGame, render: render,
      saveGameToSlot: saveGameToSlot, loadGameFromSlot: loadGameFromSlot, loadSaveSlots: loadSaveSlots,
      exportSlotText: exportSlotText, importSaveText: importSaveText, migrateSave: migrateSave,
      runAiTurn: runAiTurn, tickFaction: tickFaction, newUnit: newUnit, unitAt: unitAt, baseAt: baseAt,
      terrainAt: terrainAt, previewCombat: previewCombat, UNIT_TYPES: UNIT_TYPES, LS_SAVES_KEY: LS_SAVES_KEY, SAVE_VERSION: SAVE_VERSION,
      aiBestAttack: aiBestAttack, resolveUnitAttack: resolveUnitAttack, attackableTiles: attackableTiles, reachableTiles: reachableTiles, islandIdAt: islandIdAt,
      updateFogOfWar: updateFogOfWar, COLS: COLS, ROWS: ROWS
    };
  }

  showHome();
