// The table: betting, the round (driven by the verified engine generator), and
// the HUD. The felt, cards and chips live in the 1600x900 design space; the HUD
// is laid out from the visible window so it stays balanced on any screen.
import { ease, Cancelled, roundRect, panel, button } from "./core.js";
import { Round, Shoe, Wallet, totalText, fmtMoney, chipBreakdown } from "./engine.js";
import { Strategy, explain, ACTION_LABEL } from "./strategy.js";

const DEALER_Y = 205, PLAYER_Y = 590, BET_Y = 728, INS = [800, 430], CARD_H = 151, CHIP_D = 60;
const SHOE = [1396, 138], DISCARD = [160, 132];
const HAND_X = { 1: [800], 2: [588, 1012], 3: [448, 800, 1152], 4: [334, 645, 955, 1266] };
const ACTION_INFO = {
  hit: ["Hit", "green", "plus", "h"], stand: ["Stand", "red", "stand", "s"], double: ["Double", "amber", "double", "d"],
  split: ["Split", "purple", "split", "p"], surrender: ["Surrender", "slate", "flag", "r"],
};
const ACTIONS = ["hit", "stand", "double", "split", "surrender"];
const RESULT = {
  blackjack: ["BLACKJACK", "#ffcd50"], win: ["WIN", "#6ed282"], push: ["PUSH", "#c9c2ae"], lose: ["LOSE", "#f06e64"],
  bust: ["BUST", "#f06e64"], surrender: ["SURRENDER", "#aab4c4"], even_money: ["EVEN MONEY", "#6ed282"],
};

export class TableScene {
  constructor(app) {
    this.app = app; this.name = "table"; this.alive = true;
    const st = app.store, sess = app.session;
    this.rules = st.rules();
    this.strategy = new Strategy(this.rules);
    this.wallet = new Wallet(st.bankroll);
    const key = `${this.rules.decks}/${this.rules.penetration}`;
    if (!sess.shoe || sess.shoeKey !== key) { sess.shoe = new Shoe(this.rules.decks, this.rules.penetration); sess.shoeKey = key; sess.rc = 0; sess.discards = 0; sess.freshShoe = true; }
    this.shoe = sess.shoe;
    this.pending = 0; this.betChips = [];
    this.phase = "betting";
    this.round = null; this.gen = null; this.parkedAsk = null; this.askResolve = null;
    this.hands = []; this.dealer = { cards: [] };
    this.sprites = []; this.z = 1;
    this.balShown = this.wallet.balance;
    this.status = ""; this.advice = null; this.coachOpen = false; this.decisions = [0, 0];
    this.activeHand = -1; this.insAmount = 0; this.leftovers = false; this.confetti = [];
  }

  start() {
    const a = this.app, restore = a.session.pendingChips;
    delete a.session.pendingChips;
    if (restore) for (const d of restore) if (this.pending + d <= Math.min(this.wallet.balance, this.rules.max_bet)) { this.pending += d; this.betChips.push(d); }
    this.balShown = this.wallet.balance - this.pending;
    this.setStatus("Tap the chips to place a bet, then press DEAL");
    if (a.store.loadWarning) { a.toast(a.store.loadWarning, "bad", 4); a.store.loadWarning = null; }
    if (this.wallet.balance < this.rules.min_bet) this.run(() => this.brokeFlow());
  }
  onDestroy() { this.alive = false; }

  // ------------------------------------------------------------ async helpers
  async tw(dur, fn, easing = ease.outCubic, clock = "game") { await this.app.tween(dur, fn, easing, clock, this); if (!this.alive) throw new Cancelled(); }
  async wait(sec, clock = "game") { await this.app.wait(sec, clock); if (!this.alive) throw new Cancelled(); }
  async modal(m) { const v = await this.app.openModal(m); if (!this.alive) throw new Cancelled(); return v; }
  run(fn) {
    return fn().catch((e) => {
      if (e instanceof Cancelled) return;
      console.error(e);
      this.recover();
    });
  }
  setStatus(t) { this.status = t; this.app.invalidate(); }
  get cap() { return Math.min(this.wallet.balance, this.rules.max_bet); }

  // ------------------------------------------------------------ layout
  k() {
    const [vx0, , vx1] = this.app.view;
    return Math.max(1, Math.min(this.app.touch ? 1.5 : 1.25, (vx1 - vx0 - 30) / 1076));
  }
  hud() {
    const [vx0, vy0, vx1, vy1] = this.app.view, k = this.k(), barH = 70 * k + 26;
    return { vx0, vy0, vx1, vy1, k, barH, barTop: vy1 - barH, rowY: vy1 - barH / 2 + 3 };
  }
  /** x positions of the betting row, left to right, centred on the window. */
  row(h) {
    const k = h.k, g = 14 * k, total = (128 + 420 + 156 + 120 + 196) * k + 4 * g;
    let x = 800 - total / 2;
    const out = { maxX: x + 64 * k };
    x += 128 * k + g; out.chip0 = x;
    x += 420 * k + g; out.small0 = x;
    x += 156 * k + g - 6 * k; out.rebetX = x + 60 * k;
    x += 120 * k + g; out.dealX = x + 98 * k;
    return out;
  }
  rackDenoms() {
    const all = [100, 500, 2500, 10000, 50000, 100000, 500000].filter((d) => d <= this.rules.max_bet);
    return all.length > 6 ? all.slice(-6) : all;
  }
  rackX(i, h) { return this.row(h).chip0 + (i + 0.5) * 70 * h.k; }

  cardXY(cx, y, i, n, multi) { const step = n > 2 && multi ? 30 : 42; return [cx + (i - (n - 1) / 2) * step, y]; }
  handCenters() { return HAND_X[Math.max(1, Math.min(4, this.hands.length))]; }

