// Settings: table rules (with presets), gameplay, sound, display and save data.
// Rows are laid out from a list, so the same code gives two columns on a wide
// screen and one scrolling column on a phone.
import { button, panel, roundRect } from "./core.js";
import { Rules, fmtMoney } from "./engine.js";
import { PRESETS } from "./store.js";
import { pageHeader } from "./stats.js";

const FELTS = { green: "#1e804a", blue: "#1e609e", red: "#96202c", purple: "#60348c", black: "#3e4248" };
const BACKS = { red: "#a81a22", blue: "#2048a0", black: "#2c2c34", green: "#166e40", purple: "#683096" };
const TABS = [["rules", "Table Rules", "chip"], ["game", "Gameplay", "play"], ["sound", "Sound", "sound"], ["display", "Display", "eye"], ["data", "Save Data", "info"]];

export class SettingsScene {
  constructor(app, opts) {
    this.app = app; this.name = "settings"; this.alive = true; this.back = opts.back || "menu";
    this.tab = "rules"; this.scroll = 0; this.lastY = null; this.contentH = 0;
  }
  onDestroy() { this.alive = false; }
  onKey(key) { if (key === "Escape") { this.app.goto(this.back); return true; } return false; }
  onWheel(d) { this.scroll = Math.max(0, Math.min(Math.max(0, this.contentH - this.viewH), this.scroll - d * 60)); this.app.invalidate(); }

  // ------------------------------------------------------------ settings helpers
  get s() { return this.app.store.settings; }
  set(key, v) { this.s[key] = v; this.app.store.save(); this.app.invalidate(); }
  setRule(key, v) {
    const rules = this.app.store.rules().copy({ [key]: v });
    this.app.store.setRules(rules, this.matchPreset(rules));
    this.app.store.save();
    this.app.session.shoe = null;               // a new table gets a fresh shoe
    this.app.invalidate();
  }
  matchPreset(rules) {
    for (const [id, [, , d]] of Object.entries(PRESETS)) if (Object.entries(d).every(([k, v]) => rules[k] === v)) return id;
    return "custom";
  }
  applyPreset(id) {
    const rules = this.app.store.rules().copy(PRESETS[id][2]);
    this.app.store.setRules(rules, id);
    this.app.store.save();
    this.app.session.shoe = null;
    this.app.invalidate();
  }

