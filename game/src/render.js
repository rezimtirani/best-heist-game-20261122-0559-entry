// The Velvet Vault — every pixel the player sees: floor, walls, cones, loot,
// the thief, the HUD and the screens. All art is drawn procedurally.
import { FIELD, TILE, GUARD, CAMERA } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const FLOOR = '#23202e';
const FLOOR_ALT = '#262335';
const SHADOW = '#17141f';
const SPOT = '#3a2f4d';
const VENT = '#1d2a33';
const WALL = '#453a5e';
const WALL_TOP = '#5d4f7d';

function tileAt(level, tx, ty) {
  if (ty < 0 || ty >= level.map.length || tx < 0 || tx >= level.map[0].length) return '#';
  return level.map[ty][tx];
}

function drawCone(ctx, x, y, angle, range, halfAngle, color) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawFloor(ctx, level, doorsOpen) {
  for (let ty = 0; ty < level.map.length; ty += 1) {
    for (let tx = 0; tx < level.map[0].length; tx += 1) {
      const tile = level.map[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (tile === '#') {
        ctx.fillStyle = WALL;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = WALL_TOP;
        ctx.fillRect(x, y, TILE, 5);
        continue;
      }
      if (tile === 'D') {
        ctx.fillStyle = doorsOpen ? '#3a2f1d' : '#8a6d2f';
        ctx.fillRect(x, y, TILE, TILE);
        if (!doorsOpen) {
          ctx.fillStyle = '#d9b45a';
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.fillStyle = '#6b5320';
          ctx.fillRect(x + TILE / 2 - 2, y + 8, 4, 10);
        }
        continue;
      }
      ctx.fillStyle = (tx + ty) % 2 === 0 ? FLOOR : FLOOR_ALT;
      if (tile === ',') ctx.fillStyle = SHADOW;
      if (tile === '*') ctx.fillStyle = SPOT;
      if (tile === 'V') ctx.fillStyle = VENT;
      ctx.fillRect(x, y, TILE, TILE);
      if (tile === '*') {
        ctx.fillStyle = 'rgba(255, 230, 150, 0.10)';
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 15, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tile === 'V') {
        ctx.strokeStyle = '#3d5a6b';
        ctx.lineWidth = 2;
        for (let i = 1; i < 4; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x + 4, y + i * 8);
          ctx.lineTo(x + TILE - 4, y + i * 8);
          ctx.stroke();
        }
      }
    }
  }
}

