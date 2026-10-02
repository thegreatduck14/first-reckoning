  // ---------- COMBAT (mirrors src/combat.ts) ----------
  function attackMultiplier(a, cat) { return (a.attackBonusVs && a.attackBonusVs[cat]) || 1; }
  function armorPenetration(a, cat) { return (a.armorPenetrationVs && a.armorPenetrationVs[cat]) || 0; }
  // Extra flat defense a unit gets specifically against attackers of a given
  // category — e.g. the Harvester shrugs off almost all of an Infantry unit's
  // counterattack when it runs one over, while staying fragile to everyone else.
  function defenseBonusVs(d, attackerCat) { return (d.defenseBonusVs && d.defenseBonusVs[attackerCat]) || 0; }
  // An attacker-side bonus keyed by the TARGET's own tile terrain (not the
  // attacker's) — e.g. the Missile hits 50% harder against a unit or city
  // standing on a mountain. Distinct from defenseBonus(terrain), which is
  // the defender's own terrain bonus to its defense stat.
  function attackTerrainMultiplier(attacker, targetTerrain) {
    return 1 + ((attacker.attackTerrainBonus && attacker.attackTerrainBonus[targetTerrain]) || 0);
  }
  function computeDamage(attacker, defender, terrainBonus, targetTerrain) {
    var mult = attackMultiplier(attacker, defender.category);
    var terrainMult = attackTerrainMultiplier(attacker, targetTerrain);
    var pen = armorPenetration(attacker, defender.category);
    var bonusDef = defenseBonusVs(defender, attacker.category);
    var effDef = Math.max(0, defender.defense + (terrainBonus || 0) + bonusDef - pen);
    return Math.max(1, Math.round(attacker.attack * mult * terrainMult - effDef));
  }

