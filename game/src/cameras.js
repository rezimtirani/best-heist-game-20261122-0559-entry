// The Velvet Vault — security cameras: a sweeping cone that feeds the alarm
// meter while the thief is inside it. EMP blinds them for a few seconds.
import { CAMERA, TILE } from './config.js';
import { lineBlocked } from './guards.js';
import { tileCentre } from './levels.js';

export function makeCamera(def) {
  const pos = tileCentre(def.tx, def.ty);
  return {
    x: pos.x,
    y: pos.y,
    baseAngle: def.angle,
    angle: def.angle,
    sweep: 0, // -1..1 across the sweep arc
    sweepDir: 1,
    disabledUntil: 0, // game time until which the camera is blind
  };
}

export function updateCamera(camera, dt, now) {
  if (now < camera.disabledUntil) return; // blind: the cone stays where it died
  camera.sweep += camera.sweepDir * CAMERA.sweepSpeed * dt;
  if (camera.sweep > 1) {
    camera.sweep = 1;
    camera.sweepDir = -1;
  } else if (camera.sweep < -1) {
    camera.sweep = -1;
    camera.sweepDir = 1;
  }
  camera.angle = camera.baseAngle + camera.sweep * CAMERA.sweepArc;
}

// Does this camera see the thief? Reuses the guard cone test with the
// camera's own range and half-angle.
export function cameraSees(level, camera, thief, doorsOpen, now) {
  if (now < camera.disabledUntil) return 0;
  const fake = { x: camera.x, y: camera.y, angle: camera.angle };
  const dx = thief.x - camera.x;
  const dy = thief.y - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA.range) return 0;
  const angleTo = Math.atan2(dy, dx);
  let diff = angleTo - camera.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > CAMERA.halfAngle) return 0;
  if (lineBlocked(level, camera.x, camera.y, thief.x, thief.y, doorsOpen)) return 0;
  return Math.min(1, 0.4 + 0.6 * (1 - dist / CAMERA.range));
}