function drawLoot(ctx, loot) {
  for (const item of loot) {
    if (item.taken) continue;
    const { x, y } = item;
    if (item.kind === 'L') {
      // A painting in a gold frame.
      ctx.fillStyle = '#d9b45a';
      ctx.fillRect(x - 13, y - 10, 26, 20);
      ctx.fillStyle = item.hue;
      ctx.fillRect(x - 10, y - 7, 20, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x - 10, y - 7, 20, 4);
    } else if (item.kind === 'X') {
      // Stacked gold bars.
      ctx.fillStyle = '#e8c33a';
      ctx.fillRect(x - 12, y - 4, 24, 8);
      ctx.fillRect(x - 8, y - 11, 16, 7);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(x - 12, y - 4, 24, 2);
    } else {
      // The main prize: a glowing gem on a pedestal.
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
      ctx.fillStyle = `rgba(120, 220, 255, ${0.12 + 0.15 * pulse})`;
      ctx.beginPath();
      ctx.arc(x, y, 26 + 6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a6a8a';
      ctx.fillRect(x - 9, y + 2, 18, 10);
      ctx.fillStyle = '#7fe3ff';
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + 9, y - 2);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 9, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + 4, y - 6);
      ctx.lineTo(x, y - 2);
      ctx.lineTo(x - 4, y - 6);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawExit(ctx, level, mainTaken) {
  for (let ty = 0; ty < level.map.length; ty += 1) {
    for (let tx = 0; tx < level.map[0].length; tx += 1) {
      const tile = level.map[ty][tx];
      if (tile !== 'E' && tile !== 'H') continue;
      const x = tx * TILE;
      const y = ty * TILE;
      if (tile === 'E') {
        ctx.fillStyle = mainTaken ? '#2fae5f' : '#555a6a';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = mainTaken ? '#b6ffd2' : '#8a8fa3';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', x + TILE / 2, y + TILE / 2 + 4);
      } else {
        // Helipad: a marked circle with an H.
        ctx.strokeStyle = mainTaken ? '#7fe3a0' : '#555a6a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = mainTaken ? '#b6ffd2' : '#8a8fa3';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('H', x + TILE / 2, y + TILE / 2 + 5);
      }
    }
  }
}

function drawGuards(ctx, guards) {
  for (const g of guards) {
    const color =
      g.state === 'chase' ? 'rgba(255, 60, 60, 0.30)' : g.state === 'suspicious' ? 'rgba(255, 150, 40, 0.26)' : 'rgba(255, 220, 90, 0.20)';
    drawCone(ctx, g.x, g.y, g.angle, GUARD.visionRange, GUARD.visionHalfAngle, color);
  }
  for (const g of guards) {
    // Body: a guard in a dark uniform with a cap.
    ctx.fillStyle = '#2e4a7a';
    ctx.beginPath();
    ctx.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16233d';
    ctx.beginPath();
    ctx.arc(g.x, g.y, GUARD.radius - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dfe6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * (GUARD.radius + 5), g.y + Math.sin(g.angle) * (GUARD.radius + 5));
    ctx.stroke();
    // Detection meter above the guard.
    if (g.meter > 0.02) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(g.x - 14, g.y - 24, 28, 5);
      ctx.fillStyle = g.meter >= 1 ? '#ff4444' : '#ffb020';
      ctx.fillRect(g.x - 13, g.y - 23, 26 * g.meter, 3);
    }
  }
}

function drawCameras(ctx, cameras, now) {
  for (const c of cameras) {
    const blind = now < c.disabledUntil;
    if (!blind) drawCone(ctx, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle, 'rgba(255, 80, 90, 0.16)');
    ctx.fillStyle = blind ? '#4a4a55' : '#c23b47';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(c.angle) * 13, c.y + Math.sin(c.angle) * 13);
    ctx.stroke();
    if (blind) {
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✕', c.x, c.y - 10);
    }
  }
}

