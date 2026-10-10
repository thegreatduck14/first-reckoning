// Builds mockups/art-compare.html: the game's current art (pulled live from
// src/) side by side with a bright 8-bit redesign. Run: node mockups/make-art-compare.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(root, "src/shell.html"), "utf8");
const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");

// ---------- ORIGINAL: real symbols + real CSS, scoped under .orig ----------
const origSymbols = shell.match(/<svg width="0"[\s\S]*?<\/svg>/)[0];
const darkVars = css.match(/:root \{([\s\S]*?)\n  \}/)[1];
const lightVars = css.match(/:root\[data-theme="light"\] \{([\s\S]*?)\n  \}/)[1];
const boardCss = css.slice(css.indexOf("  .board {"), css.indexOf("  .side-col"));
const scope = (block) =>
  block.replace(/(^|\})\s*([^{}]+)\{/g, (m, pre, sel) =>
    pre + "\n" + sel.split(",").map((s) => ".orig " + s.trim()).join(",") + "{");
const origCss = `
.orig{${darkVars}}
.orig[data-theme="light"]{${lightVars}}
${scope(boardCss)}
.orig .tile{width:34px;height:34px}
${scope(css.slice(css.indexOf("  .city-list"), css.indexOf("  .city-progress")))}
`;

// ---------- NEW: ASCII pixel sprites ----------
const PAL = {
  y: "#c99a14", o: "#d9560a", c: "#1ea8c8", F: "#ffb3a0",
  K: "#14142b", W: "#ffffff", G: "#d6dcf0", g: "#8a92b8", D: "#50557a",
  R: "#ff3b4f", r: "#b8183a", O: "#ff9a1a", Y: "#ffe23a",
  L: "#7cf23c", l: "#22b33c", d: "#0e7a34",
  C: "#3ff0f0", B: "#3d7bff", b: "#1b3fc4", P: "#ff5ce0", V: "#a14dff",
  N: "#d17a2e", n: "#7d4015", T: "#ffc994", S: "#ffe9a8", M: "#f4efe0",
};
const pad = (rows, top = 0) => {
  const out = Array(top).fill("............").concat(rows);
  while (out.length < 12) out.push("............");
  return out;
};
const recolor = (rows, map) => rows.map((r) => r.replace(/./g, (c) => map[c] || c));

