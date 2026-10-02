  function terrainAt(x, y) {
    if (!inBounds(x, y)) return "water";
    return TERRAIN_GRID[y][x];
  }

  function inBoundsRaw(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

  // Grows a blobby island of roughly targetSize tiles from a seed tile via
  // randomized frontier expansion. Refuses to expand into any tile whose
  // 8-neighborhood already touches a DIFFERENT island, so islands never
  // merge or end up sharing a coastline — crossing between them always
  // means going by water.
  function neighborsClear(x, y, islandOf, idx) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var nx = x + dx, ny = y + dy;
        if (!inBoundsRaw(nx, ny)) continue;
        var owner = islandOf[ny][nx];
        if (owner !== -1 && owner !== idx) return false;
      }
    }
    return true;
  }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function growIsland(sx, sy, targetSize, idx, terrain, islandOf) {
    var tiles = [[sx, sy]];
    terrain[sy][sx] = "plain";
    islandOf[sy][sx] = idx;
    var frontier = [[sx, sy]];
    var guard = 0;
    while (tiles.length < targetSize && frontier.length && guard < targetSize * 25) {
      guard++;
      var i = Math.floor(Math.random() * frontier.length);
      var cur = frontier[i];
      var dirs = shuffled([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      var expanded = false;
      for (var d = 0; d < dirs.length; d++) {
        var nx = cur[0] + dirs[d][0], ny = cur[1] + dirs[d][1];
        if (!inBoundsRaw(nx, ny)) continue;
        if (terrain[ny][nx] !== "water") continue;
        if (!neighborsClear(nx, ny, islandOf, idx)) continue;
        terrain[ny][nx] = "plain";
        islandOf[ny][nx] = idx;
        tiles.push([nx, ny]);
        frontier.push([nx, ny]);
        expanded = true;
        if (tiles.length >= targetSize) break;
      }
      if (!expanded) frontier.splice(i, 1);
    }
    return tiles;
  }

  function chebyshev(a, b) { return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); }

  // Scatters forest/mountain/resource dressing across land, then clears a
  // safe starting pocket around each capital so the opening moves aren't
  // immediately blocked by terrain.
  function dressAndFinalize(terrain, islands, playerIsland, aiIsland) {
    var resource = [];
    for (var y = 0; y < ROWS; y++) resource.push(new Array(COLS).fill(false));

    islands.forEach(function (isl) {
      isl.tiles.forEach(function (t) {
        var x = t[0], y = t[1];
        var roll = Math.random();
        if (roll < 0.09) terrain[y][x] = "mountain";
        else if (roll < 0.09 + 0.16) terrain[y][x] = "forest";
      });
    });

    var resourceList = [];
    islands.forEach(function (isl) {
      isl.tiles.forEach(function (t) {
        var x = t[0], y = t[1];
        if (terrain[y][x] === "plain" && Math.random() < 0.12) {
          resource[y][x] = true;
          resourceList.push([x, y]);
        }
      });
    });

    [playerIsland.seed, aiIsland.seed].forEach(function (cap) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var x = cap[0] + dx, y = cap[1] + dy;
          if (!inBoundsRaw(x, y)) continue;
          if (terrain[y][x] === "water") continue;
          terrain[y][x] = "plain";
          if (resource[y][x]) {
            resource[y][x] = false;
            resourceList = resourceList.filter(function (r) { return !(r[0] === x && r[1] === y); });
          }
        }
      }
    });

    return { terrain: terrain, resource: resource, resourceList: resourceList };
  }

  function generateMap() {
    for (var attempt = 0; attempt < 25; attempt++) {
      var terrain = [], islandOf = [];
      for (var y = 0; y < ROWS; y++) {
        terrain.push(new Array(COLS).fill("water"));
        islandOf.push(new Array(COLS).fill(-1));
      }

      var islands = [];
      var islandCount = 6 + Math.floor(Math.random() * 4);
      var tries = 0;
      while (islands.length < islandCount && tries < islandCount * 40) {
        tries++;
        var sx = Math.floor(Math.random() * COLS), sy = Math.floor(Math.random() * ROWS);
        if (terrain[sy][sx] !== "water" || !neighborsClear(sx, sy, islandOf, islands.length)) continue;
        var targetSize;
        if (islands.length < 2) targetSize = 40 + Math.floor(Math.random() * 30);
        else if (Math.random() < 0.4) targetSize = 18 + Math.floor(Math.random() * 18);
        else targetSize = 3 + Math.floor(Math.random() * 8);
        var tiles = growIsland(sx, sy, targetSize, islands.length, terrain, islandOf);
        if (tiles.length < 3) continue;
        islands.push({ seed: [sx, sy], tiles: tiles });
      }

      var eligible = islands.filter(function (isl) { return isl.tiles.length >= 25; });
      if (eligible.length < 2) continue;

      var bestPair = null, bestD = -1;
      for (var i = 0; i < eligible.length; i++) {
        for (var j = i + 1; j < eligible.length; j++) {
          var d = chebyshev(eligible[i].seed, eligible[j].seed);
          if (d > bestD) { bestD = d; bestPair = [i, j]; }
        }
      }
      var playerIsland = eligible[bestPair[0]];
      var aiIsland = eligible[bestPair[1]];
      var dressed = dressAndFinalize(terrain, islands, playerIsland, aiIsland);
      return {
        terrain: dressed.terrain, resource: dressed.resource, resourceList: dressed.resourceList, islandGrid: islandOf,
        playerCapital: playerIsland.seed, aiCapital: aiIsland.seed
      };
    }
    // Astronomically unlikely fallback: two small guaranteed islands so the game can still start.
    var fallbackTerrain = [], fallbackResource = [], fallbackIslandGrid = [];
    for (var fy = 0; fy < ROWS; fy++) {
      fallbackTerrain.push(new Array(COLS).fill("water"));
      fallbackResource.push(new Array(COLS).fill(false));
      fallbackIslandGrid.push(new Array(COLS).fill(-1));
    }
    for (var fy2 = 0; fy2 < 3; fy2++) for (var fx2 = 0; fx2 < 3; fx2++) { fallbackTerrain[fy2][fx2] = "plain"; fallbackIslandGrid[fy2][fx2] = 0; }
    for (var fy3 = 0; fy3 < 3; fy3++) for (var fx3 = COLS - 3; fx3 < COLS; fx3++) { fallbackTerrain[fy3][fx3] = "plain"; fallbackIslandGrid[fy3][fx3] = 1; }
    return {
      terrain: fallbackTerrain, resource: fallbackResource, resourceList: [], islandGrid: fallbackIslandGrid,
      playerCapital: [1, 1], aiCapital: [COLS - 2, 1]
    };
  }

  function islandIdAt(x, y) { return inBoundsRaw(x, y) ? ISLAND_GRID[y][x] : -1; }
  function isCoastal(cityObj) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var nx = cityObj.x + dirs[i][0], ny = cityObj.y + dirs[i][1];
      if (inBoundsRaw(nx, ny) && terrainAt(nx, ny) === "water") return true;
    }
    return false;
  }
  function factionHasCoastalCity(f) { return f.bases.some(function (b) { return b.alive && isCoastal(b); }); }
  function moveCost(terrain, domain, category) {
    if (category === "air") return 1; // Ornithopters ignore terrain entirely, ocean included
    if (domain === "naval") return terrain === "water" ? 1 : Infinity;
    if (terrain === "water") return Infinity;
    if (terrain === "mountain") return 3;
    if (terrain === "forest") return category === "infantry" ? 1 : 2; // infantry moves through forest at normal speed
    return 1;
  }
  function defenseBonus(terrain) {
    if (terrain === "mountain") return 3;
    if (terrain === "forest") return 2;
    return 0;
  }
  function terrainLabel(terrain) {
    return terrain === "water" ? "River" : terrain === "mountain" ? "Mountain" : terrain === "forest" ? "Forest" : "Plain";
  }

