// App framework: one canvas drawn in a 1600x900 design space (letterboxed, the
// felt fills the rest), pointer + key input, tweens you can await, scenes.

export const DW = 1600, DH = 900;

export const ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => { t -= 1; return t * t * ((s + 1) * t + s) + 1; },
};

/** Thrown inside a scene's async code when the scene has been closed. */
export class Cancelled extends Error {}

const FONTS = {
  ui: '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, "DejaVu Sans", Arial, sans-serif',
  display: 'Georgia, "Palatino Linotype", "Times New Roman", "DejaVu Serif", serif',
  num: 'Bahnschrift, "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, "DejaVu Sans", sans-serif',
};

export class App {
  constructor(canvas, store, sound, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.store = store; this.sound = sound; this.assets = assets;
    this.W = 800; this.H = 450; this.S = 0.5; this.ox = 0; this.oy = 0;
    this.touch = matchMedia("(pointer: coarse)").matches;
    this.scene = null;
    this.tweens = [];
    this.hits = []; this.nextHits = [];
    this.pointer = { x: -1e4, y: -1e4, down: false, pressId: null, inside: false };
    this.hoverId = null;
    this.locked = false;           // a modal is open: the scene underneath registers no hits
    this.toasts = [];
    this.modal = null;
    this.dirty = true;
    this.last = performance.now();
    this.session = {};
    this.keepAlive = 0;            // >0 while something animates forever (menu cards, etc.)
    this._bind();
    requestAnimationFrame((t) => this._frame(t));
  }

  // ------------------------------------------------------------ geometry
  /** Visible area in design units. */
  get view() { return [-this.ox / this.S, -this.oy / this.S, (this.W - this.ox) / this.S, (this.H - this.oy) / this.S]; }

  resize(cssW, cssH) {
    // Retina screens get up to 2x; the cap keeps big monitors cheap to fill.
    let k = Math.min(window.devicePixelRatio || 1, 2);
    k = Math.min(k, Math.sqrt(6.5e6 / (cssW * cssH)));
    this.W = Math.max(2, Math.round(cssW * k)); this.H = Math.max(2, Math.round(cssH * k));
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.S = Math.min(this.W / DW, this.H / DH);
    this.ox = (this.W - DW * this.S) / 2; this.oy = (this.H - DH * this.S) / 2;
    this.invalidate();
  }

  invalidate() { this.dirty = true; }

  // ------------------------------------------------------------ scenes
  setScene(SceneClass, opts = {}) {
    if (this.scene) { this.scene.alive = false; this.scene.onDestroy?.(); this.tweens = this.tweens.filter((t) => t.owner !== this.scene); }
    this.closeModal();
    this.toasts = [];
    this.hits = []; this.nextHits = [];
    this.hoverId = null; this.pointer.pressId = null;
    this.scene = new SceneClass(this, opts);
    this.scene.start?.();
    this.invalidate();
  }

  // ------------------------------------------------------------ tweens
  /** Run fn(eased t) over `dur` seconds; resolves when finished. clock "game" follows the animation-speed setting. */
  tween(dur, fn, easing = ease.outCubic, clock = "game", owner = this.scene) {
    if (clock === "game") dur *= this.store.animMult();
    return new Promise((resolve) => {
      if (dur <= 0) { fn(easing(1)); resolve(); return; }
      this.tweens.push({ t: 0, dur, fn, easing, resolve, owner });
      this.invalidate();
    });
  }
  wait(sec, clock = "game") { return this.tween(sec, () => {}, ease.linear, clock); }

