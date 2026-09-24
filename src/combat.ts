// Phase 0 prototype — turn-based combat resolution.
// Goal: transparent, predictable outcomes (visible odds, no hidden dice)
// so a lost fight reads as a bad decision, not bad luck.

import { UnitType } from "./units";

export interface CombatUnit {
  type: UnitType;
  currentHp: number;
}

export interface CombatResult {
  attacker: CombatUnit;
  defender: CombatUnit;
  damageToDefender: number;
  damageToAttacker: number;
  defenderDestroyed: boolean;
  attackerDestroyed: boolean;
}

/** Attack multiplier from the attacker's type vs. the defender's category, default 1. */
function attackMultiplier(attacker: UnitType, defenderCategory: UnitType["category"]): number {
  return attacker.attackBonusVs[defenderCategory] ?? 1;
}

/** Flat defense ignored on the defender, from the attacker's armor penetration vs. its category, default 0. */
function armorPenetration(attacker: UnitType, defenderCategory: UnitType["category"]): number {
  return attacker.armorPenetrationVs?.[defenderCategory] ?? 0;
}

/** Shared damage formula: (attack * multiplier) - (defense - penetration), floored at 1. */
function computeDamage(attacker: UnitType, defender: UnitType): number {
  const mult = attackMultiplier(attacker, defender.category);
  const penetration = armorPenetration(attacker, defender.category);
  const effectiveDefense = Math.max(0, defender.defense - penetration);
  const raw = attacker.attack * mult - effectiveDefense;
  return Math.max(1, Math.round(raw));
}

/**
 * Resolves one attack. The attacker strikes first; if the defender
 * survives and is a combat-capable unit, it strikes back once
 * (simple simultaneous-round model for Phase 0 — no multi-round loop yet).
 */
export function resolveAttack(attacker: CombatUnit, defender: CombatUnit): CombatResult {
  const damageToDefender = computeDamage(attacker.type, defender.type);

  const newDefenderHp = Math.max(0, defender.currentHp - damageToDefender);
  const defenderDestroyed = newDefenderHp === 0;
  defender.currentHp = newDefenderHp;

  let damageToAttacker = 0;
  let attackerDestroyed = false;

  // Defender strikes back only if it survived and can actually fight.
  if (!defenderDestroyed && defender.type.attack > 0) {
    damageToAttacker = computeDamage(defender.type, attacker.type);
    const newAttackerHp = Math.max(0, attacker.currentHp - damageToAttacker);
    attackerDestroyed = newAttackerHp === 0;
    attacker.currentHp = newAttackerHp;
  }

  return {
    attacker,
    defender,
    damageToDefender,
    damageToAttacker,
    defenderDestroyed,
    attackerDestroyed,
  };
}

/** Returns predicted damage in each direction without mutating state — "visible odds" for the player. */
export function previewAttack(attacker: CombatUnit, defender: CombatUnit) {
  const damageToDefender = computeDamage(attacker.type, defender.type);
  const damageToAttacker = defender.type.attack > 0 ? computeDamage(defender.type, attacker.type) : 0;
  return { damageToDefender, damageToAttacker };
}
