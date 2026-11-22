// The Velvet Vault — guards: patrol, vision cones, hearing and the chase.
// A guard has four states: patrol (waypoints), suspicious (meter filling),
// chase (meter full, runs at the thief) and investigate (walks to the last
// seen spot or a heard noise, then returns to patrol).
import { GUARD, TILE } from './config.js';
import { tileCentre, walkable } from './levels.js';

// Is the straight line from (x0,y0) to (x1,y1) blocked by a wall tile?
export function lineBlocked(level, x0, y0, x1, y1, doorsOpen) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 4)));
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + (dx * i) / steps;
    const y = y0 + (dy * i) / steps;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!walkable(level, tx, ty, doorsOpen) && level.map[ty][tx] !== 'D') return true;
    if (level.map[ty][tx] === 'D' && !doorsOpen) return true;
  }
  return false;
}

// Does `guard` see the thief right now? Returns a 0..1 strength (1 = close,
// face-on, in the open) or 0 when the thief is out of the cone or behind a wall.
export function guardSees(level, guard, thief, doorsOpen) {
  const dx = thief.x - guard.x;
  const dy = thief.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.visionRange) return 0;
  const angleTo = Math.atan2(dy, dx);
  let diff = angleTo - guard.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > GUARD.visionHalfAngle) return 0;
  if (lineBlocked(level, guard.x, guard.y, thief.x, thief.y, doorsOpen)) return 0;
  // Closer and more face-on reads stronger; smoke hides the thief outright.
  const closeness = 1 - dist / GUARD.visionRange;
  const facing = 1 - Math.abs(diff) / GUARD.visionHalfAngle;
  return Math.min(1, 0.35 + 0.65 * closeness * facing);
}

export function makeGuard(def) {
  const points = def.waypoints.map(([tx, ty]) => tileCentre(tx, ty));
  return {
    x: points[0].x,
    y: points[0].y,
    angle: 0,
    waypoints: points,
    wp: 1,
    state: 'patrol', // patrol | suspicious | chase | investigate
    meter: 0, // 0..1 detection of the thief
    lastSeen: null,
    investigate: null,
    hold: 0,
    speedMul: 1,
  };
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.angle = Math.atan2(dy, dx);
  return dist - step < 2;
}

export function updateGuard(level, guard, thief, dt, world) {
  const { doorsOpen, alarm, smoke, noises } = world;
  const speedMul = alarm >= 100 ? 1.35 : 1;
  const seen = guardSees(level, guard, thief, doorsOpen);
  const inSmoke = smoke.some((s) => Math.hypot(thief.x - s.x, thief.y - s.y) < s.r);
  const strength = inSmoke ? 0 : seen;

  // Hearing: a walking thief is heard up close; a coin or a pick is louder.
  let heard = null;
  for (const n of noises) {
    if (Math.hypot(guard.x - n.x, guard.y - n.y) < n.r) heard = n;
  }

  if (strength > 0) {
    // Tile under the thief changes how fast the meter fills.
    const tx = Math.floor(thief.x / TILE);
    const ty = Math.floor(thief.y / TILE);
    const tile = level.map[ty] && level.map[ty][tx];
    let rate = GUARD.detectFill * (0.4 + 0.6 * strength);
    if (tile === ',') rate *= 0.45; // shadow hides
    if (tile === 'V') rate *= 0.3; // vents hide better still
    if (tile === '*') rate *= 1.6; // spotlights expose
    const before = guard.meter;
    guard.meter = Math.min(1, guard.meter + rate * dt);
    guard.lastSeen = { x: thief.x, y: thief.y };
    if (before < 1 && guard.meter >= 1) {
      guard.state = 'chase';
      guard.hold = 0;
      world.onSpotted();
    } else if (guard.state === 'patrol' || guard.state === 'investigate') {
      guard.state = 'suspicious';
    }
  } else {
    guard.meter = Math.max(0, guard.meter - GUARD.detectDecay * dt);
    if (guard.state === 'suspicious' && guard.meter <= 0) {
      guard.state = guard.lastSeen ? 'investigate' : 'patrol';
      guard.investigate = guard.lastSeen;
    }
  }

  if (guard.state === 'chase') {
    if (strength > 0) guard.lastSeen = { x: thief.x, y: thief.y };
    const target = guard.lastSeen || { x: thief.x, y: thief.y };
    moveToward(guard, target.x, target.y, GUARD.chaseSpeed * speedMul, dt);
    guard.hold += dt;
    if (guard.hold > GUARD.suspicionHold && strength === 0) {
      guard.state = 'investigate';
      guard.investigate = guard.lastSeen;
      guard.hold = 0;
    }
    if (strength > 0) guard.hold = 0;
  } else if (guard.state === 'investigate' && guard.investigate) {
    const arrived = moveToward(guard, guard.investigate.x, guard.investigate.y, GUARD.investigateSpeed * speedMul, dt);
    if (arrived) {
      guard.hold += dt;
      guard.angle += dt * 1.5; // look around
      if (guard.hold > 1.6) {
        guard.state = 'patrol';
        guard.investigate = null;
        guard.hold = 0;
      }
    }
  } else if (heard && guard.state !== 'chase') {
    guard.state = 'investigate';
    guard.investigate = { x: heard.x, y: heard.y };
    guard.hold = 0;
  } else {
    // Patrol: walk the waypoint loop, pausing a beat at each corner.
    const target = guard.waypoints[guard.wp];
    const arrived = moveToward(guard, target.x, target.y, GUARD.patrolSpeed * speedMul, dt);
    if (arrived) {
      guard.hold += dt;
      if (guard.hold > 0.7) {
        guard.wp = (guard.wp + 1) % guard.waypoints.length;
        guard.hold = 0;
      }
    }
  }

  // Caught: the guard touches the thief.
  if (Math.hypot(guard.x - thief.x, guard.y - thief.y) < GUARD.catchRadius + 8) {
    world.onCaught();
  }
}
