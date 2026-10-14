'use strict';
// Звуки синтезируются WebAudio прямо в браузере — никаких файлов.
// Важно для модерации Яндекса: звук выключается при сворачивании вкладки и во время рекламы.

const Sound = {
  ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null,
  sfxOn: true, musicOn: true, muted: false,
  lastPlay: {},
  musicTimer: null, nextBeat: 0, beat: 0,

  // Браузеры разрешают звук только после первого касания
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.muted) this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.5 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.1 : 0;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startMusic();
    } catch (e) { this.ctx = null; }
  },

  setSfx(on) { this.sfxOn = on; if (this.sfxBus) this.sfxBus.gain.value = on ? 0.5 : 0; },
  setMusic(on) { this.musicOn = on; if (this.musicBus) this.musicBus.gain.value = on ? 0.1 : 0; },
  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    if (m) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  },

  tone(type, f0, f1, dur, vol, when, bus) {
    const c = this.ctx, t0 = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol, freq, q, when, type) {
    const c = this.ctx, t0 = c.currentTime + (when || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.02);
  },

  play(name) {
    if (!this.ctx || this.muted || !this.sfxOn) return;
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < 45) return;
    this.lastPlay[name] = now;
    try {
      switch (name) {
        case 'coin':
          this.tone('sine', 1320, 1320, 0.08, 0.25);
          this.tone('sine', 1760, 1760, 0.14, 0.22, 0.06);
          break;
        case 'tap': this.tone('triangle', 620 + Math.random() * 120, 380, 0.06, 0.2); break;
        case 'buy':
          this.tone('square', 523, 523, 0.07, 0.08);
          this.tone('square', 659, 659, 0.07, 0.08, 0.06);
          this.tone('square', 784, 784, 0.12, 0.08, 0.12);
          break;
        case 'stage':
          [523, 659, 784, 1047].forEach((f, k) => this.tone('triangle', f, f, 0.22, 0.25, k * 0.09));
          this.tone('sine', 2093, 2093, 0.4, 0.1, 0.36);
          break;
        case 'error': this.tone('sawtooth', 180, 140, 0.18, 0.12); break;
        case 'squish': this.noise(0.08, 0.5, 900, 2); this.tone('sine', 140, 60, 0.08, 0.3); break;
        case 'spray': this.noise(0.22, 0.35, 3000, 0.7, 0, 'highpass'); break;
        case 'alarm':
          for (let k = 0; k < 4; k++) this.tone('square', k % 2 ? 660 : 880, k % 2 ? 660 : 880, 0.14, 0.07, k * 0.15);
          break;
        case 'event':
          this.tone('sine', 880, 880, 0.5, 0.2);
          this.tone('sine', 1320, 1320, 0.5, 0.12, 0.08);
          break;
        case 'parcel': [784, 988, 1175, 1568].forEach((f, k) => this.tone('sine', f, f, 0.18, 0.2, k * 0.07)); break;
        case 'meow': this.tone('sine', 700, 520, 0.18, 0.2); this.tone('sine', 560, 760, 0.22, 0.18, 0.16); break;
        case 'fix': this.tone('square', 1500, 1500, 0.04, 0.08); this.tone('square', 2400, 2400, 0.05, 0.06, 0.05); break;
        case 'trash': this.noise(0.15, 0.3, 1600, 1.5); this.tone('triangle', 400, 700, 0.1, 0.12, 0.03); break;
        case 'whoosh': this.noise(0.4, 0.3, 500, 0.8); break;
        case 'goal': [659, 784, 988, 1319].forEach((f, k) => this.tone('triangle', f, f, 0.16, 0.2, k * 0.08)); break;
        case 'open': this.tone('triangle', 330, 660, 0.18, 0.2); this.tone('sine', 990, 990, 0.2, 0.12, 0.12); break;
        case 'fail': this.tone('triangle', 440, 220, 0.4, 0.2); break;
      }
    } catch (e) { /* звук — не повод падать */ }
  },

  // Спокойный «лоу-фай» луп: Am7 – Dm7 – G7 – Cmaj7
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const chords = [[220, 261.6, 329.6, 392], [293.7, 349.2, 440, 523.3], [196, 246.9, 293.7, 349.2], [261.6, 329.6, 392, 493.9]];
    const bass = [110, 146.8, 98, 130.8];
    const melody = [659.3, 587.3, 523.3, 587.3, 659.3, 784, 659.3, 523.3, 587.3, 523.3, 493.9, 440, 523.3, 587.3, 659.3, 0];
    const spb = 60 / 76;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this.musicOn || this.ctx.state !== 'running') { if (this.ctx) this.nextBeat = this.ctx.currentTime + 0.1; return; }
      while (this.nextBeat < this.ctx.currentTime + 0.4) {
        const b = this.beat, bar = Math.floor(b / 4) % 4, when = this.nextBeat - this.ctx.currentTime;
        if (b % 4 === 0) {
          for (const f of chords[bar]) this.tone('triangle', f, f, spb * 3.6, 0.05, when, this.musicBus);
          this.tone('sine', bass[bar], bass[bar], spb * 1.8, 0.22, when, this.musicBus);
        }
        if (b % 4 === 2) this.tone('sine', bass[bar] * 1.5, bass[bar] * 1.5, spb * 0.9, 0.12, when, this.musicBus);
        const m = melody[b % 16];
        if (m && (b % 2 === 0 || Math.random() < 0.3)) this.tone('sine', m, m, spb * 0.8, 0.06, when + 0.02, this.musicBus);
        this.beat++;
        this.nextBeat += spb;
      }
    }, 120);
  },
};
