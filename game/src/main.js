// The Velvet Vault — the game itself: state, the loop, loot, alarm, attempts
// and the screens. Wires input, guards, cameras, player, audio and render.
import { FIELD, STEP, ATTEMPTS_PER_LEVEL, ALARM, CAMERA, SCORE, TOOLS } from './config.js';
import { LEVELS, findTiles, tileCentre, LOOT_VALUE } from './levels.js';
import { createInput } from './input.js';
import { makeGuard, updateGuard } from './guards.js';
import { makeCamera, updateCamera, cameraSees } from './cameras.js';
import { makePlayer, updatePlayer } from './player.js';
import { createAudio } from './audio.js';
import { draw, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_WIN, SCREEN_OVER } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();
const url = new URL(window.location.href);
const shotName = url.searchParams.get('shot');
const shotSeed = Number(url.searchParams.get('seed') || '1');

// A tiny deterministic RNG (mulberry32) so staged shots are reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLoot(level) {
  const loot = [];
  for (const kind of ['L', 'X', 'M']) {
    for (const t of findTiles(level, kind)) {
      const pos = tileCentre(t.tx, t.ty);
      loot.push({
        kind,
        x: pos.x,
        y: pos.y,
        value: kind === 'M' ? level.mainValue : LOOT_VALUE[kind],
        hue: kind === 'L' ? ['#7fae8a', '#ae7f8a', '#8a9aae'][Math.floor(rng(t.tx * 31 + t.ty * 7)() * 3)] : '#e8c33a',
        taken: false,
      });
    }
  }
  return loot;
}

function newWorld(levelIndex) {
  const level = LEVELS[levelIndex];
  const player = makePlayer(level);
  return {
    levelIndex,
    level,
    player,
    guards: level.guards.map(makeGuard),
    cameras: level.cameras.map(makeCamera),
    loot: buildLoot(level),
    doorsOpen: false,
    alarm: level.alarmStart,
    alarmPeak: level.alarmStart,
    score: 0,
    lootValue: 0,
    mainTaken: false,
    attemptsLeft: ATTEMPTS_PER_LEVEL,
    elapsed: 0,
    now: 0,
    empUntil: 0,
    smoke: [],
    coins: [],
    noises: [],
    hint: '',
    hintUntil: 0,
    screen: SCREEN_TITLE,
    timeBonus: 0,
    alarmPenalty: 0,
    nextName: levelIndex + 1 < LEVELS.length ? LEVELS[levelIndex + 1].name : '',
    stepCount: 0,
    lastStepSound: 0,
    lastAlarmSound: 0,
  };
}

let world = newWorld(0);
let state = 'title'; // title | play | pause | caught | clear | win | over

function setScreen(screen) {
  world.screen = screen;
  state = screen === SCREEN_PLAY ? 'play' : screen;
  if (screen !== SCREEN_PLAY) input.clear();
}

function resetLevel(keepLoot) {
  const lootValue = world.lootValue;
  const score = world.score;
  const attemptsLeft = world.attemptsLeft;
  const fresh = newWorld(world.levelIndex);
  fresh.lootValue = lootValue;
  fresh.score = score;
  fresh.attemptsLeft = attemptsLeft;
  if (keepLoot) {
    // Caught: the room resets but loot already pocketed stays pocketed.
    for (const item of fresh.loot) {
      const old = world.loot.find((o) => o.x === item.x && o.y === item.y);
      if (old && old.taken) item.taken = true;
    }
    fresh.mainTaken = world.mainTaken;
  }
  world = fresh;
  setScreen(SCREEN_PLAY);
}

function onCaught() {
  if (state !== 'play') return;
  audio.caught();
  world.attemptsLeft -= 1;
  if (world.attemptsLeft <= 0) {
    setScreen(SCREEN_OVER);
  } else {
    setScreen(SCREEN_CAUGHT);
  }
}

function onSpotted() {
  world.alarm = Math.min(ALARM.max, world.alarm + ALARM.spotBonus);
  audio.spotted();
}

const worldApi = {
  get doorsOpen() {
    return world.doorsOpen;
  },
  set doorsOpen(v) {
    world.doorsOpen = v;
  },
  get alarm() {
    return world.alarm;
  },
  set alarm(v) {
    world.alarm = v;
  },
  get cameras() {
    return world.cameras;
  },
  get now() {
    return world.now;
  },
  get smoke() {
    return world.smoke;
  },
  get noises() {
    return world.noises;
  },
  get coins() {
    return world.coins;
  },
  get empUntil() {
    return world.empUntil;
  },
  set empUntil(v) {
    world.empUntil = v;
  },
  onSpotted,
  onCaught,
  onDoorOpened() {
    audio.door();
    world.hint = 'The locked door swings open — the long way round was optional.';
    world.hintUntil = world.now + 3;
  },
  onTool(msg) {
    world.hint = msg;
    world.hintUntil = world.now + 2.5;
    if (msg.startsWith('EMP')) audio.emp();
    if (msg.startsWith('Coin')) audio.coin();
  },
};

