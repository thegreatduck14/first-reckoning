  // ---------- DATA ----------
  var BUILDER_REPAIR_HP = 3;
  var MEDIC_HEAL_HP = 2;
  var UNIT_TYPES = {
    harvester: { id: "harvester", name: "Harvester", short: "HV", category: "economy", domain: "land", attack: 4, defense: 1, hp: 8, movement: 2, cost: 4, attackOnly: "infantry", defenseBonusVs: { infantry: 5 }, notes: "Unarmored, but its bulk can run over an adjacent enemy Infantry unit — can't target anything else. Takes very little damage back from the Infantry it tramples; still fragile against everything else." },
    builder: { id: "builder", name: "Builder", short: "BL", category: "economy", domain: "land", attack: 0, defense: 1, hp: 6, movement: 2, cost: 4, notes: "Unarmed. Sit it next to a damaged friendly city and it repairs " + BUILDER_REPAIR_HP + " HP of that city's walls every turn (never above the city's max HP)." },
    settler: { id: "settler", name: "Settler", short: "ST", category: "economy", domain: "land", attack: 1, defense: 1, hp: 6, movement: 2, cost: 6, cargoSlotCost: 2, canFoundCity: true, notes: "Select it and use Found City on open ground away from existing cities to start a new one — it's consumed in the founding. Takes 2 cargo slots aboard a ship." },
    aiSettler: { id: "aiSettler", name: "Settler", short: "ST", category: "economy", domain: "land", attack: 1, defense: 0, hp: 6, movement: 2, cost: 6, cargoSlotCost: 2, canFoundCity: true, icon: "settler", notes: "The AI's colonizing arm — a bit weaker in defense than yours." },
    scout: { id: "scout", name: "Scout", short: "SC", category: "vehicle", domain: "land", attack: 0, defense: 1, hp: 4, movement: 4, cost: 2 },
    lightInfantry: { id: "lightInfantry", name: "Light Infantry", short: "LI", category: "infantry", domain: "land", attack: 3, defense: 2, hp: 6, movement: 1, cost: 4, attackBonusVs: {} },
    antiArmorInfantry: { id: "antiArmorInfantry", name: "Anti-Armor Infantry", short: "AA", category: "infantry", domain: "land", attack: 3, defense: 4, hp: 9, movement: 1, cost: 3, attackBonusVs: {}, armorPenetrationVs: { vehicle: 3 } },
    lightVehicle: { id: "lightVehicle", name: "Light Vehicle", short: "LV", category: "vehicle", domain: "land", attack: 5, defense: 2, hp: 8, movement: 3, cost: 4, attackBonusVs: { infantry: 1.5 } },
    heavyVehicle: { id: "heavyVehicle", name: "Heavy Vehicle", short: "HV2", category: "vehicle", domain: "land", attack: 8, defense: 3, hp: 14, movement: 1, cost: 8, attackBonusVs: { infantry: 1.25 } },
    artillery: { id: "artillery", name: "Artillery", short: "AR", category: "siege", domain: "land", attack: 10, defense: 1, hp: 6, movement: 1, cost: 9, attackBonusVs: {} },
    flyer: { id: "flyer", name: "Ornithopter", short: "OR", category: "air", domain: "land", attack: 5, defense: 2, hp: 7, movement: 5, cost: 9, attackBonusVs: {}, notes: "Ignores terrain entirely, ocean included — it never needs a ship to cross water. Any enemy ship (or other unit) adjacent to it can still attack it while it's over open water, same as anywhere else." },
    // Player-exclusive — see the tech tree's playerOnly flag on the tech
    // that unlocks it (Guided Missiles) and tickFaction, which refuses to
    // ever let the AI complete that tech. A flying unit like the Ornithopter
    // (ignores terrain, ocean included), but a fragile glass cannon: high
    // attack, thin defense, no counterattack survivability to speak of.
    // attackTerrainBonus applies only when it's the attacker and only looks
    // at the TARGET's tile — +50% attack against a unit or city standing on
    // a mountain (see computeDamage/previewCombat).
    missile: { id: "missile", name: "Missile", short: "MS", category: "air", domain: "land", attack: 14, defense: 2, hp: 6, movement: 5, cost: 55, attackBonusVs: {}, attackTerrainBonus: { mountain: 0.5 }, oneTimeUse: true, notes: "Player-only. Flies over any terrain, ocean included, same as an Ornithopter. Deals 50% more damage when striking a unit or city that's standing on a mountain. One-time use — it's spent and disappears the instant it attacks, hit or miss, whether the target is a unit, a city, or natives. Immune to Anti-Air Batteries — no enemy city's anti-air defense can shoot it down before it hits." },
    // Player-only, unlocked by the Ultimate Destruction tech. Absurd attack, modest defense.
    poo: { id: "poo", name: "Poo", short: "PO", category: "vehicle", domain: "land", attack: 999999999, defense: 15, hp: 20, movement: 2, cost: 867, attackBonusVs: {}, notes: "Player-only. Unlocked by Ultimate Destruction. Hits for 999999999." },
    // Added units. Raider Jeep: fast and flimsy, shreds Harvesters/Settlers.
    jeep: { id: "jeep", name: "Raider Jeep", short: "RJ", category: "vehicle", domain: "land", attack: 4, defense: 1, hp: 6, movement: 5, cost: 5, attackBonusVs: { economy: 2 }, notes: "Very fast raider. Hits economy units (Harvesters, Settlers, Builders) twice as hard." },
    // Medic: unarmed; heals friendly units standing next to it each turn.
    medic: { id: "medic", name: "Medic", short: "MD", category: "infantry", domain: "land", attack: 0, defense: 1, hp: 6, movement: 2, cost: 5, notes: "Unarmed. Heals " + MEDIC_HEAL_HP + " HP on every friendly unit next to it at the end of each turn." },
    // Commando: shoots from 2 tiles away, and a target that isn't also ranged can't hit back.
    commando: { id: "commando", name: "Commando", short: "CM", category: "infantry", domain: "land", attack: 7, defense: 1, hp: 5, movement: 2, cost: 7, range: 2, attackBonusVs: {}, notes: "Attacks from up to 2 tiles away; targets that aren't ranged can't hit back at that distance. Fragile up close." },
    // Submarine: hunts ships only, and can't be seen unless an enemy is next to it.
    submarine: { id: "submarine", name: "Submarine", short: "SM", category: "naval", domain: "naval", attack: 8, defense: 3, hp: 12, movement: 3, cost: 45, attackOnly: "naval", attackBonusVs: {}, notes: "Attacks ships only. Hidden from enemies unless one is on an adjacent tile." },
    frigate: { id: "frigate", name: "Frigate", short: "FR", category: "naval", domain: "naval", attack: 6, defense: 4, hp: 10, movement: 4, cost: 30, capacity: 3, attackBonusVs: {}, notes: "One is pre-placed per side at the start; after that it's built at a coastal city with a Shipyard. Carries up to 3 cargo slots (a Settler takes 2); if it sinks, everything aboard sinks with it." },
    carrier: { id: "carrier", name: "Carrier", short: "CV", category: "naval", domain: "naval", attack: 2, defense: 7, hp: 16, movement: 3, cost: 40, capacity: 5, attackBonusVs: {}, notes: "Weak offense, but a tough hull built to ferry troops — 5 cargo slots (a Settler takes 2)." },
    battleship: { id: "battleship", name: "Battleship", short: "BB", category: "naval", domain: "naval", attack: 10, defense: 10, hp: 22, movement: 3, cost: 80, capacity: 1, attackBonusVs: {}, notes: "The heaviest warship afloat. Only 1 cargo slot — too tight for a Settler (needs 2)." },
    // Native garrison roster — matches the tiers proven out in The Reckoning
    // Table (Phase 0). These are never buildable by the player or the AI;
    // they only ever appear pre-placed as a native camp's garrison.
    brave: { id: "brave", name: "Brave", short: "BR", category: "infantry", domain: "land", attack: 1, defense: 1, hp: 4, movement: 1, cost: 1, attackBonusVs: {}, notes: "Base native unit, unarmed with modern weapons." },
    rocketTubeBrave: { id: "rocketTubeBrave", name: "Rocket Tube Brave", short: "RT", category: "infantry", domain: "land", attack: 4, defense: 4, hp: 6, movement: 1, cost: 3, attackBonusVs: {}, notes: "Brave armed with a rocket tube." },
    mountedRocketTubeBrave: { id: "mountedRocketTubeBrave", name: "Mounted Rocket Tube Brave", short: "MR", category: "infantry", domain: "land", attack: 6, defense: 4, hp: 7, movement: 3, cost: 5, attackBonusVs: {}, notes: "Rocket Tube Brave on horseback — faster, same firepower." },
    tankBrave: { id: "tankBrave", name: "Indian in Tank", short: "IT", category: "vehicle", domain: "land", attack: 8, defense: 3, hp: 14, movement: 1, cost: 8, attackBonusVs: {}, notes: "Native unit crewing a captured tank — same weight class as the colonial Heavy Vehicle." },
    trireme: { id: "trireme", name: "Trireme", short: "TR", category: "naval", domain: "naval", attack: 2, defense: 2, hp: 8, movement: 3, cost: 5, capacity: 2, attackBonusVs: {}, notes: "A native boat, crewed from a coastal camp's own garrison. Carries up to 2 cargo slots." },
    // Barbarian roster — a fourth, fully hostile faction that raids by sea
    // starting turn 30 (see maybeSpawnBarbarians/runBarbarianTurn). Never
    // buildable by the player, the AI, or anyone else; these only ever
    // appear aboard a landing party's own Sail Boat. They reuse existing
    // icon art (tinted by the barbarian token color) rather than needing
    // brand new symbols.
    barbarianLegion: { id: "barbarianLegion", name: "Barbarian Legion", short: "LG", category: "infantry", domain: "land", attack: 3, defense: 3, hp: 6, movement: 1, cost: 1, attackBonusVs: {}, icon: "lightInfantry", notes: "Raider foot soldier, put ashore by a Sail Boat." },
    barbarianTrike: { id: "barbarianTrike", name: "Barbarian Trike", short: "TK", category: "vehicle", domain: "land", attack: 4, defense: 4, hp: 8, movement: 3, cost: 1, attackBonusVs: {}, icon: "lightVehicle", notes: "Fast raider vehicle, put ashore by a Sail Boat." },
    barbarianSailboat: { id: "barbarianSailboat", name: "Barbarian Sail Boat", short: "SB", category: "naval", domain: "naval", attack: 2, defense: 3, hp: 8, movement: 3, cost: 5, capacity: 4, attackBonusVs: {}, icon: "trireme", notes: "Carries up to 4 raiders ashore, then keeps raiding the coast on its own." },
    barbarianRobber: { id: "barbarianRobber", name: "Barbarian Robber", short: "RB", category: "infantry", domain: "land", attack: 1, defense: 2, hp: 3, movement: 2, cost: 1, attackBonusVs: {}, icon: "scout", notes: "Never picks a fight — sneaks up on a city, steals a researched design, and vanishes on the spot." }
  };
  var BASE_STATS = { name: "Base", attack: 0, defense: 5, hp: 20, category: "base" };
  // A native camp fights back on its own — much tougher than an ordinary
  // city, which has no attack of its own and relies entirely on its garrison.
  var NATIVE_CAMP_STATS = { name: "Native Camp", attack: 5, defense: 2, hp: 20, category: "base" };
  var NATIVE_CAMP_MAX = 6; // hard cap on how many native camps ever exist on the map
  // Weighted so most camps are lightly held, with an occasional armed,
  // mounted, or tank-garrisoned camp to keep raiding them risky.
  var NATIVE_GARRISON_POOL = ["brave", "brave", "brave", "rocketTubeBrave", "rocketTubeBrave", "mountedRocketTubeBrave", "tankBrave"];

  // Barbarians start showing up at this turn (and every turn after it —
  // "and other turns above that level"), rolling BARBARIAN_SPAWN_CHANCE odds
  // each turn to launch a new landing party, capped so raids never snowball
  // into more than BARBARIAN_MAX_ACTIVE_BOATS parties in play at once.
  // Robbers are deliberately rare in the mix — see BARBARIAN_UNIT_POOL.
  var BARBARIAN_START_TURN = 30;
  var BARBARIAN_SPAWN_CHANCE = 0.35;
  var BARBARIAN_MAX_ACTIVE_BOATS = 3;
  var BARBARIAN_PARTY_MIN = 2;
  var BARBARIAN_PARTY_MAX = 4;
  var BARBARIAN_UNIT_POOL = ["barbarianLegion", "barbarianLegion", "barbarianLegion", "barbarianLegion",
    "barbarianTrike", "barbarianTrike", "barbarianTrike", "barbarianTrike", "barbarianRobber"];

  // Hard mode only: the barbarians get 1-2 actual cities of their own (see
  // placeBarbarianCities), each much frailer than a real city or a native
  // camp (8 HP vs. 20), and their economy runs at a fraction of a normal
  // faction's speed (BARBARIAN_PROD_MULT). They can only ever build a
  // Shipyard, then Sail Boats — Frigates only unlock if a Robber manages to
  // steal "frigate" specifically from the player or the AI (see
  // runBarbarianRobberSteal). They never get Anti-Air, Barracks, or Foundry.
  var BARBARIAN_CITY_STATS = { name: "Barbarian City", attack: 0, defense: 5, hp: 8, category: "base" };
  var BARBARIAN_CITY_MAX = 2;
  var BARBARIAN_PROD_MULT = 0.5;
  var BARBARIAN_BUILDING_ORDER = ["shipyard"];

  function cargoSlotCost(typeId) { return UNIT_TYPES[typeId].cargoSlotCost || 1; }
  // Some unit types (e.g. the AI's aiSettler) reuse another type's icon
  // symbol rather than having their own.
  function iconIdFor(type) { return type.icon || type.id; }
  function cargoOccupied(shipUnit) {
    return shipUnit.cargo.reduce(function (sum, c) { return sum + cargoSlotCost(c.typeId); }, 0);
  }

  var TECHS = [
    { id: "tech1", name: "Armor Piercing", cost: 6, unlocks: ["antiArmorInfantry", "lightVehicle", "jeep"] },
    { id: "tech2", name: "Heavy Fabrication", cost: 14, unlocks: ["heavyVehicle", "artillery", "medic", "commando"] },
    { id: "tech3", name: "Flight", cost: 24, unlocks: ["flyer"] },
    // playerOnly: the AI (and, in principle, any other faction that ever ran
    // through TECHS) never actually completes this tier — see tickFaction,
    // which stops advancing techIndex here for anyone but the player. Its
    // research keeps accruing past this point, it just never spends it.
    { id: "tech4", name: "Guided Missiles", cost: 30, unlocks: ["missile"], playerOnly: true },
    { id: "tech5", name: "Ultimate Destruction", cost: 60, unlocks: ["poo"], playerOnly: true }
  ];
  var STARTING_UNLOCKS = ["harvester", "scout", "settler", "lightInfantry", "builder"];
  var MIN_CITY_DISTANCE = 4; // Chebyshev tiles a new city must keep from every existing city

  var ANTI_AIR_DAMAGE = 1;
  var BUILDING_TYPES = {
    barracks: { id: "barracks", name: "Barracks", cost: 10, prodBonus: 2, desc: "+2 production per turn." },
    foundry: { id: "foundry", name: "Foundry", cost: 20, prodBonus: 3, desc: "+3 production per turn." },
    shipyard: { id: "shipyard", name: "Shipyard", cost: 60, prodBonus: 0, desc: "Unlocks Frigates, Carriers, Battleships, and Submarines. Requires a coastal city.", grantsUnlocks: ["frigate", "carrier", "battleship", "submarine"] },
    antiAir: { id: "antiAir", name: "Anti-Air Battery", cost: 200, prodBonus: 0, desc: "Every one of your cities automatically fires on any enemy flying unit adjacent to it, every turn, for " + ANTI_AIR_DAMAGE + " damage." }
  };
  var BUILDING_ORDER = ["barracks", "foundry", "shipyard", "antiAir"];

  // ---------- MAP GENERATION ----------
  // A big ocean seeded with several separate islands — a couple of large
  // ones (the player's and the AI's home turf) plus a scatter of small and
  // medium ones in between for settlers to sail to and colonize. Regenerated
  // fresh every new game, so no two playthroughs share a map.
  var COLS = 28, ROWS = 18;
  var TILE_PX = 36;
  var TERRAIN_GRID = null;   // [y][x] -> "water" | "plain" | "forest" | "mountain"
  var RESOURCE_GRID = null;  // [y][x] -> bool
  var RESOURCE_LIST = [];    // flat [[x,y],...] mirror of RESOURCE_GRID, for AI pathing
  var ISLAND_GRID = null;    // [y][x] -> island index, or -1 for water

