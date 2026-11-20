// The walk-in: our guy strolls into the casino and sits down at the table.
import { ease, panel } from "./core.js";

const SPEED = 380;

export class IntroScene {
  constructor(app) {
    this.app = app; this.name = "intro"; this.alive = true; this.done = false;
    this.m = app.assets.meta.intro; this.frame = "walk0"; this.dealerKey = "dealer"; this.x = 0; this.bubble = null;
  }
  start() {
    const m = this.m;
    this.app.session.introSeen = true;
    this.x0 = m.stop_x - Math.round((m.stop_x + 80) / (m.stride / 2)) * (m.stride / 2);
    this.x = this.x0;
    this.app.keepAlive++;
    this.script().catch(() => {});
  }
  onDestroy() { this.alive = false; this.app.keepAlive--; }
  finish() { if (this.done) return; this.done = true; this.app.goto("table"); }
  onKey(key) { if ([" ", "Enter", "Escape"].includes(key)) { this.finish(); return true; } return false; }
  onBackground() { this.finish(); }

  async tw(dur, fn, e = ease.linear) { await this.app.tween(dur, fn, e, "ui", this); if (!this.alive) throw new Error("gone"); }

  async script() {
    const a = this.app, m = this.m, snd = a.sound, { walk, stop, sit } = m.frames;
    await this.tw(0.3, () => {});
    snd.play("whoosh", 0.4);
    const dist = m.stop_x - this.x0;
    let lastStep = -1;
    await this.tw(dist / SPEED, (t) => {
      this.x = this.x0 + dist * t;
      const ph = ((this.x - this.x0) / m.stride) % 1;
      this.frame = "walk" + (Math.round(ph * walk) % walk);
      const steps = Math.trunc(((this.x - this.x0) / m.stride) * 2 + 0.5);
      if (steps !== lastStep) { lastStep = steps; snd.play("step", 0.55); }
    });
    for (let i = 0; i < stop; i++) { this.frame = "stop" + i; await this.tw(0.05, () => {}); }
    await this.tw(0.12, () => {});
    for (let i = 0; i < sit; i++) {
      this.frame = "sit" + i;
      if (i === Math.trunc(sit * 0.55)) snd.play("chair", 0.8);
      await this.tw(0.05, () => {});
    }
    await this.tw(0.25, () => {});
    for (let k = 0; k < 3; k++) {
      this.dealerKey = k === 0 ? "dealer_nod" : "dealer_talk";
      if (k === 0) { this.bubble = { text: "Welcome! Take a seat and place your bets.", t0: performance.now() }; snd.play("notify", 0.35); }
      await this.tw(0.22, () => {});
      this.dealerKey = "dealer";
      await this.tw(0.22, () => {});
    }
    await this.tw(0.7, () => {});
    this.finish();
  }

  draw(ctx) {
    const a = this.app, m = this.m, as = a.assets;
    as.background(ctx, a, "intro_bg");
    const sc = 1 / as.meta.char_scale, rect = (k) => as._rect("intro", k);
    const [dax, day] = m.dealer_anchor;
    as.introSprite(ctx, this.dealerKey, 1330 - dax, m.table_top + 2 - day);
    as.introSprite(ctx, "table", ...m.layers.table);
    as.introSprite(ctx, "chair", ...m.layers.chair);
    const sh = rect("shadow");
    if (sh) as.introSprite(ctx, "shadow", this.x - (sh[2] * sc) / 2, m.floor_y + 2 - (sh[3] * sc) / 2);
    as.introSprite(ctx, this.frame, this.x - m.guy_anchor[0], m.floor_y - m.guy_anchor[1]);
    if (this.bubble) {
      const text = this.bubble.text, tw = a.measure(text, { size: 18, weight: "bold" }) + 44, x = 1300 - tw / 2 - 10, y = 418;
      const pop = Math.min(1, (performance.now() - this.bubble.t0) / 300);
      ctx.save(); ctx.translate(x, y); ctx.scale(0.7 + 0.3 * ease.outBack(pop), 0.7 + 0.3 * ease.outBack(pop));
      panel(ctx, -tw / 2, -26, tw, 52, { r: 24, fill: "rgba(250,246,236,0.98)", border: "rgba(120,90,40,0.8)", shadow: true });
      ctx.beginPath(); ctx.moveTo(tw * 0.28, 25); ctx.lineTo(tw * 0.4, 25); ctx.lineTo(tw * 0.43, 42); ctx.closePath(); ctx.fillStyle = "rgba(250,246,236,0.98)"; ctx.fill();
      a.text(text, 0, 1, { size: 18, weight: "bold", color: "#2a1c0c", shadow: null });
      ctx.restore();
    }
    a.text("Click or press Space to skip", 800, 878, { size: 14, color: "#d8c9a6" });
  }
}