  // ------------------------------------------------------------ sprites
  newCard(card, x, y, faceUp, extra = {}) {
    const s = { t: "card", card, x, y, flip: faceUp ? 1 : 0, faceUp, scale: 1, rotated: false, alpha: 1, z: this.z++, ...extra };
    this.sprites.push(s);
    return s;
  }
  moveTo(s, x, y, dur, easing = ease.outCubic, clock = "game") {
    const x0 = s.x, y0 = s.y;
    return this.tw(dur, (t) => { s.x = x0 + (x - x0) * t; s.y = y0 + (y - y0) * t; }, easing, clock);
  }
  remove(s) { this.sprites = this.sprites.filter((x) => x !== s); this.app.invalidate(); }

  // ------------------------------------------------------------ betting
  balTarget() { return this.wallet.balance - this.pending; }
  syncBalance() { this.balShown = this.balTarget(); this.app.invalidate(); }

  onChip(denom) {
    if (this.phase !== "betting") return;
    const a = this.app;
    if (this.pending + denom > this.cap) {
      a.sound.play("deny"); a.toast(this.pending + denom > this.rules.max_bet ? "Table maximum reached" : "Not enough chips", "bad", 1.4); return;
    }
    this.beginNewBet();
    this.pending += denom; this.betChips.push(denom);
    a.sound.play("chip", 0.9);
    const h = this.hud(), f = { t: "chip", denom, x: this.rackX(this.rackDenoms().indexOf(denom), h), y: h.rowY, z: 9999 };
    this.sprites.push(f);
    this.run(async () => { await this.moveTo(f, 800, BET_Y - 4, 0.2, ease.outCubic, "ui"); this.remove(f); });
    this.syncBalance();
  }
  onUndo() { if (this.phase !== "betting" || !this.betChips.length) return; this.pending -= this.betChips.pop(); this.app.sound.play("chip", 0.6); this.syncBalance(); }
  onClear() { if (this.phase !== "betting" || !this.pending) return; this.pending = 0; this.betChips = []; this.app.sound.play("chips_stack", 0.7); this.syncBalance(); }
  onX2() {
    if (this.phase !== "betting" || !this.pending) return;
    if (this.pending * 2 > this.cap) { this.app.sound.play("deny"); return; }
    this.betChips.push(this.pending); this.pending *= 2; this.app.sound.play("chips_stack", 0.8); this.syncBalance();
  }
  setBet(amt, big = false) {
    if (amt < this.rules.min_bet) { this.app.sound.play("deny"); return; }
    this.beginNewBet();
    this.pending = amt; this.betChips = [amt];
    this.app.sound.play("chips_stack", big ? 1 : 0.8);
    this.syncBalance();
  }
  rebetAmount() { return Math.floor(Math.min(this.app.store.lastBet, this.cap) / 100) * 100; }
  onRebet() { if (this.phase === "betting") this.setBet(this.rebetAmount()); }
  onMax() {
    if (this.phase !== "betting") return;
    if (this.wallet.balance < this.rules.max_bet) { this.app.sound.play("deny"); this.app.toast("Not enough chips for the table maximum - try ALL IN", "bad", 1.6); return; }
    this.setBet(this.rules.max_bet);
  }
  allInAmount() { return Math.floor(this.cap / 100) * 100; }
  onAllIn() {
    if (this.phase !== "betting") return;
    const bal = this.wallet.balance, amt = this.allInAmount();
    if (amt >= this.rules.min_bet && bal > this.rules.max_bet) this.app.toast(`Table maximum caps your all-in at ${fmtMoney(this.rules.max_bet)}`, "info", 1.8);
    this.setBet(amt, true);
  }
  onDeal() {
    if (this.phase !== "betting") return;
    const a = this.app, r = this.rules;
    if (!this.pending && a.store.lastBet) this.onRebet();
    if (this.pending < r.min_bet) { a.sound.play("deny"); a.toast(`Minimum bet is ${fmtMoney(r.min_bet)}`, "bad", 1.6); return; }
    if (this.pending > this.wallet.balance) { a.sound.play("deny"); return; }
    const bet = this.pending;
    this.pending = 0; this.betChips = [];
    a.store.lastBet = bet;
    this.phase = "busy";
    this.run(() => this.playRound(bet));
  }
  beginNewBet() { if (this.leftovers) this.sweep(); }

  // ------------------------------------------------------------ sweep / shuffle
  sweep() {
    if (!this.leftovers) return;
    this.leftovers = false;
    const cards = this.sprites.filter((s) => s.t === "card"), s0 = this.app.session;
    this.sprites = this.sprites.filter((s) => s.t === "card");
    this.hands = []; this.dealer = { cards: [] }; this.insAmount = 0; this.advice = null; this.activeHand = -1;
    this.app.sound.play("card_place", 0.8);
    this.run(async () => {
      await Promise.all(cards.map(async (c, i) => {
        await this.app.wait(0.025 * i, "ui");
        await this.moveTo(c, DISCARD[0], DISCARD[1], 0.38, ease.inOutCubic);
        c.flip = 0; c.faceUp = false;
        this.remove(c);
      }));
      s0.discards = (s0.discards || 0) + cards.length;
    });
  }
  async maybeShuffle() {
    const a = this.app, s0 = a.session, fresh = s0.freshShoe;
    s0.freshShoe = false;
    if (!(this.shoe.needsShuffle || fresh)) return;
    this.setStatus("Shuffling the shoe...");
    a.sound.play("shuffle");
    await this.wait(0.9, "ui");
    if (this.shoe.needsShuffle) this.shoe.shuffle();
    s0.discards = 0; s0.rc = 0;
    const burn = this.shoe.burn();
    s0.rc += burn.hilo;
    const c = this.newCard(burn, SHOE[0], SHOE[1], false);
    await this.moveTo(c, DISCARD[0], DISCARD[1], 0.35);
    this.remove(c);
    s0.discards = 1;
  }