function drawPlayer(ctx, player) {
  const r = player.sneaking ? 9 : PLAYER_RADIUS;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 8, r + 2, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hooded cloak.
  ctx.fillStyle = '#7a4fd0';
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a2a8a';
  ctx.beginPath();
  ctx.arc(player.x, player.y, r - 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(player.x + Math.cos(player.angle) * 3, player.y + Math.sin(player.angle) * 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  if (player.picking) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(player.x - 14, player.y - 26, 28, 5);
    ctx.fillStyle = '#d9b45a';
    ctx.fillRect(player.x - 13, player.y - 25, 26 * player.pickProgress, 3);
  }
}

const PLAYER_RADIUS = 11;

function drawSmoke(ctx, smoke) {
  for (const s of smoke) {
    ctx.fillStyle = 'rgba(180, 180, 190, 0.35)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 200, 210, 0.25)';
    ctx.beginPath();
    ctx.arc(s.x - 14, s.y - 8, s.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoins(ctx, coins) {
  for (const c of coins) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx, w) {
  const pad = 10;
  ctx.fillStyle = 'rgba(10, 8, 18, 0.92)';
  ctx.fillRect(0, 0, FIELD.width, 44);
  ctx.fillStyle = '#e8e4f5';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(w.level.name, pad, 18);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#c9c2de';
  ctx.fillText(`Loot $${w.lootValue}  ·  Score ${w.score}  ·  ${w.attemptsLeft} attempts  ·  ${Math.floor(w.elapsed)}s`, pad, 35);

  // Alarm meter, top right.
  const mw = 220;
  const mx = FIELD.width - mw - pad;
  ctx.fillStyle = '#3a3448';
  ctx.fillRect(mx, 12, mw, 12);
  const alarmColor = w.alarm >= 100 ? '#ff3333' : w.alarm >= 60 ? '#ff8c1a' : '#ffb020';
  ctx.fillStyle = alarmColor;
  ctx.fillRect(mx, 12, mw * Math.min(1, w.alarm / 100), 12);
  ctx.fillStyle = '#e8e4f5';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(w.alarm >= 100 ? 'LOCKDOWN!' : `ALARM ${Math.round(w.alarm)}%`, mx, 34);

  // Tools, bottom bar.
  ctx.fillStyle = 'rgba(10, 8, 18, 0.92)';
  ctx.fillRect(0, FIELD.height - 28, FIELD.width, 28);
  ctx.fillStyle = '#c9c2de';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `Tools — [1] EMP ×${w.player.emp} (blinds cameras)   [2] Smoke ×${w.player.smoke}   Click: toss coin ×${w.player.coins}   Hold E: pick locks   Shift: sneak   P: pause   M: mute`,
    pad,
    FIELD.height - 10,
  );
  if (w.hint) {
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(w.hint, FIELD.width / 2, 62);
  }
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8, 6, 14, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(title, FIELD.width / 2, FIELD.height / 2 - 60);
  ctx.fillStyle = '#e8e4f5';
  ctx.font = '16px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, FIELD.height / 2 - 18 + i * 26);
  });
  ctx.fillStyle = '#9a92b5';
  ctx.font = '13px sans-serif';
  ctx.fillText('Press Enter to continue', FIELD.width / 2, FIELD.height / 2 - 18 + lines.length * 26 + 26);
}

export function draw(ctx, w) {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  drawFloor(ctx, w.level, w.doorsOpen);
  drawExit(ctx, w.level, w.mainTaken);
  drawLoot(ctx, w.loot);
  drawGuards(ctx, w.guards);
  drawCameras(ctx, w.cameras, w.now);
  drawSmoke(ctx, w.smoke);
  drawCoins(ctx, w.coins);
  if (w.screen === SCREEN_PLAY || w.screen === SCREEN_PAUSE) drawPlayer(ctx, w.player);
  drawHud(ctx, w);

  if (w.screen === SCREEN_TITLE) {
    overlay(ctx, 'THE VELVET VAULT', [
      'A top-down heist in three rooms. Steal the prize, dodge the cones,',
      'mind the cameras — and get out before the alarm hits 100%.',
      '',
      'WASD / arrows move · Shift sneak · Click tosses a coin',
      '[1] EMP blinds cameras · [2] smoke · hold E to pick a lock',
    ], '#d9b45a');
  } else if (w.screen === SCREEN_PAUSE) {
    overlay(ctx, 'PAUSED', ['Take a breath. The guards are waiting.'], '#c9c2de');
  } else if (w.screen === SCREEN_CAUGHT) {
    overlay(ctx, 'CAUGHT!', [`The guards closed in. ${w.attemptsLeft} attempts left.`, 'The room resets — the loot stays where it was.'], '#ff5a5a');
  } else if (w.screen === SCREEN_CLEAR) {
    overlay(ctx, 'ROOM CLEAR', [`${w.level.name} — loot $${w.lootValue} banked.`, `Next: ${w.nextName}`], '#7fe3a0');
  } else if (w.screen === SCREEN_WIN) {
    overlay(ctx, 'THE GETAWAY', [
      `Mara lifts off with $${w.lootValue} in loot.`,
      `Time bonus $${w.timeBonus} · alarm penalty −$${w.alarmPenalty}`,
      `Final score: ${w.score}`,
    ], '#7fe3ff');
  } else if (w.screen === SCREEN_OVER) {
    overlay(ctx, 'THE VAULT WINS', ['Out of attempts. The sapphire stays behind glass.', `Score: ${w.score}`], '#ff5a5a');
  }
}
