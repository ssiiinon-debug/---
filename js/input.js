'use strict';
// Управление: тап, перетаскивание (с инерцией), щипок для зума, колесо мыши.
// Тараканов и огонь ловим уже на нажатии — так быстрее реагирует.

const Input = {
  pointers: new Map(),
  dragging: false,
  consumed: false,
  start: null,
  vel: { x: 0, y: 0 },
  inertia: false,
  pinch: null,
  lastMoveT: 0,

  init(cv) {
    cv.addEventListener('pointerdown', (e) => this.down(e));
    cv.addEventListener('pointermove', (e) => this.move(e));
    cv.addEventListener('pointerup', (e) => this.up(e));
    cv.addEventListener('pointercancel', (e) => this.cancel(e));
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.cancel(e); });
    cv.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    // Никаких контекстных меню, выделения и масштабирования страницы
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS Safari разрешает звук только после touchend/click
    document.addEventListener('touchend', () => Sound.unlock(), { passive: true });
    document.addEventListener('click', () => Sound.unlock());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (UI.modalOpen()) UI.closeModal(); else Game.deselect(); }
    });
  },

  down(e) {
    e.preventDefault();
    Sound.unlock();
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.inertia = false;
    this.vel.x = this.vel.y = 0;
    if (this.pointers.size === 1) {
      this.start = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.dragging = false;
      const w = Render.screenToWorld(e.clientX, e.clientY);
      this.consumed = !Game.isPaused() && Events.hit(Game.s, w.x, w.y, 30 / Render.scale);
    } else if (this.pointers.size === 2) {
      const [a, b] = Array.from(this.pointers.values());
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      this.dragging = true;
    }
  },

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size >= 2 && this.pinch) {
      const [a, b] = Array.from(this.pointers.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (this.pinch.d > 10) Render.zoomAt(mx, my, d / this.pinch.d);
      Render.pan(mx - this.pinch.mx, my - this.pinch.my);
      this.pinch = { d, mx, my };
      return;
    }
    if (!this.start) return;
    if (!this.dragging && Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 9) this.dragging = true;
    if (this.dragging && !this.consumed) {
      Render.pan(dx, dy);
      const now = performance.now();
      const dt = Math.max(1, now - this.lastMoveT) / 1000;
      this.lastMoveT = now;
      this.vel.x = U.lerp(this.vel.x, dx / dt, 0.4);
      this.vel.y = U.lerp(this.vel.y, dy / dt, 0.4);
    }
  },

  up(e) {
    const had = this.pointers.has(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!had) return;
    if (this.pointers.size === 1) { this.pinch = null; return; }
    if (this.pointers.size === 0) {
      this.pinch = null;
      if (!this.dragging && !this.consumed && this.start && !Game.isPaused()) {
        const w = Render.screenToWorld(e.clientX, e.clientY);
        Game.tapWorld(w.x, w.y, e.clientX, e.clientY);
      } else if (this.dragging && performance.now() - this.lastMoveT < 80) {
        this.inertia = true;
      }
      this.start = null;
    }
  },
  cancel(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) { this.start = null; this.pinch = null; }
  },

  wheel(e) {
    e.preventDefault();
    if (e.ctrlKey) Render.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
    else Render.pan(-e.deltaX * 0.8, -e.deltaY * 0.8);
  },

  update(dt) {
    if (!this.inertia) return;
    Render.pan(this.vel.x * dt, this.vel.y * dt);
    const k = Math.exp(-dt * 5);
    this.vel.x *= k;
    this.vel.y *= k;
    if (Math.hypot(this.vel.x, this.vel.y) < 10) this.inertia = false;
  },
};