  // ------------------------------------------------------------ the round
  async playRound(bet) {
    if (this.leftovers) this.sweep();
    await this.wait(0.05, "ui");
    await this.maybeShuffle();
    this.round = new Round(this.rules, this.shoe, this.wallet, bet);
    this.gen = this.round.play();
    this.decisions = [0, 0];
    this.hands = [{ cards: [], bet, badge: null, result: null, showStack: true }];
    this.dealer = { cards: [] };
    this.leftovers = true;
    this.balShown = this.wallet.balance;
    let send;
    for (;;) {
      const r = this.gen.next(send);
      if (r.done) break;
      const e = r.value;
      if (e.isAsk) { this.parkedAsk = e; send = await this.answer(e); this.parkedAsk = null; }
      else { await this.onEvent(e); send = undefined; }
    }
    this.gen = null;
    await this.finishRound();
  }

  async answer(e) {
    const fmt = fmtMoney;
    if (e.kind === "even_money") {
      return this.modal({ title: "Even money?", body: `You have Blackjack and the dealer shows an Ace. Take ${fmt(e.amount)} now, guaranteed, instead of risking a push?`,
        buttons: [{ label: "Take even money", style: "gold", value: true }, { label: "No thanks", style: "dark", value: false }], default: true, cancel: false, keys: { y: true, n: false } });
    }
    if (e.kind === "insurance") {
      return this.modal({ title: "Insurance?", body: `The dealer shows an Ace. Insurance costs ${fmt(e.cost)} (half your bet) and pays 2 to 1 if the dealer has Blackjack.`,
        buttons: [{ label: `Insure  ${fmt(e.cost)}`, style: "gold", value: !!e.canAfford }, { label: "No thanks", style: "dark", value: false }], default: false, cancel: false, keys: { y: !!e.canAfford, n: false } });
    }
    return this.askAction(e);
  }

  async askAction(e) {
    const rnd = this.round, h = rnd.hands[e.hand], hint = this.app.store.settings.hints;
    this.phase = "player"; this.activeHand = e.hand;
    this.advice = this.strategy.advise(rnd, e.hand);
    this.coachOpen = hint === "coach";
    const up = rnd.dealer[0];
    this.setStatus(`Your move: ${totalText(h.cards)} vs dealer ${up.value === 1 ? "A" : up.value}`);
    const act = await new Promise((resolve) => { this.askResolve = resolve; });
    this.askResolve = null;
    if (!this.alive) throw new Cancelled();
    this.decisions[0]++;
    if (act === this.advice.action) this.decisions[1]++;
    else if (hint === "coach") this.app.toast(`Basic strategy says: ${ACTION_LABEL[this.advice.action]}`, "info", 2.2);
    this.phase = "busy"; this.coachOpen = false;
    return act;
  }
  onAction(a) {
    if (this.phase !== "player" || !this.askResolve) return;
    const st = this.round.actionStatus(this.activeHand)[a];
    if (!st || !st[0]) { this.app.sound.play("deny"); if (st) this.app.toast(st[1], "bad", 1.6); return; }
    this.app.sound.play("click", 0.6);
    this.askResolve(a);
  }
  onHint() {
    if (this.phase !== "player" || !this.advice) return;
    this.coachOpen = !this.coachOpen;
    this.app.invalidate();
  }

  // ------------------------------------------------------------ events
  handState(i) { return this.hands[i]; }
  group(e) { return e.to === "dealer" ? this.dealer : this.hands[e.hand]; }

  relayout(isDealer, i, except = null, dur = 0.18) {
    const g = isDealer ? this.dealer : this.hands[i], n = g.cards.length;
    const cx = isDealer ? 800 : this.handCenters()[i], y = isDealer ? DEALER_Y : PLAYER_Y;
    g.cards.forEach((s, k) => {
      if (s === except) return;
      const [tx, ty] = this.cardXY(cx, y, k, n, !isDealer && this.hands.length > 2);
      const x0 = s.x, y0 = s.y;
      this.run(() => this.tw(dur, (t) => { s.x = x0 + (tx - x0) * t; s.y = y0 + (ty - y0) * t; }));
    });
  }

  async dealCard(e) {
    const a = this.app, isDealer = e.to === "dealer", g = this.group(e);
    const s = this.newCard(e.card, SHOE[0], SHOE[1], false, { scale: 0.8, rotated: !!e.rotated });
    g.cards.push(s);
    this.relayout(isDealer, e.hand, s);
    const n = g.cards.length, cx = isDealer ? 800 : this.handCenters()[e.hand], y = isDealer ? DEALER_Y : PLAYER_Y;
    const [tx, ty] = this.cardXY(cx, y, n - 1, n, !isDealer && this.hands.length > 2);
    a.sound.play("card_deal", 0.8, 0.03);
    const x0 = s.x, y0 = s.y;
    await this.tw(0.3, (t) => { s.x = x0 + (tx - x0) * t; s.y = y0 + (ty - y0) * t; s.scale = 0.8 + 0.2 * t; if (e.faceUp) s.flip = Math.max(0, (t - 0.3) / 0.7); });
    s.flip = e.faceUp ? 1 : 0; s.faceUp = e.faceUp;
    if (e.faceUp) a.session.rc = (a.session.rc || 0) + e.card.hilo;
    await this.wait(0.06);
  }