function step(dt) {
  world.now += dt;
  world.elapsed += dt;
  world.stepCount += 1;

  // Timed effects decay.
  world.smoke = world.smoke.filter((s) => (s.ttl -= dt) > 0);
  world.coins = world.coins.filter((c) => (c.ttl -= dt) > 0);
  world.noises = world.noises.filter((n) => (n.ttl -= dt) > 0);
  if (world.hintUntil < world.now) world.hint = '';

  updatePlayer(world.level, world.player, input, dt, worldApi);

  // Footstep sounds, throttled.
  if (world.player.moving && world.now - world.lastStepSound > (world.player.sneaking ? 0.55 : 0.34)) {
    world.lastStepSound = world.now;
    audio.step(world.player.sneaking);
  }

  for (const g of world.guards) updateGuard(world.level, g, world.player, dt, worldApi);
  for (const c of world.cameras) updateCamera(c, dt, world.now);

  // Cameras feed the alarm meter.
  let cameraSeen = false;
  for (const c of world.cameras) {
    const seen = cameraSees(world.level, c, world.player, world.doorsOpen, world.now);
    if (seen > 0) {
      cameraSeen = true;
      world.alarm = Math.min(ALARM.max, world.alarm + CAMERA.alarmFill * seen * dt);
    }
  }
  if (!cameraSeen) world.alarm = Math.max(world.level.alarmStart, world.alarm - ALARM.decay * dt);
  world.alarmPeak = Math.max(world.alarmPeak, world.alarm);
  if (world.alarm >= 100 && world.now - world.lastAlarmSound > 1.6) {
    world.lastAlarmSound = world.now;
    audio.alarmLoop();
    world.hint = 'LOCKDOWN — every guard is running. Move!';
    world.hintUntil = world.now + 1.6;
  }

  // Loot pickup: walk over it.
  for (const item of world.loot) {
    if (item.taken) continue;
    if (Math.hypot(world.player.x - item.x, world.player.y - item.y) < 22) {
      item.taken = true;
      world.lootValue += item.value;
      world.score += item.value;
      if (item.kind === 'M') {
        world.mainTaken = true;
        audio.bigPickup();
        world.hint = 'The prize is yours — reach the exit!';
        world.hintUntil = world.now + 3;
      } else {
        audio.pickup();
      }
    }
  }

  // Exit: open only once the main prize is pocketed.
  if (world.mainTaken) {
    const exits = findTiles(world.level, 'E').concat(findTiles(world.level, 'H'));
    for (const e of exits) {
      const pos = tileCentre(e.tx, e.ty);
      if (Math.hypot(world.player.x - pos.x, world.player.y - pos.y) < 24) {
        levelComplete();
        return;
      }
    }
  }
}

function levelComplete() {
  const timeBonus = Math.max(0, Math.round((SCORE.timeBonusSeconds - world.elapsed) * SCORE.timeBonusPerSecond));
  world.score += timeBonus;
  if (world.levelIndex + 1 >= LEVELS.length) {
    world.timeBonus = timeBonus;
    world.alarmPenalty = Math.round(world.alarmPeak * SCORE.alarmPenaltyPerPoint);
    world.score = Math.max(0, world.score - world.alarmPenalty);
    audio.win();
    setScreen(SCREEN_WIN);
  } else {
    audio.win();
    setScreen(SCREEN_CLEAR);
  }
}

function nextLevel() {
  const lootValue = world.lootValue;
  const score = world.score;
  world = newWorld(world.levelIndex + 1);
  world.lootValue = lootValue;
  world.score = score;
  setScreen(SCREEN_PLAY);
}

