'use strict';
// Эффекты: всплывающие «+12», монетки, искры, пыль от ремонта, брызги пены.

const FX = {
  texts: [],
  parts: [],
  flying: [],
  hudTarget: { x: 60, y: 30 },

  text(x, y, str, color, size, life) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, str, color: color || '#ffd23f', size: size || 16, t: 0, life: life || 1.1, vx: U.rand(-6, 6) });
  },
  burst(x, y, n, colors, speed, size, grav, life) {
    for (let k = 0; k < n; k++) {
      if (this.parts.length > 300) this.parts.shift();
      const a = Math.random() * Math.PI * 2, v = U.rand(0.4, 1) * (speed || 120);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (speed || 120) * 0.4,
        g: grav === undefined ? 300 : grav, t: 0, life: (life || 0.7) * U.rand(0.7, 1.2),
        c: U.pick(colors), r: (size || 4) * U.rand(0.6, 1.2), kind: 'dot',
      });
    }
  },
  coins(x, y, n) {
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + U.rand(-0.9, 0.9), v = U.rand(80, 160);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420, t: 0, life: 0.7, c: PAL.coin, r: 5, kind: 'coin' });
    }
  },
  sparkle(x, y, n) { this.burst(x, y, n || 14, ['#fff7a8', '#ffd23f', '#ffffff', '#7df0ff'], 140, 3.5, 60, 0.8); },
  dust(x, y, n) {
    for (let k = 0; k < (n || 12); k++) {
      this.parts.push({ x: x + U.rand(-70, 70), y: y + U.rand(-40, 40), vx: U.rand(-20, 20), vy: U.rand(-30, -5), g: 0, t: 0, life: U.rand(0.6, 1.1), c: 'rgba(230,220,200,0.8)', r: U.rand(8, 16), kind: 'puff' });
    }
  },
  splat(x, y) { this.burst(x, y, 8, ['#7a4a22', '#5a3416', '#c9a06a'], 90, 3, 200, 0.4); },
  foam(x, y) { this.burst(x, y, 10, ['#ffffff', '#e8f4ff', '#cfe8ff'], 110, 6, 40, 0.6); },
  // Монетки летят из мира в счётчик наверху (экранные координаты)
  fly(sx, sy, n) {
    for (let k = 0; k < n; k++) {
      if (this.flying.length > 40) break;
      this.flying.push({ x: sx + U.rand(-14, 14), y: sy + U.rand(-10, 10), t: -k * 0.05, life: 0.6 + Math.random() * 0.15, sx: sx, sy: sy, ox: U.rand(-60, 60), oy: U.rand(-80, -20) });
    }
  },

  update(dt) {
    for (let k = this.texts.length - 1; k >= 0; k--) {
      const p = this.texts[k];
      p.t += dt;
      if (p.t >= p.life) this.texts.splice(k, 1);
    }
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const p = this.parts[k];
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.t >= p.life) this.parts.splice(k, 1);
    }
    for (let k = this.flying.length - 1; k >= 0; k--) {
      const p = this.flying[k];
      p.t += dt;
      if (p.t >= p.life) { this.flying.splice(k, 1); UI.pulseCoins(); }
    }
  },

  drawWorld(ctx, scale) {
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, a);
      if (p.kind === 'coin') A.coinIcon(ctx, p.x, p.y, p.r);
      else if (p.kind === 'puff') A.circ(ctx, p.x, p.y, p.r * (1 + p.t), p.c, null);
      else A.circ(ctx, p.x, p.y, p.r, p.c, null);
    }
    ctx.globalAlpha = 1;
    const minSize = 13 / scale;
    for (const p of this.texts) {
      const k = p.t / p.life;
      const size = Math.max(p.size, minSize) * (k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1);
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      A.text(ctx, p.str, p.x + p.vx * p.t, p.y - 30 * U.easeOutCubic(k) - 10 * k, size, p.color, 'center', 900, INK);
    }
    ctx.globalAlpha = 1;
  },
  drawScreen(ctx) {
    const tx = this.hudTarget.x, ty = this.hudTarget.y;
    for (const p of this.flying) {
      if (p.t < 0) continue;
      const k = U.easeInOut(Math.min(1, p.t / p.life));
      const mx = (p.sx + tx) / 2 + p.ox, my = Math.min(p.sy, ty) + p.oy;
      const x = (1 - k) * (1 - k) * p.x + 2 * (1 - k) * k * mx + k * k * tx;
      const y = (1 - k) * (1 - k) * p.y + 2 * (1 - k) * k * my + k * k * ty;
      A.coinIcon(ctx, x, y, 7);
    }
  },
};
