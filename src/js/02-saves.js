  // ---------- HOME SCREEN / SAVES / HALL OF FAME ----------
  var SAVE_SLOTS = 5;
  var LS_SAVES_KEY = "adamitosGame.saves.v1";
  var LS_HOF_KEY = "adamitosGame.hallOfFame.v1";
  var DIFFICULTY_LABEL = { baby: "Baby Mode", medium: "Medium", hard: "Hard" };
  // Baby/Hard tune the AI's production+research pace. Hard also switches the
  // AI to smarter tactics — see the HARD-MODE AI section.
  var DIFFICULTY_AI_MULT = { baby: 0.6, medium: 1, hard: 1.5 };

  function setBoardCssVars() {
    document.getElementById("board").style.setProperty("--cols", COLS);
    document.getElementById("board").style.setProperty("--rows", ROWS);
    document.getElementById("board").style.setProperty("--tile-px", TILE_PX + "px");
  }

  function loadSaveSlots() {
    try {
      var raw = localStorage.getItem(LS_SAVES_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      while (arr.length < SAVE_SLOTS) arr.push(null);
      return arr.slice(0, SAVE_SLOTS);
    } catch (e) { return new Array(SAVE_SLOTS).fill(null); }
  }
  // Returns false when the browser refuses the write (storage full, blocked,
  // or private mode) so callers can tell the player instead of pretending
  // the save went through.
  function writeSaveSlots(arr) {
    try { localStorage.setItem(LS_SAVES_KEY, JSON.stringify(arr)); return true; } catch (e) { return false; }
  }
  function deleteSaveSlot(idx) {
    var slots = loadSaveSlots();
    slots[idx] = null;
    return writeSaveSlots(slots);
  }

  // Bump SAVE_VERSION whenever the shape of `state` changes in a way an
  // older save wouldn't already satisfy, and add a step to migrateSave that
  // upgrades the previous version. Saves made before versioning existed
  // have no `version` field and are treated as version 1.
  var SAVE_VERSION = 2;
  var SAVE_FILE_FORMAT = "first-reckoning-save";

  function buildSaveSlot() {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      difficulty: state.difficulty || "medium",
      turn: state.turn,
      cities: state.player.bases.filter(function (b) { return b.alive; }).length,
      hotseat: !!state.hotseat,
      cols: COLS, rows: ROWS,
      snapshot: {
        state: state,
        terrain: TERRAIN_GRID, resource: RESOURCE_GRID, resourceList: RESOURCE_LIST, island: ISLAND_GRID
      }
    };
  }

  // Upgrades a slot in place to SAVE_VERSION. Returns an error message for
  // a slot that can't be used, or null when it's good to load.
  function migrateSave(slot) {
    if (!slot || typeof slot !== "object" || !slot.snapshot || !slot.snapshot.state) return "This save is damaged or isn't a First Reckoning save.";
    var v = slot.version || 1;
    if (v > SAVE_VERSION) return "This save was made by a newer version of the game.";
    if ((slot.cols || COLS) !== COLS || (slot.rows || ROWS) !== ROWS) return "This save uses a different map size.";
    var snap = slot.snapshot;
    if (!Array.isArray(snap.terrain) || snap.terrain.length !== ROWS || !Array.isArray(snap.resource) ||
        !Array.isArray(snap.island) || !snap.state.player || !snap.state.ai) {
      return "This save is damaged or isn't a First Reckoning save.";
    }
    if (v < 2) {
      // v1 -> v2: local hotseat fields and the newer per-game flags may be
      // missing from saves made before those features shipped.
      var s = snap.state;
      if (s.hotseat === undefined) s.hotseat = false;
      if (s.hotseatSecondTurn === undefined) s.hotseatSecondTurn = false;
      if (!s.difficulty) s.difficulty = slot.difficulty || "medium";
      if (s.hofRecorded === undefined) s.hofRecorded = !!s.over;
      if (!Array.isArray(snap.resourceList)) {
        snap.resourceList = [];
        snap.resource.forEach(function (row, y) { row.forEach(function (r, x) { if (r) snap.resourceList.push([x, y]); }); });
      }
      slot.hotseat = !!s.hotseat;
      slot.version = 2;
    }
    return null;
  }

  function saveGameToSlot(idx) {
    var slots = loadSaveSlots();
    slots[idx] = buildSaveSlot();
    return writeSaveSlots(slots);
  }
  // Returns null on success, or an error message — and on failure leaves
  // the game currently in memory untouched.
  function loadGameFromSlot(idx) {
    var slots = loadSaveSlots();
    var slot = slots[idx];
    if (!slot) return "That slot is empty.";
    var err = migrateSave(slot);
    if (err) return err;
    var snap = slot.snapshot;
    TERRAIN_GRID = snap.terrain;
    RESOURCE_GRID = snap.resource;
    RESOURCE_LIST = snap.resourceList;
    ISLAND_GRID = snap.island;
    state = snap.state;
    return null;
  }

  // Export/import: a save slot wrapped in a small envelope and written to a
  // .json file, so a game can be backed up or moved to another browser.
  function exportSlotText(idx) {
    var slot = loadSaveSlots()[idx];
    if (!slot) return null;
    return JSON.stringify({ format: SAVE_FILE_FORMAT, slot: slot });
  }
  // Puts an imported save into the first empty slot. Returns
  // { slot: index } on success or { error: message }.
  function importSaveText(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { error: "That file isn't a First Reckoning save." }; }
    if (!parsed || parsed.format !== SAVE_FILE_FORMAT) return { error: "That file isn't a First Reckoning save." };
    var err = migrateSave(parsed.slot);
    if (err) return { error: err };
    var slots = loadSaveSlots();
    var free = slots.indexOf(null);
    if (free === -1) return { error: "All " + SAVE_SLOTS + " slots are full — delete one first." };
    slots[free] = parsed.slot;
    if (!writeSaveSlots(slots)) return { error: "Couldn't store the save — browser storage is full or blocked." };
    return { slot: free };
  }

  function loadHallOfFame() {
    try {
      var raw = localStorage.getItem(LS_HOF_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function recordHallOfFame(result, winnerName) {
    try {
      var arr = loadHallOfFame();
      arr.unshift({ result: result, turn: state.turn, difficulty: state.difficulty || "medium", date: Date.now(), winnerName: winnerName || null });
      if (arr.length > 50) arr.length = 50;
      localStorage.setItem(LS_HOF_KEY, JSON.stringify(arr));
    } catch (e) {}
  }
  function formatSavedAt(ts) {
    try { return new Date(ts).toLocaleString(); } catch (e) { return ""; }
  }