  // ------------------------------------------------------------ rows per tab
  rows() {
    const a = this.app, st = a.store, s = this.s, r = st.rules(), rr = (k, v) => () => this.setRule(k, v);
    const seg = (id, opts, val, set) => ({ seg: { id, opts, val, set } });
    const tog = (id, val, set) => ({ tog: { id, val, set } });
    if (this.tab === "rules") return [
      { label: "Decks in the shoe", sub: "More decks = slightly better for the house", ...seg("decks", [[1, "1"], [2, "2"], [4, "4"], [6, "6"], [8, "8"]], r.decks, (v) => this.setRule("decks", v)) },
      { label: "Soft 17", sub: "Ace + 6: does the dealer hit it?", ...seg("h17", [[false, "Stands"], [true, "Hits"]], r.h17, (v) => this.setRule("h17", v)) },
      { label: "Blackjack pays", sub: "6:5 tables cost you far more than any other rule", ...seg("bj", [["3:2", "3 : 2"], ["6:5", "6 : 5"]], `${r.bj_num}:${r.bj_den}`, (v) => { const [n, d] = v.split(":").map(Number); this.setRule("bj_num", n); this.setRule("bj_den", d); }) },
      { label: "Hole card", sub: "European dealers take no hole card", ...seg("peek", [[true, "US (peek)"], [false, "European"]], r.peek, (v) => this.setRule("peek", v)) },
      { label: "Shuffle when", sub: "Share of the shoe dealt first", ...seg("pen", [[0.5, "50%"], [0.65, "65%"], [0.75, "75%"], [0.85, "85%"]], r.penetration, (v) => this.setRule("penetration", v)) },
      { label: "Double down on", sub: "", ...seg("dbl", [["any", "Any 2"], ["9-11", "9 – 11"], ["10-11", "10 – 11"]], r.double_on, (v) => this.setRule("double_on", v)) },
      { label: "Minimum bet", sub: "", ...seg("min", [[500, "$5"], [1000, "$10"], [2500, "$25"], [10000, "$100"]], r.min_bet, (v) => this.setRule("min_bet", v)) },
      { label: "Double after split", sub: "Allowed to double a hand created by a split", ...tog("das", r.das, (v) => this.setRule("das", v)) },
      { label: "Maximum bet", sub: "", ...seg("max", [[50000, "$500"], [100000, "$1K"], [500000, "$5K"], [1000000, "$10K"]], r.max_bet, (v) => this.setRule("max_bet", v)) },
      { label: "Split up to", sub: "", ...seg("hands", [[2, "2 hands"], [3, "3 hands"], [4, "4 hands"]], r.max_hands, (v) => this.setRule("max_hands", v)) },
      { label: "Insurance offered", sub: "Side bet when the dealer shows an Ace", ...tog("ins", r.insurance, (v) => this.setRule("insurance", v)) },
      { label: "Late surrender", sub: "Give up half your bet", ...tog("sur", r.surrender, (v) => this.setRule("surrender", v)) },
      { label: "10-value cards split", sub: "Allow splitting K + Q, J + 10, ...", ...tog("sbv", r.split_by_value, (v) => this.setRule("split_by_value", v)) },
      { label: "Re-split Aces", sub: "", ...tog("rsa", r.resplit_aces, (v) => this.setRule("resplit_aces", v)) },
      { label: "", sub: "", skip: true }, { label: "Hit split Aces", sub: "", ...tog("hsa", r.hit_split_aces, (v) => this.setRule("hit_split_aces", v)) },
    ].filter((x) => !x.skip);
    if (this.tab === "game") return [
      { label: "Animation speed", sub: "How quickly cards and chips move", ...seg("anim", [["relaxed", "Relaxed"], ["normal", "Normal"], ["fast", "Fast"], ["turbo", "Turbo"]], s.anim_speed, (v) => this.set("anim_speed", v)) },
      { label: "Hints", sub: "Basic-strategy help while you play", ...seg("hints", [["off", "Off"], ["button", "Hint button"], ["coach", "Coach"]], s.hints, (v) => this.set("hints", v)) },
      { label: "Walk-in intro", sub: "The animation when you press Play", ...seg("intro", [["always", "Every time"], ["session", "Once per launch"], ["never", "Never"]], s.intro, (v) => this.set("intro", v)) },
      { label: "Fresh bankroll", sub: "Amount you get when you refill or reset", ...seg("bank", [[50000, "$500"], [100000, "$1,000"], [500000, "$5,000"], [1000000, "$10,000"]], s.start_bankroll, (v) => this.set("start_bankroll", v)) },
      { label: "Show hand totals", sub: "Badges with the total of each hand", ...tog("tot", s.show_totals, (v) => this.set("show_totals", v)) },
      { label: "Show card count", sub: "Hi-Lo running & true count for practice", ...tog("cnt", s.show_count, (v) => this.set("show_count", v)) },
      { label: "Confirm before leaving", sub: "Ask first if you leave in the middle of a hand", ...tog("conf", s.confirm_leave, (v) => this.set("confirm_leave", v)) },
    ];
    if (this.tab === "sound") return [
      { label: "Volume", sub: "", slider: { id: "vol", val: s.volume, set: (v) => this.set("volume", v) } },
      { label: "Mute everything", sub: "Shortcut: M", ...tog("mute", s.muted, (v) => this.set("muted", v)) },
      { label: "Test sound", sub: "", btn: { label: "Play", icon: "sound", fn: () => a.sound.play("blackjack") } },
      { label: "Sound engine", sub: "Playing with Web Audio.", none: true },
    ];
    if (this.tab === "display") return [
      { label: "Table colour", sub: "", swatches: { id: "felt", map: FELTS, val: s.felt, set: (v) => { a.assets.ready("felt_" + v).then(() => this.set("felt", v)); } } },
      { label: "Card back", sub: "", swatches: { id: "back", map: BACKS, val: s.card_back, set: (v) => this.set("card_back", v) } },
      { label: "4-colour deck", sub: "Diamonds blue, clubs green", ...tog("four", s.four_color, (v) => this.set("four_color", v)) },
      { label: "Fullscreen", sub: "Shortcut: F11", ...tog("full", !!document.fullscreenElement, (v) => a.toggleFullscreen(v)) },
    ];
    return [
      { label: "Reset balance", sub: `Back to ${fmtMoney(s.start_bankroll)}. Stats are kept.`, btn: { label: "Reset", style: "dark", fn: () => this.confirm("Reset balance?", "Your balance goes back to the starting amount.", () => { st.resetBankroll(false); a.sound.play("cash"); a.toast("Balance reset", "good", 1.5); a.session.shoe = null; }) } },
      { label: "Reset statistics", sub: "Clears all stats and the history. Balance is kept.", btn: { label: "Reset", style: "dark", fn: () => this.confirm("Reset statistics?", "All statistics and the balance history will be erased.", () => { st.resetStats(); a.toast("Statistics cleared", "good", 1.5); }) } },
      { label: "Reset everything", sub: "Balance, statistics and all settings back to default.", btn: { label: "Reset", style: "red", fn: () => this.confirm("Reset everything?", "Balance, statistics and settings all go back to how they were on the first launch.", () => { st.resetAll(); st.save(); a.session = {}; a.toast("Everything reset", "good", 1.5); }) } },
    ];
  }
  async confirm(title, body, done) {
    const v = await this.app.openModal({ title, body, buttons: [{ label: "Cancel", style: "dark", value: false }, { label: "Yes, reset", style: "red", value: true }], cancel: false });
    if (v && this.alive) { done(); this.app.invalidate(); }
  }

