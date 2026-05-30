// Web Audio API pixel sound engine — no external files needed

let _ctx: AudioContext | null = null;
let _enabled = true;

function ctx(): AudioContext | null {
  if (!_enabled) return null;
  if (!_ctx) {
    try { _ctx = new AudioContext(); } catch { return null; }
  }
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

function osc(ac: AudioContext, freq: number, type: OscillatorType, start: number, end: number, vol = 0.18) {
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, end);
  g.connect(ac.destination);
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  o.connect(g);
  o.start(start);
  o.stop(end);
}

function sweep(ac: AudioContext, f0: number, f1: number, dur: number, type: OscillatorType = "square", vol = 0.15) {
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(ac.destination);
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.connect(g);
  o.start(t);
  o.stop(t + dur);
}

function noise(ac: AudioContext, dur: number, freq: number, vol = 0.12) {
  const size = ac.sampleRate * dur;
  const buf = ac.createBuffer(1, size, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = freq;
  filt.Q.value = 1.5;
  const g = ac.createGain();
  const t = ac.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(ac.destination);
  src.start(t);
  src.stop(t + dur);
}

export const sounds = {
  setEnabled(v: boolean) { _enabled = v; },
  isEnabled() { return _enabled; },

  jump() {
    const ac = ctx(); if (!ac) return;
    sweep(ac, 200, 520, 0.12, "square", 0.14);
  },

  land() {
    const ac = ctx(); if (!ac) return;
    noise(ac, 0.07, 100, 0.1);
  },

  die() {
    const ac = ctx(); if (!ac) return;
    sweep(ac, 420, 60, 0.28, "sawtooth", 0.18);
    const t = ac.currentTime;
    noise(ac, 0.2, 200, 0.09);
  },

  spike() {
    const ac = ctx(); if (!ac) return;
    sweep(ac, 800, 200, 0.1, "square", 0.1);
    noise(ac, 0.08, 1200, 0.07);
  },

  troll() {
    const ac = ctx(); if (!ac) return;
    sweep(ac, 80, 40, 0.18, "sawtooth", 0.2);
  },

  win() {
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    const notes = [261, 330, 392, 523];
    notes.forEach((freq, i) => {
      osc(ac, freq, "square", t + i * 0.10, t + i * 0.10 + 0.14, 0.14);
    });
  },

  door() {
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    osc(ac, 880, "sine", t, t + 0.35, 0.12);
    osc(ac, 1320, "sine", t + 0.05, t + 0.30, 0.07);
  },

  levelComplete() {
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    const melody = [261, 330, 392, 330, 392, 523];
    melody.forEach((f, i) => osc(ac, f, "square", t + i * 0.09, t + i * 0.09 + 0.12, 0.13));
  },

  checkpoint() {
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    osc(ac, 660, "square", t, t + 0.08, 0.12);
    osc(ac, 880, "square", t + 0.08, t + 0.16, 0.12);
  },

  friendJoin() {
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    osc(ac, 523, "sine", t, t + 0.1, 0.1);
    osc(ac, 659, "sine", t + 0.1, t + 0.2, 0.1);
  },

  menuClick() {
    const ac = ctx(); if (!ac) return;
    sweep(ac, 300, 500, 0.06, "square", 0.08);
  },

  xpGain() {
    const ac = ctx(); if (!ac) return;
    const t = ac.currentTime;
    osc(ac, 440, "sine", t, t + 0.05, 0.1);
    osc(ac, 880, "sine", t + 0.06, t + 0.14, 0.1);
  },
};
