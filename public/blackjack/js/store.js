// Save data: bankroll, settings, statistics. Same JSON shape as the original
// Python game, kept in localStorage["bj-save"], so existing saves carry over.
import { Rules } from "./engine.js";

const KEY = "bj-save";

export const PRESETS = {
  classic: ["Classic Shoe", "6 decks · stands soft 17 · 3:2 · double after split · surrender",
    { decks: 6, h17: false, bj_num: 3, bj_den: 2, peek: true, double_on: "any", das: true, max_hands: 4, resplit_aces: false, hit_split_aces: false, surrender: true }],
  bigshoe: ["Big Shoe", "8 decks · stands soft 17 · 3:2 · double after split · surrender",
    { decks: 8, h17: false, bj_num: 3, bj_den: 2, peek: true, double_on: "any", das: true, max_hands: 4, resplit_aces: false, hit_split_aces: false, surrender: true }],
  downtown: ["Double Deck", "2 decks · hits soft 17 · 3:2 · double after split",
    { decks: 2, h17: true, bj_num: 3, bj_den: 2, peek: true, double_on: "any", das: true, max_hands: 4, resplit_aces: false, hit_split_aces: false, surrender: false }],
  single: ["Single Deck 6:5", "1 deck · hits soft 17 · blackjack pays only 6:5 · no double after split",
    { decks: 1, h17: true, bj_num: 6, bj_den: 5, peek: true, double_on: "any", das: false, max_hands: 2, resplit_aces: false, hit_split_aces: false, surrender: false }],
  european: ["European", "6 decks · no hole card · double on 9-11 only · no surrender",
    { decks: 6, h17: false, bj_num: 3, bj_den: 2, peek: false, double_on: "9-11", das: true, max_hands: 3, resplit_aces: false, hit_split_aces: false, surrender: false }],
};

const DEFAULT_SETTINGS = () => ({
  rules: new Rules().toDict(), preset: "classic", anim_speed: "normal", hints: "button", show_totals: true,
  show_count: false, intro: "always", volume: 0.8, muted: false, felt: "green", card_back: "black",
  four_color: false, fullscreen: false, start_bankroll: 10000000, confirm_leave: true,
});

const ANIM_MULT = { relaxed: 0.8, normal: 0.5, fast: 0.32, turbo: 0.15 };

const defaultStats = () => ({
  rounds: 0, hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0, surrenders: 0, doubles: 0,
  doubles_won: 0, splits: 0, insurance_taken: 0, insurance_won: 0, even_money: 0, dealer_busts: 0,
  dealer_blackjacks: 0, wagered: 0, net: 0, biggest_win: 0, biggest_loss: 0, peak_balance: 0, refills: 0,
  streak: 0, best_streak: 0, worst_streak: 0, decisions: 0, correct: 0, started: new Date().toISOString().slice(0, 10),
});

export class Store {
  constructor() {
    this.settings = DEFAULT_SETTINGS();
    this.stats = defaultStats();
    this.bankroll = this.settings.start_bankroll;
    this.lastBet = 0;
    this.history = [];
    this.firstRun = true;
    this.loadWarning = null;
    this.load();
  }