const SPR = {};
SPR.harvester = [
  "............", "............", "..KKKK......", ".KCCWCK.....",
  "KSSSSSSSKGGK", "KYYOOOYYKgGK", "KyyyyyyyKGgK", "KKKKKKKKKKKK",
  ".KDDK..KDDK.", "KDGGDKKDGGDK", ".KKKK..KKKK.", "............",
];
SPR.builder = [
  ".KKKKKKKKKK.", ".KOYOYOYOYK.", ".KKKKKKKKgK.", "...KgK..KYK.",
  "...KgK...KK.", "..KKgKKKKKK.", "KCCCKOOOOOOK", "KCWCKOOOOOOK",
  "KKKKKKKKKKKK", ".KDDK..KDDK.", "KDGGDKKDGGDK", ".KKKK..KKKK.",
];
SPR.settler = [
  "....KKKK....", "..KKMMMMKK..", ".KMMMMMMMMK.", ".KMMMWWMMMK.",
  ".KMMMMMMMMK.", ".KMMMMMMMMK.", "KRRRRRRRRRRK", "KNNNNNNNNNNK",
  "KKKKKKKKKKKK", ".KDDK..KDDK.", "KDGGDKKDGGDK", ".KKKK..KKKK.",
];
SPR.scout = [
  "............", "....KRRK....", "...KTTTK.KK.", "...KllLK.KNK",
  ".KKKllLKKKNK", "KNNNNNNNNNNK", "KNNNNNNNNNnK", ".KKKKKKKKKK.",
  ".KNKNK.KNKNK", ".KnKnK.KnKnK", ".KKKKK.KKKKK", "............",
];
SPR.lightInfantry = [
  "....KKKK..W.", "...KGGGGK.N.", "...KTTTTK.N.", "....KKKK..N.",
  "..KBBBBBBKN.", ".KTBBWWBBTKN", ".KKBBBBBBKKN", "..KBBBBBBK.N",
  "..KKKKKKKK.N", "..KDK..KDK.N", "..KDK..KDK..", ".KKKK..KKKK.",
];
SPR.antiArmorInfantry = [
  "....KKKK....", "...KllllK...", "...KTTTTK...", "....KKKKDDDK",
  "..KllllKGGOK", ".KTllllllKKK", "..KllllllK..", "..KKKKKKKK..",
  "..KDK..KDK..", "..KDK..KDK..", ".KKKK..KKKK.", "............",
];
SPR.lightVehicle = [
  "............", "............", "...KKKKKK...", "..KCCKCCK...",
  ".KKCCKCCKK..", "KYYYYYYYYYYK", "KYYYYYYYYOOK", "KKKKKKKKKKKK",
  ".KDDK..KDDK.", "KDGGDKKDGGDK", ".KKKK..KKKK.", "............",
];
SPR.heavyVehicle = [
  "............", "............", "....KKKK....", "...KLllKDDDK",
  "..KKllllKK..", ".KllllllllK.", "KLLLLLLLLLLK", "KKKKKKKKKKKK",
  "KDGDGDGDGDGK", "KDDDDDDDDDDK", ".KKKKKKKKKK.", "............",
];
SPR.artillery = [
  "............", "............", ".......KKKO.", "......KGGDDK",
  ".....KGDDDK.", "....KDDDDK..", "..KKNNNNK...", ".KNNNNNNNK..",
  ".KKKKKKKKKK.", ".KDDK..KDDK.", "KDGGDKKDGGDK", ".KKKK..KKKK.",
];
SPR.flyer = pad([
  ".....KK.....", "....KWWK....", "....KCCK....", "KK..KRRK..KK",
  "KWKKKRRKKKWK", "KWWWWRRWWWWK", "KGGGKRRKGGGK", ".KKKKRRKKKK.",
  "....KYYK....", "....KKKK....",
], 1);
SPR.missile = [
  "........KKK.", ".......KRRRK", "......KRWRRK", ".....KGWWRK.",
  "....KGWWGK..", "...KGWWGK...", "..KGGGGK....", ".KRRKGK.....",
  "KOYOKK......", ".KYYOK......", "..KOK.......", "...K........",
];
SPR.base = [
  ".....KKKK...", ".....KRRRK..", ".....KKKK...", ".....KGK....",
  "KGKGKKGKKGKG", "KGGYGGGGYGGK", "KgGGGDDGGGgK", "KGGGDDDDGGGK",
  "KGGGDDDDGGGK", "KGGGDDDDGGGK", "KKKKKKKKKKKK", "............",
];
SPR.barracks = [
  ".....KRR....", ".....K......", "....KRRK....", "...KRRRRK...",
  "..KRRrRRRK..", ".KRRRRRRRRK.", "KKKKKKKKKKKK", "KMMMMMMMMMMK",
  "KMBBMDDMBBMK", "KMBBMDDMBBMK", "KMMMMDDMMMMK", "KKKKKKKKKKKK",
];
SPR.foundry = [
  ".......GG...", "......GG....", "........KDDK", "........KDDK",
  "KKKKKKKKKDDK", "KNNNNNNNNNNK", "KNnNNnNNnNNK", "KNNNOOOONNNK",
  "KNnNOYYONnNK", "KNNNOYYONNNK", "KKKKKKKKKKKK", "............",
];
SPR.shipyard = [
  ".KKKKKKKKKK.", ".KOYOYOYOYK.", ".KgK.....KgK", ".KgK..KMKKgK",
  ".KgK.KMMMKgK", ".KgKKNNNNKgK", ".KgKNNNNNNgK", ".KgKKnnnnKgK",
  "KKKKKKKKKKKK", "BBbBBBbBBBbB", "BbBBBbBBBbBB", "............",
];
SPR.antiAir = pad([
  ".KK......KK.", ".KRK....KRK.", "..KGK..KGK..", "..KGK..KGK..",
  "...KGKKGK...", "...KGGGGK...", "..KDDDDDDK..", ".KgggggggggK",
  ".KDDDYYDDDK.", "KKKKKKKKKKKK",
], 1);
SPR.camp = [
  "....K..K....", ".....KK.....", ".....KNK....", "....KNNNK...",
  "...KNONNNK..", "..KNNOOONNK.", ".KNNNNnNNNNK", ".KNONNnnNONK",
  "KNNNNnnnNNNK", "KNNNNnnnNNNK", "KKKKKKKKKKKK", "............",
];
SPR.goods = [
  "............", "............", "..KKKKKKKK..", ".KYYWYYYYYK.",
  ".KYYYYYYOYK.", ".KKKKKKKKKK.", ".KNNNNNNNNK.", ".KNnNNNNnNK.",
  ".KNNNYYNNNK.", ".KNnNYYNnNK.", ".KKKKKKKKKK.", "............",
];
SPR.frigate = [
  "............", "............", ".....KRK....", "..KK.KMMK...",
  ".KMMKKMMMK..", ".KMMMKMMMMK.", ".KMMMKMMMMMK", "..KKKKKKKKK.",
  "KNNNNNNNNNNK", ".KNnnnnnnNK.", "..KKKKKKKK..", "............",
];
SPR.trireme = pad([
  ".....K......", ".....KMMM...", ".....KRRRR..", ".....KMMMM..",
  ".....K......", "KKNNNNNNNNKK", "KnnnnnnnnnnK", ".KKKKKKKKKK.",
  "K.K.K..K.K.K",
], 1);
SPR.carrier = pad([
  ".......KK...", "......KGGK..", "......KGWK..", "KKKKKKKKKKKK",
  "KGWGGGGGGWGK", "KgYgYgYgYggK", ".KDDDDDDDDK.", "..KKKKKKKK..",
], 2);
SPR.battleship = pad([
  ".....KK.....", "....KGGK....", ".KKKKGWKKKK.", ".KDDDKGKDDDK",
  "KGGGGGGGGGGK", "KgggggOggggK", ".KDDDDDDDDK.", "..KKKKKKKK..",
], 2);
SPR.tree = pad([
  "....KKKK....", "..KKLLLLKK..", ".KLLLllLLLK.", "KLLLllllLLLK",
  "KLLllllllLLK", "KLlllddllllK", ".KKllddllKK.", "....KNNK....",
  "....KNnK....", "....KKKK....",
], 1);
SPR.mountain = pad([
  "......KK....", ".....KWWK...", "....KWWWgK..", "...KWWgggDK.",
  "..KgggggDDDK", ".KgggDgggDDK", "KgggDDggDDDK", "KgDDDDDDDDDK",
  "KKKKKKKKKKKK",
], 2);
SPR.brave = recolor(SPR.lightInfantry, { G: "n", B: "R", b: "r", W: "Y" });
SPR.rocketTubeBrave = recolor(SPR.antiArmorInfantry, { l: "R", L: "O" });
SPR.mountedRocketTubeBrave = recolor(SPR.scout, { R: "Y", l: "R", L: "O", N: "S", n: "N" });
SPR.tankBrave = recolor(SPR.heavyVehicle, { l: "n", L: "N" });
// The game's real aliases: barbarian/AI units borrow another unit's icon.
const ALIAS = { aiSettler: "settler" };