  // ------------------------------------------------------------ hits (immediate-mode input)
  /** Register a clickable rect for this frame. Later registrations sit on top. */
  hit(h) {
    if (this.locked && !h.modal) return;
    const pad = this.touch ? (h.pad ?? 9) : 0;
    this.nextHits.push({ ...h, x0: h.x - h.w / 2 - pad, y0: h.y - h.h / 2 - pad, x1: h.x + h.w / 2 + pad, y1: h.y + h.h / 2 + pad });
  }
  _hitAt(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h;
    }
    return null;
  }
  isHover(id) { return !this.touch && this.hoverId === id; }
  isPressed(id) { return this.pointer.down && this.pointer.pressId === id && this.hoverId === id; }

  // ------------------------------------------------------------ modal / toast
  openModal(m) {
    return new Promise((resolve) => {
      this.modal = { ...m, resolve, t0: performance.now() };
      this.sound.play("pop", 0.6);
      this.invalidate();
    });
  }
  closeModal(value) {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    m.resolve(value);
    this.invalidate();
  }
  toast(text, kind = "info", dur = 2.2) {
    this.toasts = this.toasts.filter((t) => t.text !== text);
    this.toasts.push({ text, kind, dur, t: 0 });
    this.invalidate();
  }

  // ------------------------------------------------------------ input
  _design(e) {
    const r = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) * this.W) / r.width, py = ((e.clientY - r.top) * this.H) / r.height;
    return [(px - this.ox) / this.S, (py - this.oy) / this.S];
  }
  _bind() {
    const c = this.canvas, p = this.pointer;
    c.addEventListener("pointermove", (e) => {
      [p.x, p.y] = this._design(e);
      if (e.pointerType !== "mouse" && !p.down) return;
      const h = this._hitAt(p.x, p.y);
      this.hoverId = h ? h.id : null;
      if (p.down && p.pressId) { const ph = this.hits.find((x) => x.id === p.pressId); ph?.drag?.(p.x, p.y); }
      c.style.cursor = h && h.enabled !== false ? "pointer" : "default";
      this.invalidate();
    });
    c.addEventListener("pointerdown", (e) => {
      if (e.button === 2) return;
      this.sound.unlock();
      [p.x, p.y] = this._design(e);
      p.down = true;
      const h = this._hitAt(p.x, p.y);
      this.hoverId = h ? h.id : null;
      try { c.setPointerCapture(e.pointerId); } catch { /* no capture */ }
      if (h && h.enabled === false) { this.sound.play("deny", 0.5); h.disabledTip && this.toast(h.disabledTip, "bad", 1.4); p.pressId = null; }
      else if (h) { p.pressId = h.id; h.drag?.(p.x, p.y); h.press?.(p.x, p.y); }
      else { p.pressId = null; this.scene?.onBackground?.(p.x, p.y); }
      this.invalidate();
    });
    const up = (e) => {
      if (!p.down) return;
      [p.x, p.y] = this._design(e);
      p.down = false;
      const h = this._hitAt(p.x, p.y);
      if (h && h.id === p.pressId && h.enabled !== false) { h.fn?.(); }
      p.pressId = null;
      if (e.pointerType !== "mouse") this.hoverId = null;
      this.invalidate();
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", () => { p.down = false; p.pressId = null; this.invalidate(); });
    c.addEventListener("pointerleave", () => { if (!p.down) { this.hoverId = null; this.invalidate(); } });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("wheel", (e) => { e.preventDefault(); this.scene?.onWheel?.(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      this.sound.unlock();
      const k = e.key;
      if (this.modal) {
        const m = this.modal;
        if (k === "Escape" && m.cancel !== undefined) { this.closeModal(m.cancel); e.preventDefault(); return; }
        if ((k === "Enter" || k === " ") && m.default !== undefined) { this.closeModal(m.default); e.preventDefault(); return; }
        const hot = m.keys?.[k.toLowerCase()];
        if (hot !== undefined) { this.closeModal(hot); e.preventDefault(); return; }
        return;
      }
      if (k === "F11") { e.preventDefault(); this.toggleFullscreen(); return; }
      const handled = this.scene?.onKey?.(k, e);
      if (handled) { e.preventDefault(); this.invalidate(); }
      else if ((k === "m" || k === "M") && !(this.scene?.name === "table" && false)) { this.toggleMute(); e.preventDefault(); }
    });
  }

  toggleMute() {
    const s = this.store.settings;
    s.muted = !s.muted;
    this.store.save();
    this.toast(s.muted ? "Sound off" : "Sound on", "info", 1);
    this.scene?.onAudioChanged?.();
  }
  toggleFullscreen(v) {
    const el = document.getElementById("app");
    const on = v ?? !document.fullscreenElement;
    try { if (on) el.requestFullscreen?.(); else document.exitFullscreen?.(); } catch { /* refused */ }
    this.store.settings.fullscreen = on;
    this.store.save();
  }

  // ------------------------------------------------------------ frame loop
  _frame(now) {
    requestAnimationFrame((t) => this._frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    let active = this.tweens.length > 0 || this.toasts.length > 0 || this.keepAlive > 0 || !!this.modal;
    if (this.tweens.length) {
      const done = [];
      for (const tw of this.tweens) {
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur);
        try { tw.fn(tw.easing(k)); } catch (e) { console.error(e); }
        if (k >= 1) done.push(tw);
      }
      if (done.length) { this.tweens = this.tweens.filter((t) => !done.includes(t)); for (const d of done) d.resolve(); }
    }
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < t.dur + 0.6);
    this.scene?.update?.(dt);
    if (!(this.dirty || active)) return;
    this.dirty = false;
    this._draw();
  }

  _draw() {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#06120a";
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.setTransform(this.S, 0, 0, this.S, this.ox, this.oy);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    this.nextHits = [];
    this.locked = !!this.modal;
    try { this.scene?.draw(ctx); } catch (e) { console.error(e); }
    if (this.modal) this._drawModal();
    this._drawToasts();
    this.hits = this.nextHits;
    // keep hover in step with what is under a stationary pointer after a redraw
    if (!this.touch && this.pointer.inside !== null) {
      const h = this._hitAt(this.pointer.x, this.pointer.y);
      const id = h ? h.id : null;
      if (id !== this.hoverId && !this.pointer.down) this.hoverId = id;
    }
    this.locked = false;
  }

  // text: size in design units
  text(str, x, y, o = {}) {
    const { ctx } = this, size = o.size || 18;
    ctx.font = `${o.italic ? "italic " : ""}${o.weight || "normal"} ${size}px ${FONTS[o.family || "ui"]}`;
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = o.base || "middle";
    const sh = o.shadow === undefined || o.shadow === true ? "rgba(0,0,0,0.85)" : o.shadow;
    if (sh) {
      const off = o.shadowOff ?? Math.max(1, size * 0.07);
      ctx.fillStyle = sh;
      ctx.fillText(str, x + off, y + off, o.maxW);
    }
    ctx.fillStyle = o.color || "#f4ecd8";
    ctx.fillText(str, x, y, o.maxW);
  }
  measure(str, o = {}) {
    const { ctx } = this;
    ctx.font = `${o.italic ? "italic " : ""}${o.weight || "normal"} ${o.size || 18}px ${FONTS[o.family || "ui"]}`;
    return ctx.measureText(str).width;
  }
  /** Wrapped paragraph; returns the height used. */
  paragraph(str, x, y, width, o = {}) {
    const words = str.split(" "), lines = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (cur && this.measure(t, o) > width) { lines.push(cur); cur = w; } else cur = t;
    }
    lines.push(cur);
    const lh = (o.size || 18) * 1.35;
    lines.forEach((l, i) => this.text(l, x, y + i * lh, { ...o, base: "top", shadow: o.shadow ?? null }));
    return lines.length * lh;
  }

  _drawToasts() {
    const { ctx } = this, [vx0, vy0] = this.view;
    let y = vy0 + 70;
    for (const t of this.toasts) {
      const kk = this.touch ? 1.35 : 1, size = 17 * kk;
      const col = { info: "#e9c46a", good: "#6ed282", bad: "#f06e64", gold: "#ffd25a" }[t.kind] || "#e9c46a";
      const w = this.measure(t.text, { size, weight: "bold" }) + 56 * kk, h = 46 * kk;
      const a = Math.min(1, t.t / 0.25, (t.dur + 0.6 - t.t) / 0.4);
      const slide = (1 - ease.outBack(Math.min(1, t.t / 0.32))) * -60;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(0, y + slide);
      roundRect(ctx, 800 - w / 2, -h / 2, w, h, h / 2);
      ctx.fillStyle = "rgba(14,15,18,0.93)"; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      this.text(t.text, 800, 0, { size, weight: "bold", color: col, shadow: null });
      ctx.restore();
      y += h + 10;
    }
  }

  _drawModal() {
    const m = this.modal, { ctx } = this, [vx0, vy0, vx1, vy1] = this.view;
    const k = this.touch ? 1.35 : 1;
    const a = Math.min(1, (performance.now() - m.t0) / 140);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(vx0 - 10, vy0 - 10, vx1 - vx0 + 20, vy1 - vy0 + 20);
    this.hit({ id: "modal-bg", x: 800, y: 450, w: 8000, h: 6000, modal: true, pad: 0 });
    const width = (m.width || 560) * k, bodyW = width - 70 * k, size = 17 * k;
    const bodyH = m.body ? this.paragraph(m.body, 0, -9999, bodyW, { size }) : 0;
    const extraH = m.extraH || 0;
    const h = 70 * k + (m.body ? bodyH + 18 * k : 0) + extraH + 86 * k;
    const cy = m.cy ?? 450, top = cy - h / 2;
    panel(ctx, 800 - width / 2, top, width, h, { r: 18, fill: "rgba(16,18,22,0.97)", border: "rgba(233,196,106,0.7)", shadow: true });
    this.text(m.title, 800, top + 40 * k, { size: 24 * k, weight: "bold", family: "display", color: "#f2d07a" });
    let y = top + 70 * k;
    if (m.body) { ctx.textAlign = "center"; this.paragraph(m.body, 800, y, bodyW, { size, color: "#ece4d2", align: "center" }); y += bodyH + 18 * k; }
    m.extra?.(800, y, width);
    const btns = m.buttons, n = btns.length, bw = Math.min(220 * k, (width - 60 * k - (n - 1) * 16) / n);
    const x0 = 800 - (n * bw + (n - 1) * 16) / 2 + bw / 2, by = top + h - 48 * k;
    btns.forEach((b, i) => {
      button(this, { id: "modal-" + i, x: x0 + i * (bw + 16), y: by, w: bw, h: 50 * k, label: b.label, style: b.style || "dark", size: 17 * k, modal: true, fn: () => this.closeModal(b.value) });
    });
    ctx.restore();
  }
}

