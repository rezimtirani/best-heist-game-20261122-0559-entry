// The Velvet Vault — shared constants: sizes, speeds, detection and alarm tuning.
// One job: every number the rest of the game agrees on lives here.
export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const FIELD = { width: COLS * TILE, height: ROWS * TILE };

// Player
export const PLAYER = {
  radius: 11,
  walkSpeed: 150, // px per second
  sneakSpeed: 78,
  noiseWalk: 46, // px radius guards can hear a walking step
  noiseSneak: 0,
  lockpickSeconds: 2.0,
};

// Guards
export const GUARD = {
  radius: 12,
  patrolSpeed: 62,
  chaseSpeed: 132,
  investigateSpeed: 92,
  visionRange: 175,
  visionHalfAngle: 0.61, // ~35 degrees each side
  detectFill: 1.15, // per second while fully seen at close range
  detectDecay: 0.55, // per second while unseen
  catchRadius: 20,
  suspicionHold: 2.5, // seconds a guard keeps investigating a last-seen spot
};

// Cameras sweep a cone; being seen feeds the alarm meter, not a guard meter.
export const CAMERA = {
  range: 190,
  halfAngle: 0.5,
  sweepSpeed: 0.55, // radians per second
  sweepArc: 1.1, // radians each side of the base angle
  alarmFill: 34, // alarm points per second while seen
};

// Alarm meter 0..100. At 100 the whole floor goes on lockdown: guards run faster.
export const ALARM = {
  max: 100,
  decay: 1.2, // points per second while nobody sees the thief
  lockdownSpeed: 1.35, // guard speed multiplier during lockdown
  toolEmpCost: 8,
  toolSmokeCost: 6,
  spotBonus: 22, // alarm added the moment a guard first spots the thief
};

// Tools: limited charges per level, each use costs alarm (tools are loud).
export const TOOLS = {
  empCharges: 2,
  empSeconds: 6, // cameras blind this long
  smokeCharges: 2,
  smokeSeconds: 5,
  smokeRadius: 70,
  coinCharges: 3,
  coinRange: 260,
};

// Scoring
export const SCORE = {
  timeBonusSeconds: 600,
  timeBonusPerSecond: 5,
  alarmPenaltyPerPoint: 10,
};

export const STEP = 1 / 60;
export const ATTEMPTS_PER_LEVEL = 3;
