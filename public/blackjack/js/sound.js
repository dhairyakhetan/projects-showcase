// Sound effects with Web Audio. The AudioContext is created inside a user
// gesture (browsers refuse otherwise); sounds are fetched up front and decoded
// once it exists.
const NAMES = ["blackjack", "bust", "card_deal", "card_flip", "card_place", "cash", "chair", "chip1", "chip2", "chip3",
  "chips_payout", "chips_stack", "click", "deny", "hover", "lose", "notify", "pop", "push", "shuffle", "step1", "step2",
  "whoosh", "win"];
const VARIANTS = { chip: ["chip1", "chip2", "chip3"], step: ["step1", "step2"] };

export class Sound {
  constructor(store) {
    this.store = store;
    this.ctx = null;
    this.raw = new Map(); this.buf = new Map(); this.last = new Map();
    this.fetched = Promise.all(NAMES.map((n) =>
      fetch(`/blackjack/assets/sounds/${n}.wav`).then((r) => r.arrayBuffer()).then((b) => this.raw.set(n, b)).catch(() => {})));
  }
  unlock() {
    try {
      if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this._decode(); }
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch { /* no audio */ }
  }
  async _decode() {
    await this.fetched;
    for (const [n, b] of this.raw) {
      if (this.buf.has(n)) continue;
      try { this.buf.set(n, await this.ctx.decodeAudioData(b.slice(0))); } catch { /* skip */ }
    }
  }
  play(name, vol = 1, minGap = 0) {
    const s = this.store.settings;
    if (s.muted || !this.ctx || this.ctx.state !== "running") return;
    if (name in VARIANTS) name = VARIANTS[name][Math.floor(Math.random() * VARIANTS[name].length)];
    if (minGap) {
      const now = performance.now();
      if (now - (this.last.get(name) || 0) < minGap * 1000) return;
      this.last.set(name, now);
    }
    const buf = this.buf.get(name);
    if (!buf) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1, vol * s.volume));
    src.buffer = buf;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  }
}