function rectsOf(rows) {
  let s = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < 12) {
      const c = row[x];
      if (c === "." || !PAL[c]) { x++; continue; }
      let w = 1;
      while (x + w < 12 && row[x + w] === c) w++;
      s += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${PAL[c]}"/>`;
      x += w;
    }
  });
  return s;
}
const symbols = Object.entries(SPR)
  .map(([id, rows]) => {
    rows.forEach((r, i) => { if (r.length !== 12) throw new Error(`${id} row ${i} is ${r.length} wide: "${r}"`); });
    if (rows.length !== 12) throw new Error(`${id} has ${rows.length} rows`);
    return `<symbol id="n-${id}" viewBox="0 0 12 12">${rectsOf(rows)}</symbol>`;
  }).join("");
const nsvg = (id, cls) => `<svg class="${cls}" shape-rendering="crispEdges"><use href="#n-${id}"/></svg>`;

// ---------- NEW: terrain tiles (12x12 generated patterns) ----------
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tileSvg(base, marks) {
  const px = marks.map(([x, y, c, w = 1, h = 1]) =>
    `<rect x="${((x % 12) + 12) % 12}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges"><rect width="12" height="12" fill="${base}"/>${px}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
function scatter(seed, n, make) {
  const r = rng(seed); const out = [];
  for (let i = 0; i < n; i++) out.push(...make(Math.floor(r() * 10), Math.floor(r() * 10), r));
  return out;
}
const grass = (seed) => tileSvg("#45d65a", scatter(seed, 6, (x, y, r) =>
  r() < 0.75
    ? [[x, y + 1, "#2fae44"], [x + 2, y + 1, "#2fae44"], [x + 1, y, "#2fae44"]]
    : [[x, y, "#9bf58a"], [x + 1, y, "#9bf58a"]])
  .concat(seed % 2 ? [[8, 8, "#ffffff"], [9, 8, "#ff5ce0"]] : []));
const resource = (seed) => tileSvg("#ffd65c", scatter(seed, 7, (x, y) => [[x, y, "#f5a31a"], [x + 1, y, "#f5a31a"]])
  .concat([[2, 2, "#ffffff"], [1, 2, "#fff3b0"], [3, 2, "#fff3b0"], [2, 1, "#fff3b0"], [2, 3, "#fff3b0"]]));
const forestG = (seed) => tileSvg("#2ba048", scatter(seed, 8, (x, y) => [[x, y, "#1d7f37"], [x + 1, y + 1, "#1d7f37"]]));
const mountG = (seed) => tileSvg("#a49fd0", scatter(seed, 8, (x, y) => [[x, y, "#8680b8"], [x + 1, y, "#8680b8"], [x, y + 1, "#c3bfe6"]]));
const waterFrames = (seed) => {
  const r = rng(seed); const dashes = [];
  for (let i = 0; i < 4; i++) dashes.push([Math.floor(r() * 12), Math.floor(r() * 5) * 2 + 1]);
  const frame = (shift) => tileSvg("#2f86ff", dashes.flatMap(([x, y]) =>
    [[x + shift, y, "#7bbcff", 3], [x + shift + 3, y, "#1f5fd6", 2]]));
  return [frame(0), frame(2)];
};
const fog = tileSvg("#0b0b22", scatter(7, 10, (x, y) => [[x, y, "#181845"]]));
const [waveA, waveB] = waterFrames(3);

const tileCss = `
.ntile.plain.v0{background-image:${grass(1)}}
.ntile.plain.v1{background-image:${grass(2)}}
.ntile.plain.v2{background-image:${grass(5)}}
.ntile.resource{background-image:${resource(4)}}
.ntile.forest{background-image:${forestG(6)}}
.ntile.mountain{background-image:${mountG(9)}}
.ntile.water{background-image:${waveA};animation:wave 1.4s steps(1) infinite}
.ntile.unexplored{background-image:${fog}}
@keyframes wave{0%{background-image:${waveA}}50%{background-image:${waveB}}}
@media (prefers-reduced-motion:reduce){.ntile.water{animation:none}}
`;

const newCss = `
.neo{--ink:#fff4d6;--dim:#a9b3ff;--edge:#14142b;--team-player:#2fe39a;--team-ai:#ff4a5a;--team-natives:#ffb020;--team-barbarians:#a14dff;color:var(--ink)}
.neo .ntile{width:36px;height:36px;position:relative;display:flex;align-items:center;justify-content:center;background-size:36px 36px;image-rendering:pixelated}
.neo .ntile.selected{outline:3px solid #fff;outline-offset:-3px}
.neo .nfeat{position:absolute;inset:0;width:36px;height:36px}
.neo .nfeat24{width:24px;height:24px}
.neo .ntoken,.neo .nbase{width:30px;height:30px;border:3px solid var(--edge);display:flex;align-items:center;justify-content:center;
  clip-path:polygon(3px 0,calc(100% - 3px) 0,calc(100% - 3px) 3px,100% 3px,100% calc(100% - 3px),calc(100% - 3px) calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,3px calc(100% - 3px),0 calc(100% - 3px),0 3px,3px 3px);
  filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}
.neo .ntoken svg,.neo .nbase svg{width:24px;height:24px}
.neo .player{background:var(--team-player)}.neo .ai{background:var(--team-ai)}
.neo .natives{background:var(--team-natives)}.neo .barbarians{background:var(--team-barbarians)}
.neo .nhp{position:absolute;left:4px;right:4px;bottom:0;height:5px;background:var(--edge)}
.neo .nhp i{display:block;height:3px;margin:1px;background:#7cf23c}
.neo .nboard{display:grid;width:max-content}
.neo .nrow{display:flex;align-items:center;gap:10px;background:#2a2766;border:3px solid #14142b;padding:6px 8px;margin-bottom:6px}
.neo .nbadge{width:42px;height:42px;flex:none;background:var(--team-player);border:3px solid #14142b;display:flex;align-items:center;justify-content:center}
.neo .nbadge svg{width:30px;height:30px}
.neo .nname{font-weight:700;color:#fff4d6}
.neo .ndesc{font-size:11.5px;color:#a9b3ff}
`;

// ---------- page content (same structure for both sides) ----------
const UNITS = [
  ["harvester", "Harvester"], ["builder", "Builder"], ["settler", "Settler"], ["scout", "Scout"],
  ["lightInfantry", "Light Infantry"], ["antiArmorInfantry", "Anti-Armor Inf."], ["lightVehicle", "Light Vehicle"],
  ["heavyVehicle", "Heavy Vehicle"], ["artillery", "Artillery"], ["flyer", "Flyer"], ["missile", "Missile"],
  ["frigate", "Frigate"], ["trireme", "Trireme"], ["carrier", "Carrier"], ["battleship", "Battleship"],
  ["brave", "Brave"], ["rocketTubeBrave", "Rocket Brave"], ["mountedRocketTubeBrave", "Mounted Brave"], ["tankBrave", "Tank Brave"],
];
const BUILDINGS = [
  ["barracks", "Barracks", "+2 production per turn."],
  ["foundry", "Foundry", "+3 production per turn."],
  ["shipyard", "Shipyard", "Unlocks Frigates, Carriers, and Battleships. Requires a coastal city."],
  ["antiAir", "Anti-Air Battery", "Every one of your cities automatically fires on any enemy flying unit adjacent to it, every turn, for 1 damage."],
];
const OWNERS = ["player", "ai", "natives", "barbarians"];

const oTile = (cls, inner = "", extra = "") => `<div class="tile ${cls}" ${extra}>${inner}</div>`;
const oIcon = (id, kind) => `<svg class="${kind}"><use href="#icon-${id}"/></svg>`;
const oToken = (id, owner, hp = 1) =>
  `<div class="token ${owner}"><svg><use href="#icon-${id}"/></svg></div><div class="hp-pip"><div class="hp-pip-fill" style="width:${hp * 100}%"></div></div>`;
const oBase = (kind, owner) =>
  `<div class="base-token ${owner}"><svg><use href="#icon-${kind}"/></svg></div><div class="hp-pip"><div class="hp-pip-fill" style="width:100%"></div></div>`;

const nTile = (cls, inner = "") => `<div class="ntile ${cls}">${inner}</div>`;
const nToken = (id, owner, hp = 1) =>
  `<div class="ntoken ${owner}">${nsvg(ALIAS[id] || id, "")}</div><div class="nhp"><i style="width:${Math.round(hp * 100) - 2}%"></i></div>`;
const nBase = (kind, owner) =>
  `<div class="nbase ${owner}">${nsvg(kind, "")}</div><div class="nhp"><i style="width:98%"></i></div>`;

const bRowO = BUILDINGS.map(([id, name, desc]) =>
  '<div class="city-item"><div class="badge-mini"><svg><use href="#icon-' + id + '"/></svg></div><div style="flex:1"><div>' + name + '</div><div class="desc">' + desc + '</div></div></div>').join("");
const bRowN = BUILDINGS.map(([id, name, desc]) =>
  '<div class="nrow"><div class="nbadge">' + nsvg(id, "") + '</div><div style="flex:1"><div class="nname">' + name + '</div><div class="ndesc">' + desc + '</div></div></div>').join("");
const ZOOM = UNITS.concat([["base","Base"],["camp","Camp"],["goods","Goods"]], BUILDINGS.map(([id, n]) => [id, n]));
const zO = ZOOM.map(([id, n]) => '<div class="card"><svg class="zo" viewBox="0 0 12 12"><use href="#icon-' + (ALIAS[id] || id) + '"/></svg><span>' + n + '</span></div>').join("");
const zN = ZOOM.map(([id, n]) => '<div class="card"><svg class="zn" viewBox="0 0 12 12" shape-rendering="crispEdges"><use href="#n-' + id + '"/></svg><span>' + n + '</span></div>').join("");
const card = (tileHtml, label) => `<div class="card">${tileHtml}<span>${label}</span></div>`;

const terrainOrig = [
  card(oTile(""), "Plain"),
  card(oTile("resource", oIcon("goods", "goods-icon")), "Goods"),
  card(oTile("forest", oIcon("tree", "terrain-icon")), "Forest"),
  card(oTile("mountain", oIcon("mountain", "terrain-icon")), "Mountain"),
  card(oTile("water"), "Water"),
  card(oTile("unexplored"), "Unexplored"),
].join("");
const terrainNew = [
  card(nTile("plain v0"), "Plain"),
  card(nTile("resource", nsvg("goods", "nfeat nfeat24")), "Goods"),
  card(nTile("forest", nsvg("tree", "nfeat")), "Forest"),
  card(nTile("mountain", nsvg("mountain", "nfeat")), "Mountain"),
  card(nTile("water"), "Water"),
  card(nTile("unexplored"), "Unexplored"),
].join("");

const unitsOrig = UNITS.map(([id, label]) => card(oTile("", oToken(ALIAS[id] || id, "player", 0.85)), label)).join("");
const unitsNew = UNITS.map(([id, label]) => card(nTile("plain v1", nToken(id, "player", 0.85)), label)).join("");

const ownersOrig = OWNERS.map((o) => card(oTile("", oToken("lightInfantry", o)), o)).join("") +
  OWNERS.map((o) => card(oTile("", oBase(o === "natives" ? "camp" : "base", o)), o === "natives" ? "camp" : o + " base")).join("");
const ownersNew = OWNERS.map((o) => card(nTile("plain v1", nToken("lightInfantry", o)), o)).join("") +
  OWNERS.map((o) => card(nTile("plain v1", nBase(o === "natives" ? "camp" : "base", o)), o === "natives" ? "camp" : o + " base")).join("");

// A small map scene, identical layout on both sides.
const MAP = [
  "?~~~~~~~~~~~~~??",
  "~~.ff..~~~~mm.~~",
  "~.fff.r.~~.mmm.~",
  "~..r.....~..m..~",
  "~.....f..~...r.~",
  "~~...ff....~..~~",
  "~~~~..r..~~~~~~~",
  "~~~~~~~~~~~??~~~",
];
const PUT = {
  "2,4": ["base", "player"], "3,4": ["lightInfantry", "player", 0.9], "4,3": ["scout", "player"],
  "2,3": ["settler", "player"], "3,5": ["heavyVehicle", "player", 0.6], "1,6": ["frigate", "player"],
  "13,3": ["base", "ai"], "13,4": ["antiArmorInfantry", "ai", 0.8], "14,3": ["artillery", "ai"], "12,2": ["flyer", "ai", 0.5],
  "6,2": ["camp", "natives"], "5,3": ["brave", "natives"], "7,3": ["rocketTubeBrave", "natives", 0.7],
  "9,4": ["trireme", "barbarians"], "10,4": ["lightInfantry", "barbarians"],
};
MAP.forEach((r) => { if (r.length !== 16) throw new Error("map row width: " + r); });
const variant = (x, y) => "v" + ((x * 7 + y * 3) % 3);
let sceneO = "", sceneN = "";
MAP.forEach((row, y) => [...row].forEach((c, x) => {
  const put = PUT[x + "," + y];
  const isBase = put && (put[0] === "base" || put[0] === "camp");
  const terr = { "~": "water", ".": "plain", f: "forest", m: "mountain", r: "resource", "?": "unexplored" }[c];
  let oi = "", ni = "";
  if (put && isBase) { oi = oBase(put[0], put[1]); ni = nBase(put[0], put[1]); }
  else if (put) { oi = oToken(ALIAS[put[0]] || put[0], put[1], put[2] || 1); ni = nToken(put[0], put[1], put[2] || 1); }
  else if (c === "r") { oi = oIcon("goods", "goods-icon"); ni = nsvg("goods", "nfeat nfeat24"); }
  else if (c === "f") { oi = oIcon("tree", "terrain-icon"); ni = nsvg("tree", "nfeat"); }
  else if (c === "m") { oi = oIcon("mountain", "terrain-icon"); ni = nsvg("mountain", "nfeat"); }
  const oc = c === "~" ? "water" : c === "." ? "" : c === "f" ? "forest" : c === "m" ? "mountain" : c === "r" ? "resource" : "unexplored";
  sceneO += oTile(oc, oi);
  sceneN += nTile(terr === "plain" ? "plain " + variant(x, y) : terr, ni);
}));

const section = (title, note, o, n, cls = "cards") => `
<h2>${title}</h2>${note ? `<p class="note">${note}</p>` : ""}
<div class="pair">
  <div class="side orig" data-theme="dark"><h3>Current</h3><div class="${cls}">${o}</div></div>
  <div class="side neo"><h3>Bright 8-bit</h3><div class="${cls}">${n}</div></div>
</div>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>First Reckoning - art comparison</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;padding:20px 16px 60px;background:#101018;color:#e8e6f5;font:14px/1.5 system-ui,sans-serif}
.page{max-width:1320px;margin:0 auto}
h1{margin:0 0 4px;font-size:26px}
h2{margin:34px 0 4px;font-size:18px;border-bottom:1px solid #2c2c44;padding-bottom:6px}
h3{margin:0 0 10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.7;font-weight:600}
.note{margin:2px 0 10px;color:#9a9ab8;font-size:13px}
.lede{color:#9a9ab8;margin:0 0 6px;max-width:80ch}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.pair{grid-template-columns:1fr}}
.side{border-radius:6px;padding:14px;overflow:auto}
.orig{background:var(--panel);border:1px solid var(--edge);color:var(--ink)}
.neo{background:#1d1b4a;border:3px solid #14142b;box-shadow:0 0 0 2px #5b4bff inset;color:#fff4d6}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px 8px}
.card{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;text-align:center;opacity:.95}
.card .tile,.card .ntile{flex:none}
.zoomgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:12px 8px}.zo,.zn{width:72px;height:72px}.zo{background:#3a3326;border-radius:4px}.zn{background:#52d65a}
.themebtn{float:right;background:#242440;color:#e8e6f5;border:1px solid #3c3c60;border-radius:4px;padding:6px 12px;cursor:pointer;font:inherit}
.orig .board{gap:0}
.orig .board .tile{border:0;border-radius:0}
.neo .nboard{grid-template-columns:repeat(16,36px)}
${origCss}
${newCss}
${tileCss}
</style></head>
<body><div class="page">
<button class="themebtn" id="themebtn">Current art: dark theme (click for light)</button>
<h1>First Reckoning - art comparison</h1>
<p class="lede">Left is the game's current art, rendered from the real <code>src/</code> files. Right is a bright 8-bit redesign: saturated NES-style palette, black pixel outlines, textured tiles, animated water, and chunky team-coloured unit badges. Every icon stays on the same 12x12 grid, so it can drop straight into the game.</p>

${section("Terrain", "Plain is now grass; goods tiles glitter gold; the water has a two-frame wave.", terrainOrig, terrainNew)}
${section("City buildings", "As they appear in the city panel. Your current icons are 22px dots; the new ones get a bigger pixel badge so the detail shows.", '<div class="city-list">' + bRowO + '</div>', bRowN, "list")}
${section("Close-up", "Every icon at 6x. The current base, camp and goods icons are single-colour silhouettes that the game tints, so they show black here.", zO, zN, "zoomgrid")}
${section("Units", "All 19 unit icons, shown on the player's team colour.", unitsOrig, unitsNew)}
${section("Team colours and bases", "Light Infantry per faction, then each faction's base (natives get a camp).", ownersOrig, ownersNew)}
${section("In context", "A small map: your island at the left, an AI base at the right, a native camp in the middle, and a barbarian raid offshore. Some tiles are still unexplored.",
  `<div class="board" style="--cols:16;--rows:8;--tile-px:34px">${sceneO}</div>`, `<div class="nboard">${sceneN}</div>`, "scene")}

</div>
<div style="position:absolute;width:0;height:0;overflow:hidden">${origSymbols}<svg width="0" height="0"><defs>${symbols}</defs></svg></div>
<script>
var btn=document.getElementById('themebtn'),dark=true;
btn.onclick=function(){dark=!dark;document.querySelectorAll('.orig').forEach(function(e){e.setAttribute('data-theme',dark?'dark':'light')});
btn.textContent='Current art: '+(dark?'dark':'light')+' theme (click for '+(dark?'light':'dark')+')'};
</script></body></html>`;

fs.writeFileSync(path.join(__dirname, "art-compare.html"), html);
console.log("wrote mockups/art-compare.html", Math.round(html.length / 1024) + " KB");