  async revealHole(card) {
    const s = this.dealer.cards[1];
    this.app.sound.play("card_flip", 0.8);
    await this.tw(0.3, (t) => { s.flip = t; });
    s.faceUp = true;
    this.app.session.rc = (this.app.session.rc || 0) + card.hilo;
    await this.wait(0.1);
  }

  banner(text, color, dur = 1.3) {
    const b = { t: "banner", text, color, age: 0, dur, z: 99999 };
    this.sprites.push(b);
    this.run(async () => { await this.tw(dur, (t) => { b.age = t; }, ease.linear, "ui"); this.remove(b); });
  }

  async onEvent(e) {
    const a = this.app, snd = a.sound, rnd = this.round;
    switch (e.kind) {
      case "bet": snd.play("chips_stack", 0.8); this.setStatus(""); this.balShown = this.wallet.balance; break;
      case "shuffle": this.setStatus("The shoe ran out - reshuffling"); a.session.rc = 0; break;
      case "deal": await this.dealCard(e); break;
      case "dealt": await this.wait(0.12); break;
      case "even_money": a.toast("Even money - paid 1 to 1", "good", 1.8); break;
      case "insurance": this.insAmount = e.amount; snd.play("chips_stack", 0.7); break;
      case "peek": this.setStatus("Dealer checks the hole card..."); await this.wait(0.7); break;
      case "insurance_lost": a.toast("Insurance lost", "info", 1.5); this.insAmount = 0; break;
      case "reveal": await this.revealHole(e.card); break;
      case "dealer_blackjack": this.banner("DEALER BLACKJACK", "#f06e64"); await this.wait(0.7); break;
      case "blackjack": this.banner("BLACKJACK!", "#ffcd50"); snd.play("blackjack", 0.9); this.burst(); await this.wait(0.6); break;
      case "turn": this.activeHand = e.hand; break;
      case "hit": break;
      case "stand": if (e.auto && e.reason === "21") { a.toast("21!", "gold", 0.9); } break;
      case "double": {
        const h = this.hands[e.hand];
        h.bet += e.amount; snd.play("chips_stack", 0.8);
        break;
      }
      case "split": {
        const from = this.hands[e.hand], moved = from.cards.pop();
        this.hands.splice(e.newHand, 0, { cards: [moved], bet: e.amount, badge: null, result: null, showStack: true });
        snd.play("chips_stack", 0.8);
        for (let i = 0; i < this.hands.length; i++) this.relayout(false, i, null, 0.3);
        await this.wait(0.3);
        break;
      }
      case "bust": snd.play("bust", 0.8); this.banner("BUST", "#f06e64", 0.9); await this.wait(0.45); break;
      case "surrender": a.toast("Surrendered - half your bet returned", "info", 1.8); break;
      case "dealer_turn": this.activeHand = -1; this.setStatus("Dealer's turn"); await this.wait(0.2); break;
      case "dealer_done": await this.wait(0.25); break;
      case "settle": await this.settle(e); break;
      default: break;
    }
    void rnd;
  }

  async settle(e) {
    const a = this.app, snd = a.sound, rnd = this.round;
    this.activeHand = -1;
    let anyWin = false, anyLose = false, anyPush = false, big = false;
    for (const [i, result, bet, payout] of e.results) {
      const h = this.hands[i];
      if (!h) continue;
      const net = payout - bet, [label, color] = RESULT[result] || ["", "#fff"];
      h.result = { label: net > 0 ? `${label} ${fmtMoney(net, true)}` : net < 0 && result !== "bust" && result !== "lose" ? `${label} ${fmtMoney(net)}` : label, color };
      if (net > 0) { anyWin = true; if (net >= bet * 1.5) big = true; } else if (net < 0) anyLose = true; else anyPush = true;
    }
    if (e.insurance && e.insurancePayout) a.toast(`Insurance paid ${fmtMoney(e.insurancePayout - e.insurance, true)}`, "good", 2);
    if (anyWin && !rnd.hands.every((h) => h.result === "blackjack")) snd.play("win", 0.85);
    else if (!anyWin && anyLose) snd.play("lose", 0.7);
    else if (anyPush && !anyWin) snd.play("push", 0.7);
    if (big || (anyWin && rnd.net >= rnd.initialBet * 2)) this.burst();
    const net = rnd.net;
    this.setStatus(net > 0 ? `You won ${fmtMoney(net)}` : net < 0 ? `You lost ${fmtMoney(-net)}` : "Push - your bet is returned");
    await this.wait(0.9, "ui");
    // chips go to the balance (or to the house)
    const h0 = this.hud();
    snd.play(net > 0 ? "chips_payout" : "chips_stack", 0.8);
    const flights = [];
    for (const [i, result, bet, payout] of e.results) {
      const h = this.hands[i];
      if (!h) continue;
      h.showStack = false;
      const f = { t: "stack", amount: bet, x: this.handCenters()[i], y: BET_Y, z: 9000 };
      this.sprites.push(f);
      const toBalance = payout > 0;
      flights.push(this.run(async () => { await this.moveTo(f, toBalance ? 250 : 800, toBalance ? h0.vy0 + 40 : 30, 0.5, ease.inOutCubic, "ui"); this.remove(f); }));
    }
    await Promise.all(flights);
    this.insAmount = 0;
    const from = this.balShown, to = this.wallet.balance;
    await this.tw(0.4, (t) => { this.balShown = from + (to - from) * t; }, ease.outCubic, "ui");
  }

  async finishRound() {
    this.afterRound();
    this.phase = "betting";
    this.setStatus("Place your next bet");
    this.balShown = this.wallet.balance - this.pending;
    if (this.wallet.balance < this.rules.min_bet) await this.brokeFlow();
  }

