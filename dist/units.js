"use strict";
// Phase 0 prototype — shared unit roster (see plan doc section 4).
// Every faction builds from this same list; no per-faction unique units.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIT_TYPES = void 0;
exports.UNIT_TYPES = {
    harvester: {
        id: "harvester",
        name: "Harvester",
        category: "economy",
        attack: 0,
        defense: 1,
        hp: 8,
        movement: 2,
        cost: 4,
        attackBonusVs: {},
        notes: "Gathers the strategic resource. Unarmed — a raid target, not a fighter.",
    },
    lightInfantry: {
        id: "lightInfantry",
        name: "Light Infantry",
        category: "infantry",
        attack: 3,
        defense: 2,
        hp: 6,
        movement: 1,
        cost: 2,
        attackBonusVs: {},
    },
    antiArmorInfantry: {
        id: "antiArmorInfantry",
        name: "Anti-Armor Infantry",
        category: "infantry",
        attack: 3,
        defense: 4, // bumped from 2 — needs to survive a hit back to actually trade with vehicles
        hp: 9, // bumped from 6, same reason
        movement: 1,
        cost: 3,
        attackBonusVs: {},
        armorPenetrationVs: { vehicle: 3 }, // ignores up to 3 points of vehicle defense — the counter vs. vehicles
    },
    scout: {
        id: "scout",
        name: "Scout",
        category: "vehicle",
        attack: 0,
        defense: 1,
        hp: 4,
        movement: 4,
        cost: 2,
        attackBonusVs: {},
        notes: "No combat power. Reveals the map.",
    },
    lightVehicle: {
        id: "lightVehicle",
        name: "Light Vehicle",
        category: "vehicle",
        attack: 5,
        defense: 2,
        hp: 8,
        movement: 3,
        cost: 4,
        attackBonusVs: { infantry: 1.5 }, // fast attacker, strong vs. infantry in the open
    },
    heavyVehicle: {
        id: "heavyVehicle",
        name: "Heavy Vehicle",
        category: "vehicle",
        attack: 8,
        defense: 3, // lowered from 6 — armor comes from HP, not from shrugging off hits entirely
        hp: 14,
        movement: 1,
        cost: 8,
        attackBonusVs: { infantry: 1.25 },
    },
    artillery: {
        id: "artillery",
        name: "Artillery",
        category: "siege",
        attack: 10,
        defense: 1,
        hp: 6,
        movement: 1,
        cost: 7,
        attackBonusVs: {}, // "vs. bases" handled separately, not vs. other units
        notes: "Long range, strong vs. bases, weak in melee.",
    },
    // --- Native faction tier (Colonization-style) ---
    // Deliberately breaks the "one roster, every faction" pillar — flag
    // this in the plan doc once confirmed. Stats below marked (given) came
    // from Adam directly; (assumed) are placeholders pending confirmation.
    brave: {
        id: "brave",
        name: "Brave",
        category: "infantry",
        attack: 1, // given
        defense: 1, // given
        hp: 4,
        movement: 1,
        cost: 1,
        attackBonusVs: {},
        notes: "Base native unit, unarmed with modern weapons.",
    },
    rocketTubeBrave: {
        id: "rocketTubeBrave",
        name: "Rocket Tube Brave",
        category: "infantry",
        attack: 4, // given
        defense: 4, // given
        hp: 6,
        movement: 1,
        cost: 3,
        attackBonusVs: {},
        notes: "Brave armed with a rocket tube.",
    },
    mountedRocketTubeBrave: {
        id: "mountedRocketTubeBrave",
        name: "Mounted Rocket Tube Brave",
        category: "infantry", // horse-mounted, not armored — stays out of the vehicle counter chain
        attack: 6, // given
        defense: 4, // assumed — unchanged from the foot version; flag if mounted should trade defense for the movement gain
        hp: 7,
        movement: 3, // mounted — faster than the foot tiers
        cost: 5,
        attackBonusVs: {},
        notes: "Rocket Tube Brave on horseback — faster, same firepower.",
    },
    tankBrave: {
        id: "tankBrave",
        name: "Indian in Tank",
        category: "vehicle", // armored — this tier does interact with anti-armor counters
        attack: 8, // given
        defense: 3, // assumed — mirrors Heavy Vehicle's current defense; flag if this tier should be tankier or squishier than the colonial Heavy Vehicle
        hp: 14,
        movement: 1,
        cost: 8, // placeholder production cost — real cost is the 100 tools below; no economy system yet to spend it
        toolsCost: 100, // given
        attackBonusVs: {},
        notes: "Native unit crewing a captured/acquired tank. Same weight class as the colonial Heavy Vehicle.",
    },
    flyer: {
        id: "flyer",
        name: "Ornithopter",
        category: "air",
        attack: 6,
        defense: 2,
        hp: 7,
        movement: 5,
        cost: 9,
        attackBonusVs: {},
        notes: "Ignores ground terrain. Vulnerable to dedicated anti-air only (not modeled yet).",
    },
};