// ------------------------------------------------------------------ drawing helpers
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.save();
  if (o.shadow) { ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8; }
  roundRect(ctx, x, y, w, h, o.r ?? 14);
  if (o.gradient) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.gradient[0]); g.addColorStop(1, o.gradient[1]); ctx.fillStyle = g; }
  else ctx.fillStyle = o.fill || "rgba(16,18,22,0.9)";
  ctx.fill();
  ctx.shadowColor = "transparent";
  if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = o.bw ?? 1.6; ctx.stroke(); }
  ctx.restore();
}

export const BUTTON_STYLES = {
  gold: ["#fad670", "#cd9428", "#7a520e", "#281a04"],
  green: ["#50ba60", "#207c34", "#0e461a", "#ffffff"],
  red: ["#ea5c50", "#aa2622", "#5c100e", "#ffffff"],
  blue: ["#5896ec", "#265cba", "#102e68", "#ffffff"],
  amber: ["#ffba54", "#da7c16", "#703a06", "#281604"],
  purple: ["#a674e6", "#6c3cb2", "#3a1a68", "#ffffff"],
  slate: ["#8690a0", "#505868", "#262a34", "#ffffff"],
  dark: ["#3e424c", "#1e2026", "#0c0c10", "#f0e8d6"],
  felt: ["#287850", "#124a2c", "#082816", "#ffffff"],
  ghost: [null, null, "#e9c46a", "#e9c46a"],
};