  afterRound() {
    const st = this.app.store, rnd = this.round;
    st.bankroll = this.wallet.balance;
    if (rnd && !rnd.recorded && rnd.finished) { rnd.recorded = true; st.recordRound(rnd, this.decisions); }
    st.save();
  }

  /** Finish the unfinished round without animation (leaving mid-hand, a crash, or the tab closing). */
  finishHeadless() {
    const rnd = this.round;
    if (!rnd || rnd.finished || !this.gen) return;
    const decide = (ask) => (ask.kind === "action" ? this.strategy.bestAction(rnd.hands[ask.hand].cards, rnd.dealer[0], ask.legal)[0] : false);
    let send = this.parkedAsk ? decide(this.parkedAsk) : undefined;
    for (let n = 0; n < 10000; n++) {
      const r = this.gen.next(send);
      if (r.done) break;
      send = r.value.isAsk ? decide(r.value) : undefined;
    }
    this.gen = null; this.parkedAsk = null;
  }
  emergencyFinish() { try { this.finishHeadless(); } catch { if (this.round && !this.round.finished) this.wallet.balance = this.round.balanceBefore; } this.afterRound(); }
  recover() { this.emergencyFinish(); this.phase = "betting"; this.askResolve = null; this.app.toast("Something went wrong - your chips are safe", "bad", 3); }

  async brokeFlow() {
    const st = this.app.store, fresh = Math.trunc(st.settings.start_bankroll);
    const v = await this.modal({ title: "Out of chips", body: `You can't cover the minimum bet. Take a fresh ${fmtMoney(fresh)} and keep playing?`,
      buttons: [{ label: "Fresh chips", style: "gold", value: true }, { label: "Main menu", style: "dark", value: false }], default: true, cancel: false });
    if (v) { st.resetBankroll(true); this.wallet.balance = st.bankroll; this.balShown = this.wallet.balance; this.setStatus("Place your bet"); }
    else this.app.goto("menu");
  }

