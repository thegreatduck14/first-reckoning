// Loads the built phase1-skirmish.html into jsdom with a seeded Math.random
// and returns the engine internals the page exposes via window.__FR_TEST__.
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const HTML = fs.readFileSync(path.join(__dirname, "..", "phase1-skirmish.html"), "utf8");

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadGame({ seed = 1, storage } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => errors.push(e));
  const dom = new JSDOM(HTML, {
    url: "http://localhost/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.__FR_TEST__ = {};
      window.Math.random = mulberry32(seed);
      if (storage) Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
    },
  });
  const { window } = dom;
  if (errors.length) throw errors[0];
  const game = window.__FR_TEST__.game;
  return { window, document: window.document, game, el: game.el, errors };
}

// A localStorage stand-in whose writes can be made to fail on demand.
function fakeStorage() {
  const data = {};
  return {
    failWrites: false,
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) {
      if (this.failWrites) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; }
      data[k] = String(v);
    },
    removeItem(k) { delete data[k]; },
    clear() { for (const k in data) delete data[k]; },
  };
}

function click(window, node) {
  node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

module.exports = { loadGame, fakeStorage, click };
