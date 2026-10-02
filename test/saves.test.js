const test = require("node:test");
const assert = require("node:assert");
const { loadGame, fakeStorage, click } = require("./helpers");

function startGame(opts) {
  const g = loadGame(opts);
  click(g.window, g.el.homePlayBtn);
  click(g.window, g.el.diffMediumBtn);
  return g;
}
function saveRows(g, list) { return [...list.querySelectorAll(".slot-item")]; }

test("save and load round-trips the game", () => {
  const g = startGame({ seed: 5 });
  click(g.window, g.el.endTurnBtn);
  click(g.window, g.el.endTurnBtn);
  const turn = g.game.state.turn;
  assert.strictEqual(g.game.saveGameToSlot(0), true);
  g.game.newGame("hard");
  assert.strictEqual(g.game.state.turn, 1);
  assert.strictEqual(g.game.loadGameFromSlot(0), null);
  assert.strictEqual(g.game.state.turn, turn);
  assert.strictEqual(g.game.state.difficulty, "medium");
  assert.strictEqual(g.game.loadSaveSlots()[0].version, g.game.SAVE_VERSION);
});

test("a failed save is reported and the save screen stays open", () => {
  const storage = fakeStorage();
  const g = startGame({ seed: 5, storage });
  click(g.window, g.el.saveIconBtn);
  storage.failWrites = true;
  click(g.window, saveRows(g, g.el.saveSlotList)[0].querySelector(".slot-main"));
  assert.strictEqual(g.el.toast.hidden, false);
  assert.match(g.el.toast.textContent, /Save failed/);
  assert.match(g.el.toast.className, /error/);
  assert.strictEqual(g.el.saveOverlay.hidden, false);
  assert.strictEqual(g.game.loadSaveSlots()[0], null);
});

test("a successful save confirms with a message", () => {
  const g = startGame({ seed: 5 });
  click(g.window, g.el.saveIconBtn);
  click(g.window, saveRows(g, g.el.saveSlotList)[0].querySelector(".slot-main"));
  assert.match(g.el.toast.textContent, /Saved to Slot 1/);
  assert.strictEqual(g.el.saveOverlay.hidden, true);
});

test("overwriting a save asks first, and Cancel keeps the old save", () => {
  const g = startGame({ seed: 5 });
  g.game.saveGameToSlot(0);
  const original = g.game.loadSaveSlots()[0].savedAt;
  click(g.window, g.el.endTurnBtn);
  click(g.window, g.el.saveIconBtn);
  click(g.window, saveRows(g, g.el.saveSlotList)[0].querySelector(".slot-main"));
  assert.strictEqual(g.el.confirmOverlay.hidden, false);
  assert.match(g.el.confirmTitle.textContent, /Overwrite Slot 1/);
  click(g.window, g.el.confirmCancelBtn);
  assert.strictEqual(g.el.confirmOverlay.hidden, true);
  assert.strictEqual(g.game.loadSaveSlots()[0].turn, 1);

  click(g.window, saveRows(g, g.el.saveSlotList)[0].querySelector(".slot-main"));
  click(g.window, g.el.confirmOkBtn);
  assert.strictEqual(g.game.loadSaveSlots()[0].turn, 2);
  assert.ok(g.game.loadSaveSlots()[0].savedAt >= original);
});

test("deleting a save asks first", () => {
  const g = startGame({ seed: 5 });
  g.game.saveGameToSlot(2);
  click(g.window, g.el.menuIconBtn);
  click(g.window, g.el.homeLoadBtn);
  const row = saveRows(g, g.el.loadSlotList)[2];
  click(g.window, row.querySelector('[aria-label="Delete Slot 3"]'));
  assert.strictEqual(g.el.confirmOverlay.hidden, false);
  click(g.window, g.el.confirmCancelBtn);
  assert.ok(g.game.loadSaveSlots()[2]);
  click(g.window, saveRows(g, g.el.loadSlotList)[2].querySelector('[aria-label="Delete Slot 3"]'));
  click(g.window, g.el.confirmOkBtn);
  assert.strictEqual(g.game.loadSaveSlots()[2], null);
});

test("Enter doesn't end the turn while a confirmation is open", () => {
  const g = startGame({ seed: 5 });
  g.el.confirmOverlay.hidden = false;
  g.document.body.dispatchEvent(new g.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.strictEqual(g.game.state.turn, 1);
});

test("old unversioned saves are migrated on load", () => {
  const g = startGame({ seed: 5 });
  g.game.saveGameToSlot(0);
  const slots = g.game.loadSaveSlots();
  delete slots[0].version;
  delete slots[0].snapshot.state.hotseat;
  delete slots[0].snapshot.state.hotseatSecondTurn;
  delete slots[0].snapshot.resourceList;
  g.window.localStorage.setItem(g.game.LS_SAVES_KEY, JSON.stringify(slots));
  assert.strictEqual(g.game.loadGameFromSlot(0), null);
  assert.strictEqual(g.game.state.hotseat, false);
  assert.strictEqual(g.game.state.hotseatSecondTurn, false);
  click(g.window, g.el.endTurnBtn);
  assert.strictEqual(g.game.state.turn, 2);
});

test("saves from a newer version, or damaged saves, are refused without touching the current game", () => {
  const g = startGame({ seed: 5 });
  g.game.saveGameToSlot(0);
  const slots = g.game.loadSaveSlots();
  slots[0].version = 99;
  slots[1] = { version: 2, snapshot: { state: {} } };
  g.window.localStorage.setItem(g.game.LS_SAVES_KEY, JSON.stringify(slots));
  const before = g.game.state;
  assert.match(g.game.loadGameFromSlot(0), /newer version/);
  assert.match(g.game.loadGameFromSlot(1), /damaged/);
  assert.strictEqual(g.game.state, before);

  click(g.window, g.el.menuIconBtn);
  click(g.window, g.el.homeLoadBtn);
  click(g.window, saveRows(g, g.el.loadSlotList)[0].querySelector(".slot-main"));
  assert.match(g.el.toast.textContent, /Couldn't load Slot 1/);
  assert.strictEqual(g.el.loadOverlay.hidden, false);
});

test("export and import round-trip into the first empty slot", () => {
  const g = startGame({ seed: 5 });
  click(g.window, g.el.endTurnBtn);
  g.game.saveGameToSlot(0);
  const text = g.game.exportSlotText(0);
  assert.strictEqual(JSON.parse(text).format, "first-reckoning-save");

  const other = loadGame({ seed: 9 });
  assert.strictEqual(other.game.importSaveText(text).slot, 0);
  assert.strictEqual(other.game.loadGameFromSlot(0), null);
  assert.strictEqual(other.game.state.turn, 2);
});

test("import rejects junk and reports full slots", () => {
  const g = startGame({ seed: 5 });
  assert.match(g.game.importSaveText("not json").error, /isn't a First Reckoning save/);
  assert.match(g.game.importSaveText('{"format":"other"}').error, /isn't a First Reckoning save/);
  for (let i = 0; i < 5; i++) g.game.saveGameToSlot(i);
  assert.match(g.game.importSaveText(g.game.exportSlotText(0)).error, /slots are full/);
});
