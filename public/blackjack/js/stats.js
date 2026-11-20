// Statistics: twelve tiles and a balance-history chart.
import { button, panel, roundRect } from "./core.js";
import { fmtMoney } from "./engine.js";

export function pageHeader(app, title, back, k) {
  const [vx0] = app.view;
  app.text(title, 800, 56, { size: 36 * Math.min(k, 1.2), weight: "bold", family: "display", color: "#f2d07a" });
  button(app, { id: "back", x: vx0 + 20 + 55 * k, y: 56, w: 110 * k, h: 38 * k, label: "Back", icon: "back", style: "ghost", size: 15 * k, iconSize: 17 * k, fn: () => app.goto(back) });
}

export class StatsScene {
  constructor(app, opts) { this.app = app; this.name = "stats"; this.alive = true; this.back = opts.back || "menu"; }
  onKey(key) { if (key === "Escape" || key === "Backspace") { this.app.goto(this.back); return true; } return false; }
  onDestroy() { this.alive = false; }

  draw(ctx) {
    const a = this.app, st = a.store, s = st.stats, k = a.touch ? 1.3 : 1;
    a.assets.background(ctx, a, "bg");
    ctx.fillStyle = "rgba(0,0,0,0.35)"; const [vx0, vy0, vx1, vy1] = a.view; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    pageHeader(a, "Statistics", this.back, k);
    const hands = s.hands, win = hands ? (100 * s.wins) / hands : 0;
    const acc = s.decisions ? (100 * s.correct) / s.decisions : null;
    const tiles = [
      ["Balance", fmtMoney(st.bankroll), `peak ${fmtMoney(Math.max(s.peak_balance, st.bankroll))}`],
      ["Net result", fmtMoney(s.net, true), `on ${fmtMoney(s.wagered)} wagered`],
      ["Hands played", hands.toLocaleString(), `${s.rounds.toLocaleString()} rounds`],
      ["Win rate", hands ? `${win.toFixed(1)}%` : "-", `${s.wins} won · ${s.losses} lost · ${s.pushes} pushed`],
      ["Blackjacks", String(s.blackjacks), `dealer had ${s.dealer_blackjacks}`],
      ["Biggest win", fmtMoney(s.biggest_win, true), "in one round"],
      ["Biggest loss", fmtMoney(s.biggest_loss), "in one round"],
      ["Best streak", `${s.best_streak} wins`, `worst: ${Math.abs(s.worst_streak)} losses`],
      ["Strategy accuracy", acc === null ? "-" : `${acc.toFixed(0)}%`, `${s.correct} of ${s.decisions} decisions`],
      ["Doubles", String(s.doubles), `${s.doubles_won} won`],
      ["Splits", String(s.splits), `${s.busts} busts · ${s.surrenders} surrenders`],
      ["Refills", String(s.refills), "times you ran out of chips"],
    ];
    const cols = 4, tw = 330, th = 104, gap = 16, x0 = 800 - (cols * tw + (cols - 1) * gap) / 2;
    tiles.forEach(([label, value, sub], i) => {
      const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (tw + gap), y = 120 + r * (th + 14);
      panel(ctx, x, y, tw, th, { r: 14, fill: "rgba(10,12,16,0.82)", border: "rgba(233,196,106,0.35)", bw: 1.2 });
      a.text(label.toUpperCase(), x + 20, y + 24, { size: 12.5, weight: "bold", family: "num", color: "#c9a85a", align: "left", shadow: null });
      const col = label === "Net result" && s.net ? (s.net > 0 ? "#8ff0a8" : "#ff9c8c") : "#f6ecd2";
      a.text(value, x + 20, y + 57, { size: 28, weight: "bold", family: "num", color: col, align: "left", shadow: null });
      a.text(sub, x + 20, y + 86, { size: 13, color: "#a99f88", align: "left", shadow: null });
    });
    // balance history
    let hist = st.history.slice(-300);
    if (!hist.length || hist[hist.length - 1] !== st.bankroll) hist.push(st.bankroll);
    const cy = 614, cx0 = 106, cw = 1388, ch = 246;
    panel(ctx, cx0, cy - ch / 2 - 12, cw, ch + 24, { r: 16, fill: "rgba(10,12,16,0.82)", border: "rgba(233,196,106,0.35)", bw: 1.2 });
    a.text(hist.length > 2 ? `BALANCE OVER YOUR LAST ${hist.length - 1} ROUNDS` : "BALANCE HISTORY", cx0 + 22, cy - ch / 2 + 8, { size: 12.5, weight: "bold", family: "num", color: "#c9a85a", align: "left", shadow: null });
    if (hist.length >= 2) this.chart(ctx, hist, cx0 + 40, cy - ch / 2 + 30, cw - 80, ch - 56, st.settings.start_bankroll);
    else a.text("Play a few hands and your balance history will appear here.", 800, cy + 8, { size: 17, color: "#bdb39b", shadow: null });
    a.text(`Playing since ${s.started || ""}`, cx0 + 4, 866, { size: 14, color: "#bdb39b", align: "left" });
    button(a, { id: "resetstats", x: 1400, y: 866, w: 210 * Math.min(k, 1.15), h: 44 * Math.min(k, 1.15), label: "Reset statistics", icon: "trash", style: "dark", size: 14.5, iconSize: 16, fn: () => this.reset() });
  }

  chart(ctx, hist, x, y, w, h, base) {
    const a = this.app, lo = Math.min(...hist, base), hi = Math.max(...hist, base), span = Math.max(1, hi - lo);
    const px = (i) => x + (i / (hist.length - 1)) * w, py = (v) => y + h - ((v - lo) / span) * h;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const yy = y + (h * i) / 4; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); a.text(fmtMoney(Math.round((hi - (span * i) / 4) / 100) * 100), x - 8, yy, { size: 11, color: "#8d8470", align: "right", shadow: null }); }
    ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(233,196,106,0.5)"; ctx.beginPath(); ctx.moveTo(x, py(base)); ctx.lineTo(x + w, py(base)); ctx.stroke(); ctx.setLineDash([]);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "rgba(110,210,130,0.28)"); g.addColorStop(1, "rgba(110,210,130,0)");
    ctx.beginPath(); ctx.moveTo(px(0), y + h); hist.forEach((v, i) => ctx.lineTo(px(i), py(v))); ctx.lineTo(px(hist.length - 1), y + h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); hist.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
    ctx.strokeStyle = "#8ff0a8"; ctx.lineWidth = 2.6; ctx.lineJoin = "round"; ctx.stroke();
    ctx.restore();
  }

  async reset() {
    const a = this.app;
    const v = await a.openModal({ title: "Reset statistics?", body: "All statistics and the balance history will be erased. Your balance stays the same.", buttons: [{ label: "Cancel", style: "dark", value: false }, { label: "Reset", style: "red", value: true }], cancel: false });
    if (v && this.alive) { a.store.resetStats(); a.invalidate(); }
  }
}
void roundRect;
