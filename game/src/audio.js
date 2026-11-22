// The Velvet Vault — all sound is synthesised with WebAudio, no audio files.
// Short blips and filtered noise: footsteps, pickup chimes, suspicion,
// alarm and the win arpeggio.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    step(sneak) {
      noise(0.07, sneak ? 0.05 : 0.16, sneak ? 300 : 700);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.5);
      tone(1318, 0.18, 'sine', 0.4, 0.07);
    },
    bigPickup() {
      tone(523, 0.14, 'triangle', 0.5);
      tone(659, 0.14, 'triangle', 0.5, 0.09);
      tone(784, 0.22, 'triangle', 0.5, 0.18);
      tone(1046, 0.3, 'sine', 0.45, 0.27);
    },
    suspicious() {
      tone(620, 0.16, 'square', 0.18, 0, 520);
    },
    spotted() {
      tone(220, 0.3, 'sawtooth', 0.4, 0, 440);
      tone(440, 0.25, 'square', 0.25, 0.12, 660);
    },
    alarmLoop() {
      tone(980, 0.14, 'square', 0.12);
      tone(740, 0.14, 'square', 0.12, 0.16);
    },
    door() {
      noise(0.25, 0.25, 900);
      tone(180, 0.2, 'triangle', 0.3, 0.05, 90);
    },
    coin() {
      tone(2400, 0.06, 'sine', 0.3);
      tone(1900, 0.08, 'sine', 0.25, 0.06);
    },
    emp() {
      tone(1200, 0.4, 'sawtooth', 0.2, 0, 120);
      noise(0.3, 0.15, 2400);
    },
    caught() {
      tone(330, 0.5, 'sawtooth', 0.35, 0, 110);
      tone(165, 0.7, 'square', 0.25, 0.15, 55);
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'triangle', 0.4, i * 0.11));
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
