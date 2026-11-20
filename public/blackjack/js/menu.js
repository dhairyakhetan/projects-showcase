// Main menu: the title and buttons on the left, the hero cards and balance on the right.
import { button, panel } from "./core.js";
import { fmtMoney } from "./engine.js";

export class MenuScene {
  constructor(app) { this.app = app; this.name = "menu"; this.alive = true; this.t = 0; this.focus = -1; }

  start() {
    const a = this.app, st = a.store;
    a.keepAlive++;
    if (st.firstRun && !a.session.welcomed) {
      a.session.welcomed = true;
      a.toast(`Welcome! You start with ${fmtMoney(st.bankroll)}`, "gold", 3);
    }
  }
  onDestroy() { this.app.keepAlive--; this.alive = false; }
  update(dt) { this.t += dt; }

  items() {
    const a = this.app;
    return [
      { label: "Play", style: "gold", icon: "play", fn: () => a.startPlay(), key: "p" },
      { label: "Statistics", style: "dark", icon: "stats", fn: () => a.goto("stats", { back: "menu" }), key: "s" },
      { label: "Settings", style: "dark", icon: "gear", fn: () => a.goto("settings", { back: "menu" }), key: "e" },
      { label: "Quit", style: "dark", icon: "quit", fn: () => a.quit(), key: "q" },
    ];
  }

  onKey(key) {
    const items = this.items(), k = key.toLowerCase();
    if (["ArrowDown", "ArrowUp", "Tab"].includes(key)) {
      const step = key === "ArrowUp" ? -1 : 1;
      this.focus = this.focus >= 0 ? (this.focus + step + items.length) % items.length : 0;
      this.app.sound.play("hover", 0.6);
      return true;
    }
    if (key === "Enter" || key === " ") { (this.focus >= 0 ? items[this.focus] : items[0]).fn(); return true; }
    if (key === "Escape") { this.app.quit(); return true; }
    const hot = items.find((i) => i.key === k);
    if (hot) { hot.fn(); return true; }
    return false;
  }

  draw(ctx) {
    const a = this.app, st = a.store, [vx0, vy0, vx1, vy1] = a.view, k = a.touch ? 1.3 : 1;
    a.assets.background(ctx, a, "bg");
    // left column: logo, tagline, buttons — centred as a group on x = 470
    const lx = 470, bob = (i) => Math.sin(this.t * 1.6 + i * 1.3) * 7;
    a.assets.logo(ctx, lx, 178, 96);
    const items = this.items();
    let y = 296;
    items.forEach((it, i) => {
      const h = (i === 0 ? 66 : 54) * k;
      y += h / 2;
      button(a, { id: "menu" + i, x: lx, y, w: 360 * k, h, label: it.label, icon: it.icon, style: it.style, size: (i === 0 ? 24 : 18) * k, iconSize: (i === 0 ? 26 : 20) * k, fn: it.fn });
      if (this.focus === i && !a.touch) { ctx.strokeStyle = "rgba(255,244,200,0.9)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(lx - 180 * k - 5, y - h / 2 - 5, 360 * k + 10, h + 10, h / 2 + 5); ctx.stroke(); }
      y += h / 2 + 16;
    });
    // right column, centred on x = 1130 (mirrors the left one around the middle of the table)
    const rx = 1130;
    a.assets.card(ctx, "AS", rx - 62, 330 + bob(0), { scale: 1.55, rot: 0.17 });
    a.assets.card(ctx, "KH", rx + 62, 324 + bob(1), { scale: 1.55, rot: -0.157 });
    [[50000, -90], [2500, 0], [10000, 92]].forEach(([denom, dx]) => a.assets.chip(ctx, denom, rx + dx, 520, 64));
    const pw = 330, ph = 54;
    panel(ctx, rx - pw / 2, 600 - ph / 2, pw, ph, { r: 27, fill: "rgba(12,12,16,0.87)", border: "rgba(233,196,106,0.8)" });
    a.text(`Balance  ${fmtMoney(st.bankroll)}`, rx, 601, { size: 21, weight: "bold", family: "num", color: "#f6e3a8" });
    a.text("Blackjack pays 3 to 2  ·  play money only, no real gambling", rx, 646, { size: 13, color: "#c9bda0" });
    if (!a.touch) a.text("F11 fullscreen  ·  M mute", vx1 - 30, vy1 - 22, { size: 11.5, color: "#8d8470", align: "right" });
    void vx0; void vy0;
  }
}