  // ------------------------------------------------------------ controls
  seg(id, xr, y, opts, val, set, k) {
    const a = this.app, { ctx } = a, h = 36 * k, pad = 15 * k, size = 14 * k;
    const ws = opts.map(([, l]) => a.measure(l, { size, weight: "bold" }) + pad * 2), total = ws.reduce((p, q) => p + q, 0) + 8 * k;
    let x = xr - total;
    roundRect(ctx, x, y - h / 2, total, h, h / 2); ctx.fillStyle = "rgba(8,10,12,0.85)"; ctx.fill();
    ctx.strokeStyle = "rgba(233,196,106,0.35)"; ctx.lineWidth = 1.2; ctx.stroke();
    x += 4 * k;
    opts.forEach(([v, l], i) => {
      const w = ws[i], on = v === val, hid = `${id}-${i}`;
      if (on) { roundRect(ctx, x, y - h / 2 + 3 * k, w, h - 6 * k, (h - 6 * k) / 2); ctx.fillStyle = "#e9c46a"; ctx.fill(); }
      else if (a.isHover(hid)) { roundRect(ctx, x, y - h / 2 + 3 * k, w, h - 6 * k, (h - 6 * k) / 2); ctx.fillStyle = "rgba(233,196,106,0.16)"; ctx.fill(); }
      a.text(l, x + w / 2, y + 1, { size, weight: "bold", color: on ? "#281a04" : "#e6dcc4", shadow: null });
      a.hit({ id: hid, x: x + w / 2, y, w, h: h + 8 * k, fn: () => { a.sound.play("click", 0.5); set(v); } });
      x += w;
    });
  }
  toggle(id, xr, y, val, set, k) {
    const a = this.app, { ctx } = a, w = 58 * k, h = 30 * k, x = xr - w;
    roundRect(ctx, x, y - h / 2, w, h, h / 2); ctx.fillStyle = val ? "#2f9e58" : "#3a3f47"; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + (val ? w - h / 2 : h / 2), y, h / 2 - 3 * k, 0, Math.PI * 2); ctx.fillStyle = "#f6f1e4"; ctx.fill();
    a.hit({ id, x: x + w / 2, y, w, h: h + 14 * k, fn: () => { a.sound.play("click", 0.5); set(!val); } });
  }
  slider(id, xr, y, val, set, k) {
    const a = this.app, { ctx } = a, w = 280 * k, x = xr - w;
    roundRect(ctx, x, y - 5 * k, w, 10 * k, 5 * k); ctx.fillStyle = "rgba(8,10,12,0.85)"; ctx.fill();
    roundRect(ctx, x, y - 5 * k, Math.max(10 * k, w * val), 10 * k, 5 * k); ctx.fillStyle = "#e9c46a"; ctx.fill();
    ctx.beginPath(); ctx.arc(x + w * val, y, 13 * k, 0, Math.PI * 2); ctx.fillStyle = "#f6f1e4"; ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke();
    a.text(`${Math.round(val * 100)}%`, x - 36 * k, y, { size: 15 * k, weight: "bold", family: "num", color: "#f3e8cc", shadow: null });
    const pick = (px) => set(Math.max(0, Math.min(1, (px - x) / w)));
    a.hit({ id, x: x + w / 2, y, w: w + 30 * k, h: 40 * k, press: (px) => pick(px), drag: (px) => pick(px), fn: () => a.sound.play("click", 0.4) });
  }
  swatches(id, xr, y, map, val, set, k) {
    const a = this.app, { ctx } = a, d = 34 * k, gap = 14 * k, n = Object.keys(map).length;
    let x = xr - n * d - (n - 1) * gap;
    for (const [key, col] of Object.entries(map)) {
      const cx = x + d / 2, on = key === val;
      ctx.beginPath(); ctx.arc(cx, y, d / 2, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = on ? 3.5 : 1.5; ctx.strokeStyle = on ? "#f6e3a8" : "rgba(255,255,255,0.25)"; ctx.stroke();
      if (a.isHover(`${id}-${key}`) && !on) { ctx.beginPath(); ctx.arc(cx, y, d / 2 + 4, 0, Math.PI * 2); ctx.strokeStyle = "rgba(233,196,106,0.6)"; ctx.lineWidth = 2; ctx.stroke(); }
      a.hit({ id: `${id}-${key}`, x: cx, y, w: d + 8, h: d + 16, fn: () => { a.sound.play("click", 0.5); set(key); } });
      x += d + gap;
    }
  }

  // ------------------------------------------------------------ drawing
  draw(ctx) {
    const a = this.app, k = a.touch ? 1.3 : 1, [vx0, vy0, vx1, vy1] = a.view;
    a.assets.background(ctx, a, "bg");
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    pageHeader(a, "Settings", this.back, k);

    // tab column
    const tw = 215 * Math.min(k, 1.1), tx = Math.max(vx0 + 24 + tw / 2, 150), th = 44 * k;
    TABS.forEach(([id, label, icon], i) => {
      button(a, { id: "tab-" + id, x: tx, y: 150 + i * (th + 12), w: tw, h: th, label, icon, size: 15 * k, iconSize: 17 * k, style: this.tab === id ? "gold" : "ghost", fn: () => { this.tab = id; this.scroll = 0; a.invalidate(); } });
    });

    // content panel
    const px0 = tx + tw / 2 + 24, px1 = vx1 - 24, py0 = 110, py1 = vy1 - 30;
    panel(ctx, px0, py0, px1 - px0, py1 - py0, { r: 18, fill: "rgba(10,12,16,0.86)", border: "rgba(233,196,106,0.45)", bw: 1.4 });
    this.viewH = py1 - py0 - 20;
    a.hit({ id: "scrollarea", x: (px0 + px1) / 2, y: (py0 + py1) / 2, w: px1 - px0, h: py1 - py0, pad: 0,
      press: (x, y) => { this.lastY = y; }, drag: (x, y) => { if (this.lastY !== null) { this.scroll = Math.max(0, Math.min(Math.max(0, this.contentH - this.viewH), this.scroll - (y - this.lastY))); this.lastY = y; a.invalidate(); } } });

    ctx.save();
    ctx.beginPath(); ctx.rect(px0, py0 + 4, px1 - px0, py1 - py0 - 8); ctx.clip();
    let y = py0 + 18 - this.scroll;
    const pw = px1 - px0;
    // presets above the rules
    if (this.tab === "rules") {
      a.text("PRESET TABLES", px0 + 30, y + 10, { size: 12.5, weight: "bold", color: "#c9a85a", align: "left", family: "num", shadow: null });
      const ids = Object.keys(PRESETS), cur = this.s.preset, bw = (pw - 60 - (ids.length - 1) * 12) / ids.length;
      ids.forEach((id, i) => button(a, { id: "pre-" + id, x: px0 + 30 + bw / 2 + i * (bw + 12), y: y + 50 * Math.min(k, 1.1), w: bw, h: 42 * k, label: PRESETS[id][0], style: cur === id ? "gold" : "dark", size: 14.5 * Math.min(k, 1.15), fn: () => this.applyPreset(id) }));
      const desc = cur !== "custom" && PRESETS[cur] ? PRESETS[cur][1] : "Custom rules: " + this.app.store.rules().short();
      a.text(desc, px0 + 30, y + 50 * Math.min(k, 1.1) + 42 * k, { size: 13.5, color: "#d9cfb4", align: "left", shadow: null, maxW: pw - 60 });
      y += 50 * Math.min(k, 1.1) + 42 * k + 34;
    }
    const rows = this.rows(), cols = !a.touch && this.tab === "rules" && pw > 900 ? 2 : 1, rh = 56 * k;
    const colW = (pw - 60) / cols;
    rows.forEach((row, i) => {
      const col = cols === 2 ? i % 2 : 0, r = cols === 2 ? Math.floor(i / 2) : i;
      const xl = px0 + 30 + col * colW, xr = xl + colW - (cols === 2 && col === 0 ? 40 : 0), ry = y + r * rh + rh / 2;
      if (ry + rh < py0 || ry - rh > py1) return;
      if (row.label) a.text(row.label, xl, ry - (row.sub ? 9 : 0), { size: 17 * Math.min(k, 1.2), weight: "bold", color: "#f3e8cc", align: "left", shadow: null });
      if (row.sub) a.text(row.sub, xl, ry + 13 * Math.min(k, 1.2), { size: 12.5 * Math.min(k, 1.15), color: "#a99f88", align: "left", shadow: null, maxW: colW - 330 * k });
      if (row.seg) this.seg(`${this.tab}-${row.seg.id}`, xr, ry, row.seg.opts, row.seg.val, row.seg.set, k);
      else if (row.tog) this.toggle(`${this.tab}-${row.tog.id}`, xr, ry, row.tog.val, row.tog.set, k);
      else if (row.slider) this.slider(`${this.tab}-${row.slider.id}`, xr, ry, row.slider.val, row.slider.set, k);
      else if (row.swatches) this.swatches(`${this.tab}-${row.swatches.id}`, xr, ry, row.swatches.map, row.swatches.val, row.swatches.set, k);
      else if (row.btn) button(a, { id: `${this.tab}-${row.label}`, x: xr - 80 * k, y: ry, w: 160 * k, h: 42 * k, label: row.btn.label, icon: row.btn.icon, style: row.btn.style || "dark", size: 15 * k, fn: row.btn.fn });
    });
    const n = Math.ceil(rows.length / cols);
    this.contentH = y + n * rh - (py0 + 18 - this.scroll) + (this.tab === "rules" ? 50 * Math.min(k, 1.1) + 42 * k + 34 : 0) + 24;
    ctx.restore();
    // a thin scroll indicator when the content is taller than the panel
    if (this.contentH > this.viewH) {
      const f = this.viewH / this.contentH, bh = (py1 - py0 - 30) * f, by = py0 + 15 + ((py1 - py0 - 30) - bh) * (this.scroll / (this.contentH - this.viewH));
      roundRect(ctx, px1 - 10, by, 4, bh, 2); ctx.fillStyle = "rgba(233,196,106,0.5)"; ctx.fill();
    }
  }
}
void Rules;
