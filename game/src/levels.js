// The Velvet Vault — the three rooms of the heist, one map per level.
// Legend: # wall · . floor · , shadow (detection fills slower) · * spotlight
// (detection fills faster) · V vent (hidden crawl, slow) · D locked door
// (hold E to pick) · S start · E exit · H helipad exit · L painting $500
// · X gold $1000 · M the night's main prize (required to open the exit).
import { TILE } from './config.js';

export const LOOT_VALUE = { L: 500, X: 1000, M: 2500 };

function rows(list) {
  return list.map((line) => line.split(''));
}

// Tile (col,row) -> pixel centre.
export function tileCentre(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

export const LEVELS = [
  {
    name: '1 · The Gallery',
    intro: 'Mara slips into the museum after closing. The Star Sapphire waits behind the locked door — or the long way round.',
    alarmStart: 0,
    mainValue: 2500,
    map: rows([
      '##############################',
      '#S....,,,,,...#..............#',
      '#.....,,,,,...#....L.........#',
      '#.....,,,,,...D....M.........#',
      '#.....,,,,,...#..............#',
      '#.....,,,,,...#..............#',
      '#..##.........#..............#',
      '#..##.........#..............#',
      '#.............#..............#',
      '#.............#..............#',
      '#.............#..............#',
      '#............................#',
      '#..,,,,,,,,,,,,,,............#',
      '#..,,,,,,,,,,,,,,............#',
      '#............................#',
      '#..##.........##..##.........#',
      '#..##.........##..##.........#',
      '#....L...........*...........#',
      '#E.............*.....*.......#',
      '##############################',
    ]),
    guards: [
      { waypoints: [[4, 4], [10, 4], [10, 9], [4, 9]] },
      { waypoints: [[20, 3], [26, 3], [26, 9], [20, 9]] },
    ],
    cameras: [{ tx: 28, ty: 10, angle: Math.PI }],
  },
  {
    name: '2 · The Vault Hall',
    intro: 'Downstairs, the vault hall: gold behind glass, the Crown Jewels under two cameras, and a vent over the top.',
    alarmStart: 0,
    mainValue: 3000,
    map: rows([
      '##############################',
      '#S........#.........L........#',
      '#.........#VVVVVVVVV.........#',
      '#.........#..................#',
      '#.........D..................#',
      '#.........#..................#',
      '#.........#........X.........#',
      '#.........#..................#',
      '#.........#..................#',
      '#............................#',
      '#....*..............M........#',
      '#...................#........#',
      '#...................#..L.....#',
      '#...................#........#',
      '#.....,,,,..........#........#',
      '#.....,,,,..........#........#',
      '#...................#........#',
      '#E..................#........#',
      '#...................#........#',
      '##############################',
    ]),
    guards: [
      { waypoints: [[3, 3], [8, 3], [8, 8], [3, 8]] },
      { waypoints: [[13, 5], [18, 5], [18, 8], [13, 8]] },
      { waypoints: [[23, 12], [27, 12], [27, 17], [23, 17]] },
    ],
    cameras: [
      { tx: 28, ty: 2, angle: Math.PI },
      { tx: 28, ty: 14, angle: Math.PI },
    ],
  },
  {
    name: '3 · The Rooftop Getaway',
    intro: 'The alarm is already warm. Grab the Moon Diamond and run for the helicopter — the roof is crawling.',
    alarmStart: 40,
    mainValue: 3500,
    map: rows([
      '##############################',
      '#S........##........##.......#',
      '#.........##........##.......#',
      '#............................#',
      '#....*........X..............#',
      '#............................#',
      '#.........VVV................#',
      '#............................#',
      '#.....,,,,...................#',
      '#.....,,,,...................#',
      '#............................#',
      '#.........##........##.......#',
      '#.........##........##.......#',
      '#............................#',
      '#....L..............M........#',
      '#............................#',
      '#.........,,,,...............#',
      '#.........,,,,...............#',
      '#.............H..............#',
      '##############################',
    ]),
    guards: [
      { waypoints: [[4, 3], [9, 3], [9, 7], [4, 7]] },
      { waypoints: [[15, 4], [24, 4], [24, 8], [15, 8]] },
      { waypoints: [[22, 13], [27, 13], [27, 16], [22, 16]] },
    ],
    cameras: [
      { tx: 28, ty: 5, angle: Math.PI },
      { tx: 1, ty: 15, angle: 0 },
    ],
  },
];

// ---- map helpers shared by the game and the test scripts -----------------

/** Walkable for the thief: everything but a wall or a still-locked door. */
export function walkable(level, tx, ty, doorsOpen) {
  if (tx < 0 || ty < 0 || tx >= level.map[0].length || ty >= level.map.length) return false;
  const tile = level.map[ty][tx];
  if (tile === '#') return false;
  if (tile === 'D' && !doorsOpen) return false;
  return true;
}

/** Find every tile holding `ch` in a level map. */
export function findTiles(level, ch) {
  const out = [];
  for (let y = 0; y < level.map.length; y += 1) {
    for (let x = 0; x < level.map[y].length; x += 1) {
      if (level.map[y][x] === ch) out.push({ tx: x, ty: y });
    }
  }
  return out;
}

/** Breadth-first reachability from the start, treating locked doors as open. */
export function reachable(level) {
  const start = findTiles(level, 'S')[0];
  const seen = new Set([`${start.tx},${start.ty}`]);
  const queue = [{ tx: start.tx, ty: start.ty }];
  while (queue.length > 0) {
    const cur = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.tx + dx;
      const ny = cur.ty + dy;
      if (!walkable(level, nx, ny, true)) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ tx: nx, ty: ny });
    }
  }
  return seen;
}
