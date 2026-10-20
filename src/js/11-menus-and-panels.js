  // ---------- MENU / HOME SCREEN NAVIGATION ----------
  function hideAllMenus() {
    el.homeOverlay.hidden = true;
    el.difficultyOverlay.hidden = true;
    el.loadOverlay.hidden = true;
    el.saveOverlay.hidden = true;
    el.howToPlayOverlay.hidden = true;
    el.hallOfFameOverlay.hidden = true;
    el.multiplayerOverlay.hidden = true;
  }
  function showHome() {
    clearHint();
    el.gameScreen.hidden = true;
    document.body.classList.remove("playing");
    hideAllMenus();
    el.homeOverlay.hidden = false;
  }
  function showDifficulty() {
    hideAllMenus();
    el.difficultyOverlay.hidden = false;
  }
  function showHowToPlay() {
    hideAllMenus();
    el.howToPlayOverlay.hidden = false;
  }
  function showHallOfFame() {
    hideAllMenus();
    renderHallOfFameList();
    el.hallOfFameOverlay.hidden = false;
  }
  function showMultiplayer() {
    hideAllMenus();
    el.multiplayerOverlay.hidden = false;
  }
  // Shown between the two humans' sub-turns in local hotseat (see the End
  // Turn handler) — covers the board so the next player's info isn't on
  // screen before they've actually picked up the device.
  function showPassDevice(name) {
    el.passDeviceTitle.textContent = name + "'s turn";
    el.passDeviceBody.textContent = "Hand the device to " + name + ", then tap Start Turn.";
    el.passDeviceOverlay.hidden = false;
  }
  function showLoadGame() {
    hideAllMenus();
    renderSlotList(el.loadSlotList, "load");
    el.loadOverlay.hidden = false;
  }
  function showSaveGame() {
    hideAllMenus();
    renderSlotList(el.saveSlotList, "save");
    el.saveOverlay.hidden = false;
  }
  function beginPlay() {
    setBoardCssVars();
    hideAllMenus();
    el.gameScreen.hidden = false;
    document.body.classList.add("playing");
    render();
  }
  function startNewGame(difficulty) {
    newGame(difficulty);
    beginPlay();
  }

  function slotSummaryText(slot) {
    return "Turn " + slot.turn + " · " + (DIFFICULTY_LABEL[slot.difficulty] || slot.difficulty) +
      " · " + slot.cities + (slot.cities === 1 ? " city" : " cities") + " · " + formatSavedAt(slot.savedAt);
  }
  // A short message along the bottom of the screen — used to confirm saves
  // and to report anything that went wrong with saving, loading or files.
  var toastTimer = null;
  function showToast(message, isError) {
    el.toast.textContent = message;
    el.toast.className = "toast" + (isError ? " error" : "");
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, isError ? 6000 : 2500);
  }

  // In-page confirmation for destructive actions (window.confirm is blocked
  // in some sandboxed hosts, and doesn't match the game's look).
  var pendingConfirm = null;
  function askConfirm(title, body, okLabel, onOk) {
    el.confirmTitle.textContent = title;
    el.confirmBody.textContent = body;
    el.confirmOkBtn.textContent = okLabel;
    pendingConfirm = onOk;
    el.confirmOverlay.hidden = false;
    el.confirmCancelBtn.focus();
  }
  function closeConfirm() {
    el.confirmOverlay.hidden = true;
    pendingConfirm = null;
  }

  function saveToSlotAndReturn(i) {
    if (!saveGameToSlot(i)) {
      showToast("Save failed — your browser's storage is full or blocked. Try deleting a slot, or export a save to a file.", true);
      return;
    }
    addLog("Game saved to Slot " + (i + 1) + ".");
    hideAllMenus();
    el.gameScreen.hidden = false;
    render();
    showToast("Saved to Slot " + (i + 1) + ".");
  }

  function downloadSlot(i) {
    var text = exportSlotText(i);
    if (!text) return;
    try {
      var blob = new Blob([text], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "first-reckoning-slot" + (i + 1) + "-turn" + (loadSaveSlots()[i].turn) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) {
      showToast("Couldn't export the save — this browser blocked the download.", true);
    }
  }

  function renderSlotList(container, mode) {
    var slots = loadSaveSlots();
    container.innerHTML = "";
    slots.forEach(function (slot, i) {
      var row = document.createElement("div");
      var main = document.createElement("button");
      main.type = "button";
      main.className = "slot-main";

      if (slot) {
        row.className = "slot-item";
        main.innerHTML = '<span class="slot-name">Slot ' + (i + 1) + (slot.hotseat ? " · 2 players" : "") + '</span><span class="slot-meta">' + slotSummaryText(slot) + '</span>';
        main.addEventListener("click", function () {
          if (mode === "load") {
            var err = loadGameFromSlot(i);
            if (err) { showToast("Couldn't load Slot " + (i + 1) + ": " + err, true); return; }
            beginPlay();
          } else {
            askConfirm("Overwrite Slot " + (i + 1) + "?", "The game saved there (" + slotSummaryText(slot) + ") will be replaced. This can't be undone.",
              "Overwrite", function () { saveToSlotAndReturn(i); });
          }
        });
        row.appendChild(main);

        var exp = document.createElement("button");
        exp.type = "button";
        exp.className = "slot-delete-btn slot-export-btn";
        exp.title = "Export this save to a file";
        exp.setAttribute("aria-label", "Export Slot " + (i + 1));
        exp.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 3h2v10l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 13V3zM5 18h14v2H5v-2z"/></svg>';
        exp.addEventListener("click", function () { downloadSlot(i); });
        row.appendChild(exp);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "slot-delete-btn";
        del.title = "Delete this save";
        del.setAttribute("aria-label", "Delete Slot " + (i + 1));
        del.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2zM9 9v9h1V9H9zm5 0v9h1V9h-1z"/></svg>';
        del.addEventListener("click", function () {
          askConfirm("Delete Slot " + (i + 1) + "?", "The game saved there (" + slotSummaryText(slot) + ") will be permanently deleted.",
            "Delete", function () {
              if (!deleteSaveSlot(i)) showToast("Couldn't delete — your browser's storage is blocked.", true);
              renderSlotList(container, mode);
            });
        });
        row.appendChild(del);
      } else {
        row.className = "slot-item empty" + (mode === "load" ? " loadable" : "");
        main.innerHTML = '<span class="slot-name">Slot ' + (i + 1) + '</span><span class="slot-meta">Empty Slot</span>';
        if (mode === "save") {
          main.addEventListener("click", function () { saveToSlotAndReturn(i); });
        } else {
          main.disabled = true;
        }
        row.appendChild(main);
      }
      container.appendChild(row);
    });
  }
  function renderHallOfFameList() {
    var games = loadHallOfFame();
    if (!games.length) {
      el.hofList.innerHTML = '<div class="hof-empty">No games recorded yet — finish a skirmish to add one.</div>';
      return;
    }
    el.hofList.innerHTML = games.map(function (g) {
      return '<div class="hof-item ' + (g.result === "win" ? "win" : "loss") + '">' +
        '<span class="hof-result">' + (g.winnerName ? (g.winnerName + " Wins") : (g.result === "win" ? "Victory" : "Defeat")) + '</span>' +
        '<span class="hof-meta">Turn ' + g.turn + ' · ' + (DIFFICULTY_LABEL[g.difficulty] || g.difficulty) + ' · ' + formatSavedAt(g.date) + '</span>' +
        '</div>';
    }).join("");
  }

  function openCombatAnalysis(attackerUnit, tx, ty) {
    var p = previewCombat(attackerUnit, tx, ty);
    pendingAttack = { unitId: attackerUnit.id, x: tx, y: ty };

    el.combatAttackerBadge.innerHTML = '<svg><use href="#icon-' + iconIdFor(p.attType) + '"></use></svg>';
    el.combatAttackerName.textContent = p.attType.name;
    el.combatAttackerStats.textContent = "ATK " + p.attType.attack + " / DEF " + p.attType.defense;
    el.combatAttackerTerrain.textContent = p.attBonus ? terrainLabel(p.attackerTerrain) + " +" + p.attBonus + " def" + (dugInBonus(attackerUnit) ? " (dug in)" : "") : "";

    var defenderIconId = p.targetBase ? (p.targetBase.id === "natives" ? "camp" : "base") : iconIdFor(p.defenderType);
    el.combatDefenderBadge.innerHTML = '<svg><use href="#icon-' + defenderIconId + '"></use></svg>';
    el.combatDefenderName.textContent = p.targetBase ? (p.targetBase.id === "natives" ? "Native Camp" : "Enemy Base") : p.defenderType.name;
    el.combatDefenderStats.textContent = "ATK " + p.defenderType.attack + " / DEF " + p.defenderType.defense;
    el.combatDefenderTerrain.textContent = p.defBonus ? terrainLabel(p.defenderTerrain) + " +" + p.defBonus + " def" + (p.targetUnit && dugInBonus(p.targetUnit) ? " (dug in)" : "") : "";

    el.combatDealt.textContent = p.dealt;
    el.combatTaken.textContent = p.taken;
    el.combatOverlay.hidden = false;
  }

  function closeCombatAnalysis() {
    pendingAttack = null;
    el.combatOverlay.hidden = true;
  }

  // Friendly units standing on the four tiles around the base — its garrison.
  function garrisonUnits(f, cityObj) {
    var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    var out = [];
    dirs.forEach(function (d) {
      var u = unitAt(cityObj.x + d[0], cityObj.y + d[1]);
      if (u && u.owner === f.id) out.push(u);
    });
    return out;
  }

  function openCityView() {
    el.cityOverlay.hidden = false;
    renderCityView();
  }
  function closeCityView() {
    el.cityOverlay.hidden = true;
  }

  function renderCityView() {
    var f = state.player;
    var cityObj = findCityById(f, state.selectedBaseId) || f.bases[0];
    el.cityTitle.textContent = "Inside " + cityLabel(f, cityObj);
    var pb = productionBreakdown(f);
    el.cityBaseVal.textContent = "+" + pb.base;
    el.cityHarvestVal.textContent = "+" + pb.harvest;
    el.cityCitiesVal.textContent = "+" + pb.cities;
    el.cityBuildingVal.textContent = "+" + pb.buildings;
    el.cityTotalVal.textContent = pb.total;

    el.cityBuildingsList.innerHTML = f.buildings.length
      ? f.buildings.map(function (id) {
          var t = BUILDING_TYPES[id];
          return '<div class="city-item"><div class="badge-mini"><svg><use href="#icon-' + id + '"></use></svg></div>' +
            '<div style="flex:1"><div>' + t.name + '</div><div class="desc">' + t.desc + '</div></div></div>';
        }).join("")
      : '<div class="empty">No buildings yet — queue one below.</div>';

    el.cityQueueList.innerHTML = f.buildQueue.length
      ? f.buildQueue.map(function (item, i) {
          var t = queueItemType(item);
          var iconId = item.kind === "building" ? item.id : item.id;
          var destCity = item.cityId ? findCityById(f, item.cityId) : null;
          var destLabel = destCity && destCity.alive ? " → " + cityLabel(f, destCity) : "";
          var row = '<div class="city-item"><div class="badge-mini"><svg><use href="#icon-' + iconId + '"></use></svg></div>' +
            '<div style="flex:1"><div>' + t.name + (item.kind === "building" ? " (building)" : destLabel) + '</div>';
          if (i === 0) {
            var pct = Math.min(100, (f.production / t.cost) * 100);
            row += '<div class="desc">' + f.production + ' / ' + t.cost + ' pts</div><div class="city-progress"><div class="city-progress-fill" style="width:' + pct + '%"></div></div>';
          } else {
            row += '<div class="desc">queued</div>';
          }
          return row + '</div></div>';
        }).join("")
      : '<div class="empty">Idle — nothing queued.</div>';

    var garrison = garrisonUnits(f, cityObj);
    el.cityGarrisonList.innerHTML = garrison.length
      ? garrison.map(function (u) {
          var t = UNIT_TYPES[u.typeId];
          return '<div class="city-item"><div class="badge-mini"><svg><use href="#icon-' + iconIdFor(t) + '"></use></svg></div>' +
            '<div style="flex:1"><div>' + t.name + '</div><div class="desc">' + u.hp + ' / ' + t.hp + ' hp</div></div></div>';
        }).join("")
      : '<div class="empty">No units stationed at the base.</div>';
  }

  function selectedUnit() {
    if (!state.selectedUnitId) return null;
    var all = state.player.units;
    for (var i = 0; i < all.length; i++) if (all[i].id === state.selectedUnitId) return all[i];
    return null;
  }

  function render() {
    renderBoard();
    renderHud();
    renderSelection();
    renderBuildPanel();
    renderTech();
    renderLog();
    updateHintUi();
    if (!state.over) el.scoreDetail.hidden = true;
    el.endTurnBtn.disabled = state.over;
    if (state.over) {
      el.resultOverlay.hidden = false;
      renderScore();
      if (state.hotseat) {
        el.resultTitle.textContent = sideName(state.winner) + " Wins";
        el.resultBody.textContent = "Every other city on the island has fallen.";
      } else {
        el.resultTitle.textContent = state.winner === "player" ? "Victory" : "Defeat";
        el.resultBody.textContent = state.winner === "player" ? "Every enemy city has been destroyed." : "All of your cities have fallen.";
      }
      if (!state.hofRecorded) {
        recordHallOfFame(state.winner === "player" ? "win" : "loss", state.hotseat ? sideName(state.winner) : null);
        state.hofRecorded = true;
      }
    } else {
      el.resultOverlay.hidden = true;
    }
    if (!el.cityOverlay.hidden) renderCityView();
  }

  function renderBoard() {
    updateFogOfWar();
    el.board.innerHTML = "";
    var su = selectedUnit();
    var pendingShip = state.pendingDisembark ? su : null;
    var reachable = (su && !pendingShip) ? reachableTiles(su) : [];
    var attackable = (su && !pendingShip) ? attackableTiles(su, reachable) : [];
    var boardable = (su && !pendingShip) ? boardableTiles(su, reachable) : [];
    var disembarkTiles = pendingShip ? findAllDisembarkTiles(pendingShip) : [];
    var reachSet = {}; reachable.forEach(function (t) { reachSet[key(t[0], t[1])] = true; });
    var atkSet = {}; attackable.forEach(function (t) { atkSet[key(t[0], t[1])] = true; });
    var boardSet = {}; boardable.forEach(function (t) { boardSet[key(t[0], t[1])] = true; });
    var disembarkSet = {}; disembarkTiles.forEach(function (t) { disembarkSet[key(t[0], t[1])] = true; });

    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var tile = document.createElement("div");
        var isExplored = state.player.explored[y][x];
        var isRes = isExplored && isResourceTile(x, y);
        var terrain = terrainAt(x, y);
        var k = key(x, y);

        if (!isExplored) {
          tile.className = "tile unexplored";
          tile.title = "Unexplored";
        } else {
          tile.className = "tile" + (terrain !== "plain" ? " " + terrain : "") + (isRes ? " resource" : "");
          tile.title = terrainLabel(terrain) + (isRes ? " (goods)" : "");
        }
        if (su && su.x === x && su.y === y) tile.classList.add("selected");
        if (reachSet[k]) tile.classList.add("reachable");
        if (atkSet[k]) tile.classList.add("attackable");
        if (boardSet[k]) tile.classList.add("boardable");
        if (disembarkSet[k]) tile.classList.add("disembarkable");
        if (hintTiles && hintTiles.from && hintTiles.from[0] === x && hintTiles.from[1] === y) tile.classList.add("hint-from");
        if (hintTiles && hintTiles.to && hintTiles.to[0] === x && hintTiles.to[1] === y) tile.classList.add("hint-to");

        if (isExplored) {
          var b = baseAt(x, y);
          var u = unitAt(x, y);
          // A base, once discovered, stays visible as a structure (its exact
          // live HP is a minor simplification). A unit is different — it
          // moves, so an enemy or native unit only actually shows up on a
          // tile that's within your CURRENT vision, not just ever-explored
          // ground; your own units are always shown.
          var showUnit = u && (u.owner === "player" || (state.player.visible && state.player.visible[y][x]));
          if (b) {
            var bt = document.createElement("div");
            bt.className = "base-token " + b.id;
            var antiAirNote = (b.id !== "natives" && factionOf(b.id).buildings.indexOf("antiAir") !== -1) ? " (anti-air)" : "";
            bt.title = ownerLabel(b.id) + (b.id === "natives" ? " Camp" + campStatusSuffix(b.base) : (b.id === "barbarians" ? " City" : " Base" + (b.base.hasInnerArtillery ? " (coastal artillery — fires back at ships)" : "") + antiAirNote));
            bt.innerHTML = '<svg><use href="#icon-' + (b.id === "natives" ? "camp" : "base") + '"></use></svg>';
            tile.appendChild(bt);
            var pip = document.createElement("div");
            pip.className = "hp-pip";
            var fill = document.createElement("div");
            fill.className = "hp-pip-fill";
            fill.style.width = Math.max(0, (b.base.hp / b.base.maxHp) * 100) + "%";
            pip.appendChild(fill);
            tile.appendChild(pip);
          } else if (showUnit) {
            var type = UNIT_TYPES[u.typeId];
            var tok = document.createElement("div");
            tok.className = "token " + u.owner + (u.acted ? " acted" : "");
            tok.title = ownerLabel(u.owner) + " " + type.name + (u.owner === "natives" && u.campId ? campStatusSuffix(campById(u.campId)) : "");
            tok.innerHTML = '<svg><use href="#icon-' + iconIdFor(type) + '"></use></svg>';
            tile.appendChild(tok);
            var pip2 = document.createElement("div");
            pip2.className = "hp-pip";
            var fill2 = document.createElement("div");
            fill2.className = "hp-pip-fill";
            fill2.style.width = Math.max(0, (u.hp / type.hp) * 100) + "%";
            pip2.appendChild(fill2);
            tile.appendChild(pip2);
            if (type.capacity && u.cargo.length) {
              var cargoBadge = document.createElement("div");
              cargoBadge.className = "cargo-badge";
              cargoBadge.textContent = cargoOccupied(u);
              tile.appendChild(cargoBadge);
            }
          } else if (isRes) {
            tile.insertAdjacentHTML("beforeend", '<svg class="goods-icon"><use href="#icon-goods"></use></svg>');
          } else if (terrain === "forest") {
            tile.insertAdjacentHTML("beforeend", '<svg class="terrain-icon"><use href="#icon-tree"></use></svg>');
          } else if (terrain === "mountain") {
            tile.insertAdjacentHTML("beforeend", '<svg class="terrain-icon"><use href="#icon-mountain"></use></svg>');
          }
        }

        tile.addEventListener("click", function (x, y) {
          return function () { onTileClick(x, y); };
        }(x, y));

        el.board.appendChild(tile);
      }
    }
  }

  function onTileClick(x, y) {
    if (state.over) return;

    if (state.pendingDisembark) {
      var ship = selectedUnit();
      var validTiles = ship ? findAllDisembarkTiles(ship) : [];
      var isValidLanding = validTiles.some(function (t) { return t[0] === x && t[1] === y; });
      if (ship && isValidLanding) {
        disembarkUnitAt(ship, state.pendingDisembark.cargoIdx, x, y);
      }
      // Clicking a highlighted tile lands there; clicking anywhere else
      // simply cancels the landing-site choice, no action taken.
      state.pendingDisembark = null;
      render();
      return;
    }

    var su = selectedUnit();

    if (su) {
      var reachable = reachableTiles(su);
      var attackable = attackableTiles(su, reachable);
      var boardable = boardableTiles(su, reachable);
      var isReach = reachable.some(function (t) { return t[0] === x && t[1] === y; });
      var isAtk = attackable.some(function (t) { return t[0] === x && t[1] === y; });
      var isBoard = boardable.some(function (t) { return t[0] === x && t[1] === y; });
      if (isAtk) {
        var tu = unitAt(x, y), tb = baseAt(x, y);
        var tCamp = tu && tu.owner === "natives" ? campById(tu.campId) : (tb && tb.id === "natives" ? tb.base : null);
        if (tCamp && tCamp.pact === "peace") {
          askConfirm("Break treaty?", "natives can attack you if you press that.", "Break treaty", function () {
            openCombatAnalysis(su, x, y);
          });
          return;
        }
        openCombatAnalysis(su, x, y);
        return;
      }
      if (isBoard) { boardFrigate(su, unitAt(x, y)); render(); return; }
      if (isReach) { su.x = x; su.y = y; su.acted = true; state.selectedUnitId = null; render(); return; }
    }

    var u = unitAt(x, y);
    if (u && u.owner === "player" && !u.acted) {
      state.selectedUnitId = u.id;
      state.selectedBaseId = null;
      if (!el.cityOverlay.hidden) closeCityView();
      render();
      return;
    }
    var clickedBase = baseAt(x, y);
    if (clickedBase && clickedBase.id === "player") {
      state.selectedUnitId = null;
      state.selectedBaseId = clickedBase.base.id;
      render();
      return;
    }
    state.selectedUnitId = null;
    state.selectedBaseId = null;
    render();
  }

  function renderHud() {
    el.hudTurn.textContent = state.turn;
    el.hudPlayerProd.textContent = state.player.production;
    el.hudPlayerCities.textContent = state.player.bases.filter(function (b) { return b.alive; }).length;
    el.hudAiProd.textContent = state.ai.production;
    el.hudAiLabel.textContent = state.hotseat ? (sideName("ai") + " Production") : "AI Production";
  }

  function renderSelection() {
    var su = selectedUnit();
    if (su && state.pendingDisembark) {
      var pendingType = UNIT_TYPES[su.typeId];
      var landUnit = su.cargo[state.pendingDisembark.cargoIdx];
      var landName = landUnit ? UNIT_TYPES[landUnit.typeId].name : "unit";
      el.selectionBody.innerHTML =
        '<p class="sel-name">' + pendingType.name + '</p>' +
        '<div class="hint">Click a highlighted tile to land the ' + landName + ', or Cancel.</div>' +
        '<button class="view-city" id="cancelDisembarkBtn">Cancel</button>';
      var cdb = document.getElementById("cancelDisembarkBtn");
      if (cdb) cdb.addEventListener("click", function () { state.pendingDisembark = null; render(); });
      return;
    }
    if (su) {
      var type = UNIT_TYPES[su.typeId];
      var reachableSel = reachableTiles(su);
      var boardableSel = boardableTiles(su, reachableSel);
      var hint;
      if (su.acted) {
        hint = "Already acted this turn.";
      } else if (type.capacity) {
        hint = "Click a white-outlined tile to move, or a red-outlined tile to attack.";
      } else if (boardableSel.length) {
        hint = "Click a white-outlined tile to move, a red-outlined tile to attack, or a cyan-outlined tile to board a ship.";
      } else {
        hint = "Click a white-outlined tile to move, or a red-outlined tile to attack.";
      }
      var canFound = type.canFoundCity && !su.acted && isValidCitySite(su.x, su.y);
      var foundHint = "";
      if (type.canFoundCity && !su.acted && !canFound) {
        foundHint = '<div class="hint">Move to open, non-mountain ground at least ' + MIN_CITY_DISTANCE + ' tiles from any city to found here.</div>';
      }
      // Only a player-owned Scout that hasn't acted yet, standing next to a
      // living native camp, can negotiate with it.
      var nearCamp = (su.typeId === "scout" && su.owner === "player" && !su.acted) ? adjacentNativeCamp(su) : null;
      var negotiateHtml = "";
      var campWontTalkToPlayer = nearCamp && nearCamp.pact !== "war" && !campWillNegotiateWith(nearCamp, "player");
      if (nearCamp && nearCamp.pact === "war") {
        negotiateHtml = '<div class="hint">This camp is at war with the AI on your behalf.</div>';
      } else if (campWontTalkToPlayer) {
        negotiateHtml = '<div class="hint">This camp already fights for the AI — it won’t negotiate with you.</div>';
      } else if (nearCamp) {
        var hasTribute = !!findTributeUnit(state.player);
        negotiateHtml = '<div class="hint">' + (nearCamp.pact === "peace" ? "At peace with this native camp." : "A native camp is within reach.") + '</div>' +
          (nearCamp.pact ? '' : '<button class="view-city" id="askPeaceBtn">Ask for Peace</button>') +
          '<button class="view-city" id="proposeWarBtn">Propose War Plan</button>' +
          (hasTribute ? '' : '<div class="hint">Needs a weak unit (Infantry) nearby to give as tribute.</div>');
      }
      el.selectionBody.innerHTML =
        '<p class="sel-name">' + type.name + '</p>' +
        '<div class="stat-row"><span class="k">HP</span><span class="v">' + su.hp + ' / ' + type.hp + '</span></div>' +
        '<div class="stat-row"><span class="k">Attack</span><span class="v">' + type.attack + '</span></div>' +
        '<div class="stat-row"><span class="k">Defense</span><span class="v">' + type.defense + '</span></div>' +
        '<div class="stat-row"><span class="k">Movement</span><span class="v">' + type.movement + '</span></div>' +
        (type.capacity ? '<div class="stat-row"><span class="k">Cargo</span><span class="v">' + cargoOccupied(su) + ' / ' + type.capacity + '</span></div>' : '') +
        '<div class="hint">' + hint + '</div>' +
        foundHint +
        (canFound ? '<button class="view-city" id="foundCityBtn">Found City</button>' : '') +
        negotiateHtml +
        (su.owner === "player" ? '<button class="view-city disband-btn" id="disbandUnitBtn">Disband Unit</button>' : '') +
        (type.capacity && su.cargo.length
          ? '<div class="cargo-list">' + su.cargo.map(function (c, i) {
              var ct = UNIT_TYPES[c.typeId];
              return '<div class="cargo-row"><span>' + ct.name + ' (' + cargoSlotCost(c.typeId) + ' slot' + (cargoSlotCost(c.typeId) > 1 ? 's' : '') + ')</span><button class="disembark-btn" data-idx="' + i + '">Disembark</button></div>';
            }).join("") + '</div>'
          : '');
      if (type.capacity && su.cargo.length) {
        Array.prototype.forEach.call(el.selectionBody.querySelectorAll(".disembark-btn"), function (btn) {
          btn.addEventListener("click", function () {
            var idx = parseInt(btn.getAttribute("data-idx"), 10);
            var landingTiles = findAllDisembarkTiles(su);
            if (!landingTiles.length) {
              addLog("No open ground to disembark onto.");
              render();
              return;
            }
            if (landingTiles.length === 1) {
              disembarkUnitAt(su, idx, landingTiles[0][0], landingTiles[0][1]);
              render();
              return;
            }
            // More than one open spot — let the player pick which tile to
            // land on instead of always taking the first one found.
            state.pendingDisembark = { cargoIdx: idx };
            render();
          });
        });
      }
      if (canFound) {
        var fcb = document.getElementById("foundCityBtn");
        if (fcb) fcb.addEventListener("click", function () { foundCityAction(su); });
      }
      if (su.owner === "player") {
        var dub = document.getElementById("disbandUnitBtn");
        if (dub) dub.addEventListener("click", function () { disbandUnit(su); render(); });
      }
      if (nearCamp && nearCamp.pact !== "war" && !campWontTalkToPlayer) {
        var apb = document.getElementById("askPeaceBtn");
        if (apb) apb.addEventListener("click", function () { askForPeace(su, nearCamp); render(); });
        var pwb = document.getElementById("proposeWarBtn");
        if (pwb) pwb.addEventListener("click", function () { proposeWarPlan(su, nearCamp); render(); });
      }
    } else if (state.selectedBaseId) {
      var cityObj = findCityById(state.player, state.selectedBaseId);
      if (cityObj) {
        var pbSel = productionBreakdown(state.player);
        el.selectionBody.innerHTML =
          '<p class="sel-name">' + cityLabel(state.player, cityObj) + '</p>' +
          '<div class="stat-row"><span class="k">HP</span><span class="v">' + cityObj.hp + ' / ' + cityObj.maxHp + '</span></div>' +
          '<div class="stat-row"><span class="k">Production / turn (shared)</span><span class="v">' + pbSel.total + '</span></div>' +
          '<div class="stat-row"><span class="k">Your cities</span><span class="v">' + state.player.bases.filter(function (b) { return b.alive; }).length + '</span></div>' +
          '<button class="view-city" id="viewCityBtn">View Inside Base</button>';
        var vcb = document.getElementById("viewCityBtn");
        if (vcb) vcb.addEventListener("click", openCityView);
      } else {
        el.selectionBody.innerHTML = '<p class="sel-empty">Click one of your units or your base.</p>';
      }
    } else {
      el.selectionBody.innerHTML = '<p class="sel-empty">Click one of your units or your base.</p>';
    }
  }

  function disbandUnit(u) {
    var type = UNIT_TYPES[u.typeId];
    if (u.cargo && u.cargo.length) {
      addLog(u.cargo.length + " unit(s) aboard were lost when " + possessiveLabel(u.owner) + " " + type.name + " was disbanded.", false);
      u.cargo = [];
    }
    addLog((u.owner === "player" ? "You" : "The AI") + " disbanded a " + type.name + ".", false);
    removeUnit(u);
    if (state.selectedUnitId === u.id) state.selectedUnitId = null;
  }

  function foundCityAction(settlerUnit) {
    if (!isValidCitySite(settlerUnit.x, settlerUnit.y)) return;
    var f = factionOf(settlerUnit.owner);
    var city = foundCity(f, settlerUnit.x, settlerUnit.y);
    removeUnit(settlerUnit);
    addLog((settlerUnit.owner === "player" ? "You" : "The AI") + " founded " + cityLabel(f, city) + ".", false);
    state.selectedUnitId = null;
    render();
  }

  function renderBuildPanel() {
    var f = state.player;
    el.buildSelect.innerHTML = "";

    var unitGroup = document.createElement("optgroup");
    unitGroup.label = "Units";
    f.unlocked.forEach(function (id) {
      var t = UNIT_TYPES[id];
      var opt = document.createElement("option");
      opt.value = "unit:" + id;
      opt.textContent = t.name + " (" + t.cost + " pts)";
      unitGroup.appendChild(opt);
    });
    el.buildSelect.appendChild(unitGroup);

    var availableBuildings = BUILDING_ORDER.filter(function (id) {
      return f.buildings.indexOf(id) === -1 && !f.buildQueue.some(function (q) { return q.kind === "building" && q.id === id; })
        && (id !== "shipyard" || factionHasCoastalCity(f));
    });
    if (availableBuildings.length) {
      var buildingGroup = document.createElement("optgroup");
      buildingGroup.label = "Buildings";
      availableBuildings.forEach(function (id) {
        var t = BUILDING_TYPES[id];
        var opt = document.createElement("option");
        opt.value = "building:" + id;
        opt.textContent = t.name + " (" + t.cost + " pts, " + t.desc + ")";
        buildingGroup.appendChild(opt);
      });
      el.buildSelect.appendChild(buildingGroup);
    }

    var frontItem = f.buildQueue[0];
    var frontDestCity = frontItem && frontItem.cityId ? findCityById(f, frontItem.cityId) : null;
    var frontDestLabel = frontDestCity && frontDestCity.alive ? " → " + cityLabel(f, frontDestCity) : "";
    var queueText = f.buildQueue.length
      ? "Building: " + queueItemType(frontItem).name + frontDestLabel + " (" + f.production + "/" + queueItemType(frontItem).cost + " pts, " + f.buildQueue.length + " queued)"
      : "Base is idle — pick something and queue it.";
    if (f.buildings.indexOf("shipyard") === -1 && !factionHasCoastalCity(f)) {
      queueText += " Found or capture a city on the coast to unlock the Shipyard.";
    }
    el.queueHint.textContent = queueText;
  }

  function renderTech() {
    el.techList.innerHTML = "";
    var f = state.player;
    TECHS.forEach(function (t, i) {
      var div = document.createElement("div");
      var done = i < f.techIndex;
      div.className = "tech-item" + (done ? " done" : "");
      var pct = done ? 100 : (i === f.techIndex ? Math.min(100, (f.research / t.cost) * 100) : 0);
      div.innerHTML =
        '<div class="name"><span>' + t.name + '</span><span>' + (done ? "done" : (i === f.techIndex ? f.research + "/" + t.cost : "locked")) + '</span></div>' +
        '<div class="tech-bar"><div class="tech-bar-fill" style="width:' + pct + '%"></div></div>';
      el.techList.appendChild(div);
    });
  }

  function renderLog() {
    if (!state.log.length) { el.logList.innerHTML = '<li class="empty">Nothing yet.</li>'; return; }
    el.logList.innerHTML = state.log.map(function (l) {
      return '<li' + (l.win ? ' class="win"' : '') + '>' + l.text + '</li>';
    }).join("");
  }

