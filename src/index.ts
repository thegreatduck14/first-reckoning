// Phase 0 test harness — no map, no turns yet. Just: does the combat
// formula feel right? Run each roster matchup and print the odds.

import { UNIT_TYPES, UnitType } from "./units";
import { CombatUnit, previewAttack, resolveAttack } from "./combat";

function freshUnit(type: UnitType): CombatUnit {
  return { type, currentHp: type.hp };
}

function describeMatchup(attackerId: string, defenderId: string) {
  const attacker = freshUnit(UNIT_TYPES[attackerId]);
  const defender = freshUnit(UNIT_TYPES[defenderId]);
  const odds = previewAttack(attacker, defender);
  console.log(
    `${attacker.type.name.padEnd(20)} attacks ${defender.type.name.padEnd(20)} -> ` +
      `deals ${odds.damageToDefender}, takes ${odds.damageToAttacker} back ` +
      `(defender HP ${defender.type.hp}, attacker HP ${attacker.type.hp})`
  );
}

console.log("=== Phase 0: unit roster matchup odds ===\n");

const matchups: [string, string][] = [
  ["lightInfantry", "lightVehicle"],
  ["antiArmorInfantry", "lightVehicle"],
  ["antiArmorInfantry", "heavyVehicle"],
  ["lightVehicle", "lightInfantry"],
  ["heavyVehicle", "antiArmorInfantry"],
  ["artillery", "heavyVehicle"],
  ["flyer", "lightInfantry"],
  ["lightVehicle", "harvester"],
  ["brave", "lightInfantry"],
  ["rocketTubeBrave", "lightInfantry"],
  ["rocketTubeBrave", "lightVehicle"],
  ["mountedRocketTubeBrave", "lightVehicle"],
  ["tankBrave", "heavyVehicle"],
  ["antiArmorInfantry", "tankBrave"],
  ["tankBrave", "antiArmorInfantry"],
];

for (const [a, d] of matchups) {
  describeMatchup(a, d);
}

console.log("\n=== Fight to resolution: Anti-Armor Infantry vs Heavy Vehicle ===\n");

const infantry = freshUnit(UNIT_TYPES.antiArmorInfantry);
const tank = freshUnit(UNIT_TYPES.heavyVehicle);

let round = 1;
while (infantry.currentHp > 0 && tank.currentHp > 0 && round <= 5) {
  const result = resolveAttack(infantry, tank);
  console.log(
    `Round ${round}: infantry deals ${result.damageToDefender} (tank HP -> ${tank.currentHp}), ` +
      `tank returns ${result.damageToAttacker} (infantry HP -> ${infantry.currentHp})`
  );
  if (result.defenderDestroyed) {
    console.log("Tank destroyed.");
    break;
  }
  if (result.attackerDestroyed) {
    console.log("Infantry destroyed.");
    break;
  }
  round++;
}