/** A pill button. Draws and registers its hit rect. o: {id,x,y,w,h,label,style,icon,size,enabled,fn,keycap,disabledTip,modal} */
export function button(app, o) {
  const { ctx } = app, st = BUTTON_STYLES[o.style || "dark"], enabled = o.enabled !== false;
  const hover = enabled && app.isHover(o.id), press = enabled && app.isPressed(o.id);
  const dy = press ? 2 : hover ? -1.5 : 0, r = o.h / 2;
  const x = o.x - o.w / 2, y = o.y - o.h / 2 + dy;
  ctx.save();
  if (!enabled) ctx.globalAlpha = 0.45;
  if (o.style === "ghost") {
    roundRect(ctx, x, y, o.w, o.h, r);
    ctx.fillStyle = hover ? "rgba(233,196,106,0.18)" : "rgba(8,10,12,0.62)"; ctx.fill();
    ctx.strokeStyle = "rgba(233,196,106,0.85)"; ctx.lineWidth = 1.8; ctx.stroke();
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = press ? 3 : 9; ctx.shadowOffsetY = press ? 1 : 4;
    roundRect(ctx, x, y, o.w, o.h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + o.h);
    const lift = hover ? 0.1 : 0;
    g.addColorStop(0, shade(st[0], lift)); g.addColorStop(1, shade(st[1], lift));
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = st[2]; ctx.lineWidth = 1.6; ctx.stroke();
    roundRect(ctx, x + 2, y + 2, o.w - 4, o.h * 0.48, r - 2);       // soft top gloss
    const gl = ctx.createLinearGradient(0, y, 0, y + o.h * 0.5);
    gl.addColorStop(0, "rgba(255,255,255,0.28)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gl; ctx.fill();
  }
  const color = st[3], size = o.size || Math.max(11, o.h * 0.34);
  const iconSize = o.iconSize || size * 1.25;
  let tx = o.x;
  if (o.icon && o.label) {
    const tw = app.measure(o.label, { size, weight: "bold" });
    const total = iconSize + 10 + tw, left = o.x - total / 2;
    app.assets.drawIcon(ctx, o.icon, left + iconSize / 2, o.y + dy, iconSize, color);
    tx = left + iconSize + 10 + tw / 2;
  } else if (o.icon) app.assets.drawIcon(ctx, o.icon, o.x, o.y + dy, iconSize, color);
  if (o.label) app.text(o.label, tx, o.y + dy + 1, { size, weight: "bold", color, shadow: o.style === "ghost" || o.style === "gold" || o.style === "amber" ? null : "rgba(0,0,0,0.6)", shadowOff: 1.2 });
  ctx.restore();
  if (o.keycap && !app.touch) {
    const kc = { size: 11.5, weight: "bold", color: "#d2c294", family: "num", shadow: null };
    if (o.keycapSide === "right") app.text(o.keycap, o.x + o.w / 2 + 9, o.y, { ...kc, align: "left" });
    else app.text(o.keycap, o.x, o.y + o.h / 2 + 10, kc);
  }
  app.hit({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, fn: o.fn, enabled, disabledTip: o.disabledTip, modal: o.modal });
}

export function shade(hex, amt) {
  if (!amt) return hex;
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * amt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