  load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
    if (!raw) { this.stats.peak_balance = this.bankroll; return; }
    try {
      const d = JSON.parse(raw), s = d.settings || {}, defs = DEFAULT_SETTINGS();
      for (const k of Object.keys(s)) if (k in defs) this.settings[k] = s[k];
      // Saves still on an old default ($1,000 / $10,000 start, $1,000 max bet) move to the new one ($100,000 / $10,000).
      if (this.settings.start_bankroll === 100000 || this.settings.start_bankroll === 1000000) {
        this.settings.start_bankroll = defs.start_bankroll;
        if (s.rules && s.rules.max_bet === 100000) s.rules.max_bet = 1000000;
      }
      this.settings.rules = Rules.fromDict(s.rules || {}).toDict();
      const st = defaultStats();
      for (const k of Object.keys(st)) if (d.stats && k in d.stats) st[k] = d.stats[k];
      this.stats = st;
      this.bankroll = Math.max(0, Math.trunc(d.bankroll ?? this.settings.start_bankroll));
      this.lastBet = Math.max(0, Math.trunc(d.last_bet ?? 0));
      this.history = (d.history || []).map(Number).slice(-400);
      this.firstRun = false;
      this.validate();
    } catch {
      try { localStorage.setItem(KEY + ".damaged", raw); } catch { /* ignore */ }
      this.loadWarning = "Your save file was damaged, so a fresh one was started.";
    }
  }

  validate() {
    const s = this.settings;
    if (!(s.anim_speed in ANIM_MULT)) s.anim_speed = "normal";
    if (!["off", "button", "coach"].includes(s.hints)) s.hints = "button";
    if (!["always", "session", "never"].includes(s.intro)) s.intro = "always";
    if (!(s.preset in PRESETS) && s.preset !== "custom") s.preset = "custom";
    const v = Number(s.volume);
    s.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
  }

  save() {
    const d = {
      version: 1, saved: new Date().toISOString().replace("T", " ").slice(0, 19), bankroll: this.bankroll,
      last_bet: this.lastBet, settings: this.settings, stats: this.stats, history: this.history.slice(-400),
    };
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage blocked */ }
  }

  rules() { return Rules.fromDict(this.settings.rules); }
  setRules(rules, preset = "custom") { this.settings.rules = rules.toDict(); this.settings.preset = preset; }
  animMult() { return ANIM_MULT[this.settings.anim_speed] ?? 1; }

  resetBankroll(refill = true) {
    this.bankroll = Math.trunc(this.settings.start_bankroll);
    if (refill) this.stats.refills++;
    this.history.push(this.bankroll);
    this.save();
  }
  resetStats() {
    this.stats = defaultStats();
    this.stats.peak_balance = this.bankroll;
    this.history = [this.bankroll];
    this.save();
  }
  resetAll() {
    this.settings = DEFAULT_SETTINGS();
    this.bankroll = this.settings.start_bankroll;
    this.lastBet = 0;
    this.resetStats();
  }

  /** Update statistics after a finished engine Round. */
  recordRound(rnd, decisions = null) {
    const st = this.stats, net = rnd.net;
    st.rounds++; st.wagered += rnd.wagered; st.net += net;
    st.biggest_win = Math.max(st.biggest_win, net);
    st.biggest_loss = Math.min(st.biggest_loss, net);
    if (rnd.hands.length > 1) st.splits += rnd.hands.length - 1;
    if (rnd.insurance) { st.insurance_taken++; if (rnd.insurancePayout) st.insurance_won++; }
    if (rnd.dealerBlackjack) st.dealer_blackjacks++;
    if (rnd.dealerTotal > 21) st.dealer_busts++;
    for (const h of rnd.hands) {
      st.hands++;
      const r = h.result;
      if (r === "win" || r === "blackjack" || r === "even_money") st.wins++;
      else if (r === "push") st.pushes++;
      else st.losses++;
      if (r === "blackjack") st.blackjacks++;
      if (r === "even_money") st.even_money++;
      if (r === "bust") st.busts++;
      if (r === "surrender") st.surrenders++;
      if (h.doubled) { st.doubles++; if (r === "win") st.doubles_won++; }
    }
    if (net > 0) st.streak = st.streak > 0 ? st.streak + 1 : 1;
    else if (net < 0) st.streak = st.streak < 0 ? st.streak - 1 : -1;
    st.best_streak = Math.max(st.best_streak, st.streak);
    st.worst_streak = Math.min(st.worst_streak, st.streak);
    if (decisions) { st.decisions += decisions[0]; st.correct += decisions[1]; }
    st.peak_balance = Math.max(st.peak_balance, this.bankroll);
    this.history.push(this.bankroll);
  }
}