  burst() {
    const [vx0, , vx1] = this.app.view;
    const COLORS = ["#f2c94c", "#eb5757", "#56ccf2", "#6fcf97", "#bb6bd9", "#ffffff", "#f2994a"];
    const n = this.app.touch ? 40 : 80;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI * (0.05 + Math.random() * 0.9), sp = 250 + Math.random() * 480;
      this.confetti.push({ x: vx0 + (vx1 - vx0) * (0.2 + Math.random() * 0.6), y: 520, vx: Math.cos(ang) * sp * 0.6, vy: Math.sin(ang) * sp, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 18, w: 6 + Math.random() * 7, h: 3 + Math.random() * 3, c: COLORS[i % COLORS.length], life: 2.4 + Math.random() * 1.2, age: 0 });
    }
    this.app.invalidate();
  }
  update(dt) {
    if (!this.confetti.length) return;
    for (const p of this.confetti) { p.age += dt; p.vy = Math.min(p.vy + 480 * dt, 460); p.vx *= 1 - 0.9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; }
    this.confetti = this.confetti.filter((p) => p.age < p.life);
    this.app.invalidate();
  }

  // ------------------------------------------------------------ navigation
  inRound() { return this.phase !== "betting"; }
  async onMenu() {
    const a = this.app;
    if (this.inRound()) {
      if (a.store.settings.confirm_leave) {
        const leave = await this.modal({ title: "Leave the table?", body: "Your hand will be finished for you using basic strategy, and your balance saved.", buttons: [{ label: "Stay", style: "dark", value: false }, { label: "Leave", style: "gold", value: true }], default: false, cancel: false });
        if (!leave) return;
      }
      this.emergencyFinish();
    } else a.session.pendingChips = this.betChips.slice();
    a.goto("menu");
  }
  go(name) {
    if (this.phase !== "betting") return;
    this.app.session.pendingChips = this.betChips.slice();
    this.app.goto(name, { back: "table" });
  }

  // ------------------------------------------------------------ input
  onKey(key) {
    if (this.app.modal) return false;
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (key === "Escape") { if (this.coachOpen) { this.coachOpen = false; return true; } this.run(() => this.onMenu()); return true; }
    if (this.phase === "betting") {
      if (/^[1-9]$/.test(k)) {
        const d = this.rackDenoms()[+k - 1];
        if (d) { if (this.pending + d > this.cap) this.app.sound.play("deny"); else this.onChip(d); }
        return true;
      }
      if (k === " " || key === "Enter") { this.onDeal(); return true; }
      if (key === "Backspace" || k === "u") { this.onUndo(); return true; }
      if (k === "c") { this.onClear(); return true; }
      if (k === "r") { this.onRebet(); return true; }
      if (k === "m") { this.onMax(); return true; }
      if (k === "a") { this.onAllIn(); return true; }
      if (k === "x") { this.onX2(); return true; }
    }
    if (this.phase === "player") {
      const map = { h: "hit", s: "stand", d: "double", p: "split", r: "surrender" };
      if (map[k]) { this.onAction(map[k]); return true; }
      if (k === "t") { this.onHint(); return true; }
    }
    return false;
  }
  onAudioChanged() { this.app.invalidate(); }

  // ------------------------------------------------------------ drawing
  feltLines() {
    const r = this.rules;
    return [`BLACKJACK PAYS ${r.bj_num} TO ${r.bj_den}`, r.h17 ? "DEALER MUST HIT SOFT 17" : "DEALER MUST STAND ON ALL 17s", r.insurance ? "INSURANCE PAYS 2 TO 1" : "NO INSURANCE"];
  }

  draw(ctx) {
    const a = this.app, s = a.store.settings;
    a.assets.felt(ctx, a, s.felt, this.feltLines());
    this.drawDiscard(ctx);
    if (!this.hands.length && this.pending) this.drawStack(ctx, this.pending, 800, BET_Y, true);
    const centers = this.hands.length ? this.handCenters() : [];
    this.hands.forEach((h, i) => { if (h.showStack !== false && h.bet) this.drawStack(ctx, h.bet, centers[i], BET_Y, true); });
    if (this.insAmount) this.drawStack(ctx, this.insAmount, INS[0], INS[1], true);
    this.drawBadges(ctx, centers);
    const list = [...this.sprites].sort((p, q) => p.z - q.z);
    for (const sp of list) this.drawSprite(ctx, sp);
    this.drawConfetti(ctx);
    this.drawCount(ctx);
    this.drawHud(ctx);
    this.drawCoach(ctx);
  }

  drawDiscard(ctx) {
    const n = Math.min(14, Math.floor(((this.app.session.discards || 0) + 5) / 6)), a = this.app, back = a.store.settings.card_back;
    for (let k = 0; k < n; k++) a.assets.card(ctx, "BACK", DISCARD[0] + (k % 2) * 0.6, DISCARD[1] - k * 1.3, { back, flip: 0, scale: 0.9, rot: -0.12 });
  }

  drawSprite(ctx, sp) {
    const a = this.app, s = a.store.settings;
    if (sp.t === "card") a.assets.card(ctx, sp.card.code, sp.x, sp.y, { flip: sp.flip, scale: sp.scale, rotated: sp.rotated, alpha: sp.alpha, back: s.card_back, fourColor: s.four_color, rot: sp.rot });
    else if (sp.t === "chip") a.assets.chip(ctx, sp.denom, sp.x, sp.y, CHIP_D);
    else if (sp.t === "stack") this.drawStack(ctx, sp.amount, sp.x, sp.y, false);
    else if (sp.t === "banner") {
      const k = sp.age, sc = 0.7 + 0.3 * ease.outBack(Math.min(1, k * 4)), al = Math.min(1, (1 - k) * 4, k * 8);
      ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(800, 400); ctx.scale(sc, sc);
      a.text(sp.text, 0, 0, { size: 84, weight: "bold", family: "display", color: sp.color, shadow: "rgba(0,0,0,0.9)", shadowOff: 4 });
      ctx.restore();
    }
  }

  drawStack(ctx, amount, x, y, label) {
    if (amount <= 0) return;
    const a = this.app, chips = chipBreakdown(amount, [500000, 100000, 50000, 10000, 2500, 500, 100]).slice(0, 18);
    chips.reverse().forEach((d, i) => a.assets.chip(ctx, d, x, y - i * 4.5, CHIP_D));
    if (label) {
      const t = fmtMoney(amount), w = a.measure(t, { size: 15, weight: "bold" }) + 22;
      roundRect(ctx, x + 40, y - 12, w, 24, 12); ctx.fillStyle = "rgba(10,10,12,0.9)"; ctx.fill();
      ctx.strokeStyle = "rgba(233,196,106,0.6)"; ctx.lineWidth = 1; ctx.stroke();
      a.text(t, x + 40 + w / 2, y, { size: 15, weight: "bold", color: "#f6e3a8", shadow: null });
    }
  }

  badgeText(cards) { return cards.length ? totalText(cards) : ""; }
  drawBadge(ctx, text, x, y, color, hot) {
    const a = this.app, w = Math.max(40, a.measure(text, { size: 19, weight: "bold" }) + 24);
    roundRect(ctx, x - w / 2, y - 14, w, 28, 14);
    ctx.fillStyle = hot ? "rgba(70,48,8,0.94)" : "rgba(12,14,16,0.92)"; ctx.fill();
    ctx.strokeStyle = hot ? "rgba(233,196,106,0.95)" : "rgba(255,255,255,0.16)"; ctx.lineWidth = 1.4; ctx.stroke();
    a.text(text, x, y + 1, { size: 19, weight: "bold", color, shadow: null });
  }
  drawBadges(ctx, centers) {
    const a = this.app, show = a.store.settings.show_totals;
    if (show) {
      const dc = this.dealer.cards.filter((s) => s.faceUp);
      if (dc.length) {
        const t = totalText(dc.map((s) => s.card)), bust = handTotalOf(dc) > 21;
        this.drawBadge(ctx, this.dealer.cards.length === 2 && !this.dealer.cards[1].faceUp ? String(dc[0].card.value === 1 ? "A" : dc[0].card.value) : bust ? `BUST ${handTotalOf(dc)}` : t, 800, DEALER_Y + CARD_H / 2 + 24, bust ? "#f06e64" : "#fff", false);
      }
    }
    this.hands.forEach((h, i) => {
      const cx = centers[i], y = PLAYER_Y - CARD_H / 2 - 24;
      if (show && h.cards.length) {
        const cs = h.cards.filter((s) => s.faceUp || s.flip > 0.6).map((s) => s.card), tot = handTotalOf(h.cards.map((s) => ({ card: s.card })));
        if (cs.length === h.cards.length) this.drawBadge(ctx, tot > 21 ? `BUST ${tot}` : totalText(cs), cx, y, tot > 21 ? "#f06e64" : tot === 21 ? "#ffd25a" : "#fff", i === this.activeHand && this.phase === "player");
      }
      if (h.result) {
        const w = a.measure(h.result.label, { size: 22, weight: "bold" }) + 34, ry = y - 40;
        roundRect(ctx, cx - w / 2, ry - 17, w, 34, 17); ctx.fillStyle = "rgba(10,12,14,0.94)"; ctx.fill();
        ctx.strokeStyle = h.result.color; ctx.lineWidth = 1.8; ctx.stroke();
        a.text(h.result.label, cx, ry + 1, { size: 22, weight: "bold", color: h.result.color, shadow: null });
      }
      if (this.phase === "player" && i === this.activeHand && this.hands.length > 1) {
        ctx.fillStyle = "#e9c46a"; ctx.beginPath(); ctx.moveTo(cx - 10, y - 34); ctx.lineTo(cx + 10, y - 34); ctx.lineTo(cx, y - 22); ctx.fill();
      }
    });
  }

  drawConfetti(ctx) {
    for (const p of this.confetti) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.min(1, (p.life - p.age) * 2);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.a * 1.3)), p.w, p.h * Math.abs(Math.cos(p.a * 1.3)) + 1); ctx.restore();
    }
  }

  drawCount(ctx) {
    if (!this.app.store.settings.show_count) return;
    const rc = this.app.session.rc || 0, tc = rc / this.shoe.decksRemaining;
    this.app.text(`Running ${rc > 0 ? "+" : ""}${rc}  ·  True ${tc > 0 ? "+" : ""}${tc.toFixed(1)}`, SHOE[0] + 44, SHOE[1] + 92, { size: 14, family: "num", color: "#d8cfb8" });
  }

  // ------------------------------------------------------------ HUD
  drawHud(ctx) {
    const a = this.app, h = this.hud(), k = h.k, st = a.store.settings, betting = this.phase === "betting", player = this.phase === "player";
    // bottom bar
    const g = ctx.createLinearGradient(0, h.barTop, 0, h.vy1);
    g.addColorStop(0, "rgba(22,19,16,0.94)"); g.addColorStop(1, "rgba(6,6,7,0.96)");
    ctx.fillStyle = g; ctx.fillRect(h.vx0 - 20, h.barTop, h.vx1 - h.vx0 + 40, h.barH + 20);
    ctx.fillStyle = "rgba(233,196,106,0.6)"; ctx.fillRect(h.vx0 - 20, h.barTop, h.vx1 - h.vx0 + 40, 2);

    // status line: left of the bet circle so it never sits on the chips
    const sx = Math.max(h.vx0 + 20 + 0, 430);
    a.text(this.status, sx, h.barTop - 19 * Math.min(k, 1.3), { size: 15.5 * Math.min(k, 1.3), color: "#f3e6c6" });

    // top bar
    const ty = 8 + 21 * k, canNav = betting;
    button(a, { id: "menu", x: h.vx0 + 16 + 59 * k, y: ty, w: 118 * k, h: 42 * k, label: "Menu", icon: "menu", style: "ghost", size: 15 * k, iconSize: 18 * k, fn: () => this.run(() => this.onMenu()) });
    const rx = h.vx1 - 16 - 22 * k;
    button(a, { id: "sound", x: rx, y: ty, w: 44 * k, h: 42 * k, icon: st.muted ? "mute" : "sound", style: "ghost", iconSize: 22 * k, fn: () => a.toggleMute() });
    button(a, { id: "settings", x: rx - 52 * k, y: ty, w: 44 * k, h: 42 * k, icon: "gear", style: "ghost", iconSize: 22 * k, enabled: canNav, disabledTip: "Available between hands", fn: () => this.go("settings") });
    button(a, { id: "stats", x: rx - 104 * k, y: ty, w: 44 * k, h: 42 * k, icon: "stats", style: "ghost", iconSize: 20 * k, enabled: canNav, disabledTip: "Available between hands", fn: () => this.go("stats") });
    a.text(this.rules.short(), 800, 70, { size: 11.5, family: "num", color: "#d9c99e" });
    // balance and bet, to the right of the discard tray
    const bx = Math.max(h.vx0 + 16 + 118 * k + 30, 235);
    const bt = bx + Math.max(150 * k, a.measure(fmtMoney(Math.round(this.balShown)), { size: 26 * k, weight: "bold", family: "num" }) + 34);
    a.text("BALANCE", bx, 14 + 7 * k, { size: 12 * k, weight: "bold", color: "#c9a85a", align: "left", shadow: null });
    a.text(fmtMoney(Math.round(this.balShown)), bx, 14 + 28 * k, { size: 26 * k, weight: "bold", family: "num", color: "#f6ecd2", align: "left" });
    a.text("BET", bt, 14 + 7 * k, { size: 12 * k, weight: "bold", color: "#c9a85a", align: "left", shadow: null });
    a.text(fmtMoney(this.hands.length ? this.hands.reduce((t, x) => t + (x.showStack === false ? 0 : x.bet), 0) : this.pending), bt, 14 + 28 * k, { size: 26 * k, weight: "bold", family: "num", color: "#f6ecd2", align: "left" });

    if (betting) this.drawBetRow(ctx, h);
    if (player) this.drawActionRow(ctx, h);
  }

  drawBetRow(ctx, h) {
    const a = this.app, k = h.k, y = h.rowY, row = this.row(h), r = this.rules, bal = this.wallet.balance, cap = this.cap;
    button(a, { id: "max", x: row.maxX, y: y - 20 * k, w: 128 * k, h: 34 * k, label: "MAX BET", style: "amber", size: 13 * k, keycap: "M", keycapSide: "right", enabled: bal >= r.max_bet && this.pending !== r.max_bet, disabledTip: bal < r.max_bet ? "Not enough chips for the table maximum" : "Already at the table maximum", fn: () => this.onMax() });
    const allin = this.allInAmount();
    button(a, { id: "allin", x: row.maxX, y: y + 20 * k, w: 128 * k, h: 34 * k, label: "ALL IN", style: "red", size: 13 * k, keycap: "A", keycapSide: "right", enabled: allin >= r.min_bet && this.pending !== allin, disabledTip: "Not enough chips", fn: () => this.onAllIn() });
    this.rackDenoms().forEach((d, i) => {
      const x = row.chip0 + (i + 0.5) * 70 * k, id = "chip" + d, ok = this.pending + d <= cap, hover = a.isHover(id), pressed = a.isPressed(id);
      ctx.save();
      if (!ok) ctx.globalAlpha = 0.35;
      a.assets.chip(ctx, d, x, y - (hover && ok ? 5 : 0) + (pressed ? 3 : 0), 62 * k);
      ctx.restore();
      if (!a.touch) a.text(String(i + 1), x, y + 38 * k, { size: 11.5, weight: "bold", color: "#d2c294", family: "num", shadow: null });
      a.hit({ id, x, y, w: 64 * k, h: 70 * k, enabled: ok, disabledTip: this.pending + d > r.max_bet ? `Table maximum is ${fmtMoney(r.max_bet)}` : "Not enough chips", fn: () => this.onChip(d) });
    });
    const sm = [["undo", "undo", 20, !!this.betChips.length, () => this.onUndo(), "Bksp", "Nothing to undo"], ["clear", "close", 18, this.pending > 0, () => this.onClear(), "C", "No bet placed"], ["x2", "x2", 24, this.pending > 0 && this.pending * 2 <= cap, () => this.onX2(), "X", "Can't double the bet"]];
    sm.forEach(([id, icon, size, en, fn, cap2, tip], i) => button(a, { id, x: row.small0 + 23 * k + i * 52 * k, y, w: 46 * k, h: 46 * k, icon, iconSize: size * k, style: "dark", enabled: en, disabledTip: tip, keycap: cap2, fn }));
    const rb = this.rebetAmount();
    button(a, { id: "rebet", x: row.rebetX, y, w: 120 * k, h: 46 * k, label: "Rebet", icon: "rebet", style: "dark", size: 15 * k, iconSize: 18 * k, keycap: "R", enabled: rb >= r.min_bet && rb !== this.pending, disabledTip: "No previous bet", fn: () => this.onRebet() });
    const direct = this.pending === 0 && rb >= r.min_bet;
    button(a, { id: "deal", x: row.dealX, y, w: 196 * k, h: 58 * k, label: direct ? "REBET & DEAL" : "DEAL", icon: direct ? null : "cards", style: "gold", size: (direct ? 17 : 21) * k, iconSize: 22 * k, keycap: "Space", enabled: direct || this.pending >= r.min_bet, disabledTip: `Minimum bet is ${fmtMoney(r.min_bet)}`, fn: () => this.onDeal() });
  }

  drawActionRow(ctx, h) {
    const a = this.app, k = h.k, y = h.rowY, st = this.round.actionStatus(this.activeHand), hints = a.store.settings.hints;
    ACTIONS.forEach((act, i) => {
      const [label, style, icon, key] = ACTION_INFO[act], [ok, why] = st[act];
      button(a, { id: "act" + act, x: 800 + (i - 2) * 162 * k, y, w: 152 * k, h: 56 * k, label, style, icon, size: 18 * k, iconSize: 22 * k, keycap: key.toUpperCase(), enabled: ok, disabledTip: why, fn: () => this.onAction(act) });
    });
    if (hints !== "off") button(a, { id: "hint", x: h.vx1 - 16 - 75 * k, y, w: 150 * k, h: 50 * k, label: "Hint", icon: "hint", style: "ghost", size: 16 * k, iconSize: 20 * k, keycap: "T", fn: () => this.onHint() });
  }

  drawCoach(ctx) {
    if (!this.coachOpen || !this.advice || this.phase !== "player") return;
    const a = this.app, adv = this.advice, rnd = this.round, h = this.hud(), k = Math.min(h.k, 1.3);
    const cards = rnd.hands[this.activeHand].cards.map((c) => c), best = adv.action;
    const line = explain(cards, rnd.dealer[0], adv.ideal, this.strategy);
    const w = 400 * k, x = Math.max(h.vx0 + 20, 20) + w / 2 + 10, size = 15.5 * k;
    const bodyH = a.paragraph(line, 0, -9999, w - 40 * k, { size });
    const ph = 86 * k + bodyH, y = PLAYER_Y - 40 - ph / 2 + 40;
    panel(ctx, x - w / 2, y - ph / 2, w, ph, { r: 16, fill: "rgba(14,16,20,0.95)", border: "rgba(233,196,106,0.7)", shadow: true });
    a.text("BASIC STRATEGY SAYS", x - w / 2 + 20 * k, y - ph / 2 + 22 * k, { size: 11.5 * k, weight: "bold", color: "#c9a85a", align: "left", shadow: null });
    a.text(ACTION_LABEL[adv.ideal].toUpperCase() + (adv.blocked ? `  (can't: ${ACTION_LABEL[best]})` : ""), x - w / 2 + 20 * k, y - ph / 2 + 50 * k, { size: 26 * k, weight: "bold", family: "display", color: "#f2d07a", align: "left", shadow: null });
    a.paragraph(line, x - w / 2 + 20 * k, y - ph / 2 + 74 * k, w - 40 * k, { size, color: "#ece4d2", align: "left" });
  }
}

function handTotalOf(items) {
  // items are sprites (with .card) or {card}; same maths as the engine
  let hard = 0, ace = false;
  for (const it of items) { const c = it.card; hard += c.value; if (c.rank === "A") ace = true; }
  return ace && hard + 10 <= 21 ? hard + 10 : hard;
}
