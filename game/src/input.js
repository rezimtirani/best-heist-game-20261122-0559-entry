// The Velvet Vault — keyboard and mouse input, one job: turn raw events into
// the game's own view of what the player is doing this frame.
export function createInput(canvas) {
  const keys = new Set();
  // Edge queue: every fresh keydown lands here until something consumes it,
  // so a quick tap is never lost between two frames.
  const pressed = new Set();
  let mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };
  let anyKey = false;

  function normalise(key) {
    return key.length === 1 ? key.toLowerCase() : key;
  }
  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    keys.add(normalise(event.key));
    if (!event.repeat) pressed.add(normalise(event.key));
    anyKey = true;
  }
  function onKeyUp(event) {
    keys.delete(normalise(event.key));
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  }
  function onClick(event) {
    onMouseMove(event);
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);

  return {
    // Movement vector, normalised, from WASD or arrow keys.
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    sneak() {
      return keys.has('Shift');
    },
    pickHeld() {
      return keys.has('e');
    },
    useEmp() {
      return keys.has('1');
    },
    useSmoke() {
      return keys.has('2');
    },
    pausePressed() {
      return keys.has('p') || keys.has('Escape');
    },
    confirmPressed() {
      return keys.has('Enter') || keys.has(' ');
    },
    // A mouse click this frame (coin toss target), or null. Consumed on read.
    click() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    mousePos() {
      return { x: mouse.x, y: mouse.y };
    },
    // Any key pressed since the last check (used to leave title screens).
    anyKey() {
      const hit = anyKey;
      anyKey = false;
      return hit;
    },
    // Edge-triggered helpers: call once per frame; a key lands in the
    // pressed queue on keydown and is consumed here, so a tap that falls
    // between two frames still counts.
    consume(key) {
      if (!pressed.has(key)) return false;
      pressed.delete(key);
      keys.delete(key);
      return true;
    },
    // Drop every held key: called when the screen changes, so a key pressed
    // on one screen (Enter to start) cannot leak into the next one.
    clear() {
      keys.clear();
      pressed.clear();
      anyKey = false;
    },
  };
}
