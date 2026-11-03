// Звуки синтезируются WebAudio, саундтрек — mp3 из папки audio/
let ctx = null, master = null, enabled = true, muted = false;
const TRACKS = ['audio/track1.mp3', 'audio/track2.mp3', 'audio/track3.mp3'];
let music = null, wantMusic = false, trackIdx = Math.floor(Math.random() * TRACKS.length);
function playMusic() {
  if (!music || !wantMusic || !enabled || muted) return;
  const p = music.play(); if (p && p.catch) p.catch(() => { /* автоплей запрещён до первого касания */ });
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(f, dur, type = 'square', vol = 0.2, f2 = 0, when = 0, out = null) {
  const c = ac(); if (!c || !enabled || muted) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(out || master); o.start(t0); o.stop(t0 + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, vol = 0.3, freq = 1200, when = 0, out = null) {
  const c = ac(); if (!c || !enabled || muted) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + when;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(out || master); s.start(t0); s.stop(t0 + dur + 0.02);
}

let coinStep = 0, lastCoin = 0;
export const Audio = {
  unlock() { ac(); playMusic(); },
  setEnabled(v) { enabled = v; if (!v) this.stopMusic(); },
  get enabled() { return enabled; },
  mute(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.5; if (v) { if (music) music.pause(); } else playMusic(); },

  coin() {
    const now = performance.now();
    coinStep = now - lastCoin < 400 ? Math.min(coinStep + 1, 8) : 0; lastCoin = now;
    const f = 880 * Math.pow(2, coinStep / 24);
    tone(f, 0.07, 'square', 0.08); tone(f * 1.5, 0.12, 'square', 0.07, 0, 0.05);
  },
  jump() { tone(300, 0.18, 'sine', 0.25, 700); },
  roll() { noise(0.25, 0.25, 600); },
  lane() { noise(0.08, 0.12, 2500); },
  land() { noise(0.06, 0.15, 300); },
  stumble() { tone(140, 0.2, 'sawtooth', 0.25, 70); noise(0.15, 0.3, 400); },
  crash() { noise(0.5, 0.6, 250); tone(120, 0.5, 'sawtooth', 0.3, 40); },
  power() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.18, 0, i * 0.06)); },
  shieldBreak() { noise(0.3, 0.4, 3000); tone(900, 0.3, 'triangle', 0.2, 200); },
  click() { tone(660, 0.05, 'square', 0.1); },
  buy() { [784, 988, 1318].forEach((f, i) => tone(f, 0.1, 'square', 0.12, 0, i * 0.07)); },
  whistle() { tone(1800, 0.35, 'sine', 0.15, 2000); tone(1700, 0.25, 'sine', 0.12, 0, 0.4); },

  // Саундтрек: три трека по кругу (файлы в audio/)
  startMusic() {
    if (!enabled) return;
    wantMusic = true;
    if (!music) {
      music = new window.Audio();
      music.volume = 0.6; music.preload = 'auto';
      music.addEventListener('ended', () => { trackIdx = (trackIdx + 1) % TRACKS.length; music.src = TRACKS[trackIdx]; playMusic(); });
      music.src = TRACKS[trackIdx];
    }
    playMusic();
  },
  stopMusic() { wantMusic = false; if (music) music.pause(); },
  pauseMusic() { if (music) music.pause(); },
  nextTrack() { if (!music) return; trackIdx = (trackIdx + 1) % TRACKS.length; music.src = TRACKS[trackIdx]; playMusic(); },
};
