// Procedural 8-bit lobby music using Web Audio API

let _ctx: AudioContext | null = null;
let _playing = false;
let _stopFns: (() => void)[] = [];

const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

const MELODY = [
  // bar 1
  [523, 1], [0, 0.5], [659, 0.5], [784, 1], [659, 1],
  // bar 2
  [523, 1], [0, 0.5], [440, 0.5], [523, 2],
  // bar 3
  [392, 1], [0, 0.5], [523, 0.5], [659, 1], [784, 1],
  // bar 4
  [880, 1], [784, 0.5], [659, 0.5], [523, 2],
];

const BASS = [
  [130, 1], [130, 1], [174, 1], [146, 1],
  [130, 1], [130, 1], [110, 1], [110, 1],
  [98, 1],  [98, 1],  [130, 1], [130, 1],
  [110, 1], [110, 1], [130, 1], [130, 1],
];

function getCtx(): AudioContext | null {
  if (!_ctx) {
    try { _ctx = new AudioContext(); } catch { return null; }
  }
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

function playNote(ac: AudioContext, freq: number, startT: number, dur: number, vol: number, type: OscillatorType) {
  if (freq === 0) return;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, startT);
  g.gain.linearRampToValueAtTime(vol, startT + 0.01);
  g.gain.setValueAtTime(vol, startT + dur * 0.75);
  g.gain.linearRampToValueAtTime(0, startT + dur * 0.95);
  g.connect(ac.destination);
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  o.start(startT);
  o.stop(startT + dur);
}

function scheduleLoop(ac: AudioContext, loopStart: number): number {
  let t = loopStart;
  // Melody
  for (const [freq, beats] of MELODY) {
    playNote(ac, freq as number, t, (beats as number) * BEAT * 0.92, 0.08, "square");
    t += (beats as number) * BEAT;
  }

  // Bass
  t = loopStart;
  for (const [freq, beats] of BASS) {
    playNote(ac, freq as number, t, (beats as number) * BEAT * 0.8, 0.12, "triangle");
    t += (beats as number) * BEAT;
  }

  // Hi-hat (every beat)
  for (let i = 0; i < 16; i++) {
    const ht = loopStart + i * BEAT;
    const size = Math.ceil(ac.sampleRate * 0.04);
    const buf = ac.createBuffer(1, size, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < size; j++) data[j] = (Math.random() * 2 - 1);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 8000;
    const g = ac.createGain();
    g.gain.setValueAtTime(i % 2 === 0 ? 0.05 : 0.03, ht);
    g.gain.exponentialRampToValueAtTime(0.001, ht + 0.04);
    src.connect(filt);
    filt.connect(g);
    g.connect(ac.destination);
    src.start(ht);
    src.stop(ht + 0.05);
  }

  // Kick (beats 1 and 3)
  for (const beat of [0, 2, 4, 6, 8, 10, 12, 14]) {
    const kt = loopStart + beat * BEAT;
    const ko = ac.createOscillator();
    const kg = ac.createGain();
    ko.frequency.setValueAtTime(160, kt);
    ko.frequency.exponentialRampToValueAtTime(40, kt + 0.15);
    kg.gain.setValueAtTime(0.2, kt);
    kg.gain.exponentialRampToValueAtTime(0.001, kt + 0.18);
    ko.connect(kg);
    kg.connect(ac.destination);
    ko.start(kt);
    ko.stop(kt + 0.2);
  }

  // Return loop end time
  return loopStart + MELODY.reduce((s, [, b]) => s + (b as number), 0) * BEAT;
}

export const lobbyMusic = {
  start() {
    if (_playing) return;
    const ac = getCtx();
    if (!ac) return;
    _playing = true;

    let loopStart = ac.currentTime + 0.1;
    const loopDuration = MELODY.reduce((s, [, b]) => s + (b as number), 0) * BEAT;

    const schedule = () => {
      if (!_playing) return;
      const end = scheduleLoop(ac, loopStart);
      loopStart += loopDuration;
      const timeout = setTimeout(schedule, (loopDuration - 0.5) * 1000);
      _stopFns.push(() => clearTimeout(timeout));
    };

    schedule();
  },

  stop() {
    _playing = false;
    _stopFns.forEach(fn => fn());
    _stopFns = [];
  },

  isPlaying() { return _playing; },
};
