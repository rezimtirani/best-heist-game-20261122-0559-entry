// The Velvet Vault — the thief: movement, sneak, lockpicking and tools.
// Tools cost alarm (they are loud) and have limited charges per level:
// EMP blinds every camera, smoke blocks every cone, a tossed coin pulls a
// guard to where it lands.
import { PLAYER, TOOLS, TILE } from './config.js';
import { findTiles, tileCentre, walkable } from './levels.js';

export function makePlayer(level) {
  const start = findTiles(level, 'S')[0];
  const pos = tileCentre(start.tx, start.ty);
  return {
    x: pos.x,
    y: pos.y,
    angle: 0,
    sneaking: false,
    moving: false,
    // Tool charges, refilled each level.
    emp: TOOLS.empCharges,
    smoke: TOOLS.smokeCharges,
    coins: TOOLS.coinCharges,
    // Lockpick progress on the door currently being picked (0..1), or null.
    picking: null,
    pickProgress: 0,
  };
}

// Circle-vs-tile collision: slide along walls instead of sticking.
function collide(level, p, nx, ny, doorsOpen) {
  const r = PLAYER.radius;
  const minTx = Math.floor((nx - r) / TILE);
  const maxTx = Math.floor((nx + r) / TILE);
  const minTy = Math.floor((ny - r) / TILE);
  const maxTy = Math.floor((ny + r) / TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (walkable(level, tx, ty, doorsOpen)) continue;
      const cx = Math.max(tx * TILE, Math.min(nx, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(ny, ty * TILE + TILE));
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      }
    }
  }
  return { x: nx, y: ny };
}

export function updatePlayer(level, player, input, dt, world) {
  const move = input.move();
  player.moving = move.x !== 0 || move.y !== 0;
  player.sneaking = input.sneak();
  if (player.moving) player.angle = Math.atan2(move.y, move.x);

  // Vents slow the thief down; spotlights do not.
  const tx = Math.floor(player.x / TILE);
  const ty = Math.floor(player.y / TILE);
  const tile = level.map[ty] && level.map[ty][tx];
  const inVent = tile === 'V';
  const speed = (player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed) * (inVent ? 0.55 : 1);
  const nx = player.x + move.x * speed * dt;
  const ny = player.y + move.y * speed * dt;
  const fixed = collide(level, player, nx, ny, world.doorsOpen);
  player.x = fixed.x;
  player.y = fixed.y;

  // Footstep noise: walking is heard nearby, sneaking is silent.
  if (player.moving && !player.sneaking) {
    world.noises.push({ x: player.x, y: player.y, r: PLAYER.noiseWalk, ttl: 0.12 });
  }

  // Lockpicking: hold E beside a locked door; it is loud, guards may hear.
  const door = nearestDoor(level, player);
  if (door && input.pickHeld() && !world.doorsOpen) {
    if (!player.picking || player.picking.tx !== door.tx || player.picking.ty !== door.ty) {
      player.picking = door;
      player.pickProgress = 0;
    }
    player.pickProgress += dt / PLAYER.lockpickSeconds;
    world.noises.push({ x: player.x, y: player.y, r: 90, ttl: 0.12 });
    if (player.pickProgress >= 1) {
      world.doorsOpen = true;
      world.onDoorOpened();
      player.picking = null;
    }
  } else {
    player.picking = null;
    player.pickProgress = 0;
  }

  // EMP: key 1 blinds every camera for a few seconds.
  if (input.consume('1') && player.emp > 0) {
    player.emp -= 1;
    world.empUntil = world.now + TOOLS.empSeconds;
    for (const camera of world.cameras) camera.disabledUntil = world.now + TOOLS.empSeconds;
    world.alarm = Math.min(100, world.alarm + 8);
    world.onTool('EMP burst — cameras blind');
  }
  // Smoke: key 2 drops a cloud at the thief's feet.
  if (input.consume('2') && player.smoke > 0) {
    player.smoke -= 1;
    world.smoke.push({ x: player.x, y: player.y, r: TOOLS.smokeRadius, ttl: TOOLS.smokeSeconds });
    world.alarm = Math.min(100, world.alarm + 6);
    world.onTool('Smoke out');
  }
  // Coin toss: click anywhere in range to throw a coin there.
  const click = input.click();
  if (click && player.coins > 0) {
    const dx = click.x - player.x;
    const dy = click.y - player.y;
    if (Math.hypot(dx, dy) <= TOOLS.coinRange) {
      player.coins -= 1;
      world.noises.push({ x: click.x, y: click.y, r: 130, ttl: 1.2 });
      world.coins.push({ x: click.x, y: click.y, ttl: 1.2 });
      world.onTool('Coin tossed — they heard that');
    }
  }
}

function nearestDoor(level, player) {
  const doors = findTiles(level, 'D');
  for (const d of doors) {
    const c = tileCentre(d.tx, d.ty);
    if (Math.hypot(player.x - c.x, player.y - c.y) < TILE * 1.4) return d;
  }
  return null;
}