function loop() {
  if (state === 'play') {
    if (input.pausePressed()) {
      setScreen(SCREEN_PAUSE);
    } else {
      try {
        step(STEP);
      } catch (err) {
        // A bug in one frame must never kill the game loop.
        console.error(err);
      }
    }
  } else if (state === 'title') {
    if (input.anyKey() || input.click()) {
      audio.unlock();
      setScreen(SCREEN_PLAY);
    }
  } else if (state === 'pause') {
    // Resume only on Enter or a click: 'p' is still held from pausing, so it
    // must not resume by itself.
    if (input.consume('Enter') || input.click()) setScreen(SCREEN_PLAY);
  } else if (state === 'caught') {
    if (input.consume('Enter') || input.consume(' ')) resetLevel(true);
  } else if (state === 'clear') {
    if (input.consume('Enter') || input.consume(' ')) nextLevel();
  } else if (state === 'win' || state === 'over') {
    if (input.consume('Enter') || input.consume(' ')) {
      world = newWorld(0);
      setScreen(SCREEN_TITLE);
    }
  }
  draw(ctx, world);
  requestAnimationFrame(loop);
}

// ---- staged screenshots (?shot=...) ---------------------------------------
// Each scene plays the real rules forward from a fresh level so the frame is
// what a short game really looks like, with the same seed every time.
function stageShot(name) {
  const seed = shotSeed;
  const rand = rng(seed);
  if (name === 'title') {
    world = newWorld(0);
    setScreen(SCREEN_TITLE);
    return;
  }
  if (name === 'win') {
    world = newWorld(2);
    world.mainTaken = true;
    for (const item of world.loot) {
      if (item.kind !== 'M' || rand() < 0.5) {
        item.taken = true;
        world.lootValue += item.value;
      }
    }
    world.player.x = tileCentre(13, 17).x;
    world.player.y = tileCentre(13, 17).y;
    world.alarm = 55;
    world.alarmPeak = 72;
    world.elapsed = 214;
    world.score = world.lootValue + 1200;
    world.timeBonus = 1200;
    world.alarmPenalty = 720;
    world.score = Math.max(0, world.score - world.alarmPenalty);
    setScreen(SCREEN_WIN);
    return;
  }
  // play: a different room — level 2, the thief sneaking through the vault
  // hall toward the Crown Jewels, a camera sweeping overhead.
  if (name === 'play') {
    world = newWorld(1);
    world.mainTaken = false;
    world.player.x = tileCentre(15, 2).x;
    world.player.y = tileCentre(15, 2).y;
    world.player.angle = 1.2;
    world.player.sneaking = true;
    world.alarm = 22;
    world.alarmPeak = 30;
    world.elapsed = 187;
    for (let i = 0; i < 200; i += 1) {
      for (const g of world.guards) updateGuard(world.level, g, world.player, STEP, worldApi);
      for (const c of world.cameras) updateCamera(c, STEP, world.now);
      world.now += STEP;
    }
    world.loot.forEach((item) => {
      if (item.kind === 'X') {
        item.taken = true;
        world.lootValue += item.value;
        world.score += item.value;
      }
    });
    world.hint = 'The Crown Jewels are under two cameras — the vent runs over the top.';
    world.hintUntil = world.now + 30;
    setScreen(SCREEN_PLAY);
    return;
  }
  // cover: level 1, mid-heist — the thief sneaks past the locked door
  // with a guard cone sweeping nearby, a camera watching the sapphire room,
  // loot on its pedestal and the alarm half up.
  world = newWorld(0);
  world.mainTaken = false;
  world.player.x = tileCentre(12, 6).x;
  world.player.y = tileCentre(12, 6).y;
  world.player.angle = 0;
  world.player.sneaking = true;
  world.alarm = 34;
  world.alarmPeak = 41;
  world.elapsed = 96;
  // Drive the guards forward a few seconds so their cones are mid-sweep.
  for (let i = 0; i < 180; i += 1) {
    for (const g of world.guards) updateGuard(world.level, g, world.player, STEP, worldApi);
    for (const c of world.cameras) updateCamera(c, STEP, world.now);
    world.now += STEP;
  }
  world.loot.forEach((item) => {
    if (item.kind === 'L' && item.x < 500) {
      item.taken = true;
      world.lootValue += item.value;
      world.score += item.value;
    }
  });
  world.hint = 'The sapphire is behind the locked door — pick it, or take the long way round.';
  world.hintUntil = world.now + 30;
  setScreen(SCREEN_PLAY);
}

if (shotName) {
  stageShot(shotName);
  draw(ctx, world);
} else {
  setScreen(SCREEN_TITLE);
  requestAnimationFrame(loop);
}

// Test hook: lets an automated browser read (and place) the game state.
// Harmless in play; the game never reads it back.
window.__heist = {
  world: () => world,
  state: () => state,
  reset: (levelIndex) => {
    world = newWorld(levelIndex);
    setScreen(SCREEN_PLAY);
  },
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') audio.toggleMute();
});
