// Blackjack rules engine. A round is a generator that yields events ({kind, ...})
// to animate and asks ({isAsk: true, kind, ...}) that need a decision; send the
// answer back with gen.next(answer). No drawing code lives here.
// All money is integer cents so 3:2 payouts and half-bet surrenders stay exact.

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["S", "H", "D", "C"];
export const ACTIONS = ["hit", "stand", "double", "split", "surrender"];

export class Card {
  constructor(rank, suit) {
    if (rank === "T") rank = "10";
    if (!RANKS.includes(rank) || !SUITS.includes(suit)) throw new Error(`bad card ${rank}${suit}`);
    this.rank = rank;
    this.suit = suit;
  }
  static parse(code) {
    code = code.trim().toUpperCase();
    return new Card(code.slice(0, -1), code.slice(-1));
  }
  get value() { return this.rank === "A" ? 1 : "JQK".includes(this.rank) ? 10 : parseInt(this.rank, 10); }
  get isAce() { return this.rank === "A"; }
  get isTen() { return this.value === 10; }
  get hilo() { const v = this.value; return v >= 2 && v <= 6 ? 1 : v === 10 || v === 1 ? -1 : 0; }
  get code() { return this.rank + this.suit; }
}

export function handTotal(cs) {
  let hard = 0, ace = false;
  for (const c of cs) { hard += c.value; if (c.rank === "A") ace = true; }
  return ace && hard + 10 <= 21 ? [hard + 10, true] : [hard, false];
}

/** "7 / 17" for soft hands, "16" for hard ones. */
export function totalText(cs) {
  const [t, soft] = handTotal(cs);
  return soft && t !== 21 ? `${t - 10} / ${t}` : String(t);
}

export function fmtMoney(cents, plus = false) {
  const neg = cents < 0;
  cents = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(cents / 100), rem = cents % 100;
  let s = "$" + dollars.toLocaleString("en-US");
  if (rem) s += "." + String(rem).padStart(2, "0");
  if (neg) return "−" + s;
  return plus && cents > 0 ? "+" + s : s;
}

export function fmtChip(cents) {
  const d = Math.floor(cents / 100);
  return d >= 1000 && d % 1000 === 0 ? `${d / 1000}K` : String(d);
}

// ------------------------------------------------------------------ rules
const FIELDS = {
  decks: 6, h17: false, bj_num: 3, bj_den: 2, peek: true, double_on: "any", das: true, max_hands: 4,
  resplit_aces: false, hit_split_aces: false, split_by_value: true, surrender: true, insurance: true,
  penetration: 0.75, min_bet: 1000, max_bet: 100000,
};

export class Rules {
  constructor(kw = {}) {
    Object.assign(this, FIELDS);
    for (const k of Object.keys(FIELDS)) if (k in kw) this[k] = kw[k];
    this.validate();
  }
  validate() {
    this.decks = [1, 2, 4, 6, 8].includes(Math.trunc(this.decks)) ? Math.trunc(this.decks) : 6;
    this.max_hands = Math.min(4, Math.max(2, Math.trunc(this.max_hands)));
    if (!["any", "9-11", "10-11"].includes(this.double_on)) this.double_on = "any";
    if (!([[3, 2], [6, 5], [2, 1], [7, 5]].some(([n, d]) => n === this.bj_num && d === this.bj_den))) {
      this.bj_num = 3; this.bj_den = 2;
    }
    this.penetration = Math.min(0.9, Math.max(0.4, Number(this.penetration)));
    this.min_bet = Math.max(100, Math.trunc(this.min_bet));
    this.max_bet = Math.max(this.min_bet, Math.trunc(this.max_bet));
    for (const b of ["h17", "peek", "das", "resplit_aces", "hit_split_aces", "split_by_value", "surrender", "insurance"]) {
      this[b] = !!this[b];
    }
    return this;
  }
  get surrenderAllowed() { return this.surrender && this.peek; }
  toDict() { const d = {}; for (const k of Object.keys(FIELDS)) d[k] = this[k]; return d; }
  copy(kw = {}) { return new Rules({ ...this.toDict(), ...kw }); }
  static fromDict(d) { try { return new Rules(d || {}); } catch { return new Rules(); } }
  short() {
    const parts = [`${this.decks} DECK${this.decks > 1 ? "S" : ""}`, this.h17 ? "H17" : "S17", `BJ ${this.bj_num}:${this.bj_den}`];
    if (!this.peek) parts.push("NO HOLE CARD");
    if (this.double_on !== "any") parts.push(`DOUBLE ${this.double_on}`);
    parts.push(this.das ? "DAS" : "NO DAS");
    if (this.surrenderAllowed) parts.push("SURRENDER");
    return parts.join("  ·  ");
  }
  doubleTotalOk(total) {
    if (this.double_on === "9-11") return total >= 9 && total <= 11;
    if (this.double_on === "10-11") return total >= 10 && total <= 11;
    return true;
  }
}

// ------------------------------------------------------------------ randomness
/** Unbiased integer in [0, n) from the operating system's entropy source. */
function randBelow(n) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}

// ------------------------------------------------------------------ shoe
export class Shoe {
  /** `rand(n)` can be injected for tests; it must return an integer in [0, n). */
  constructor(decks = 6, penetration = 0.75, rand = randBelow) {
    this.rand = rand;
    this.decks = decks;
    this.penetration = penetration;
    this.stack = [];       // cards to deal next, in order (scripted situations / tests)
    this.cards = [];
    this.dealt = 0;
    this.cutAt = 0;
    this.shuffles = 0;
    this.emergency = false;
    this.shuffle();
  }
  get size() { return this.decks * 52; }
  shuffle(exclude = []) {
    const deck = [];
    for (let d = 0; d < this.decks; d++) for (const s of SUITS) for (const r of RANKS) deck.push(new Card(r, s));
    for (const c of exclude) {
      const i = deck.findIndex((x) => x.rank === c.rank && x.suit === c.suit);
      if (i >= 0) deck.splice(i, 1);
    }
    for (let i = deck.length - 1; i > 0; i--) {         // Fisher-Yates
      const j = this.rand(i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.cards = deck;
    this.dealt = 0;
    this.cutAt = Math.max(1, Math.trunc(this.size * this.penetration));
    this.shuffles++;
  }
  draw(inPlay = []) {
    if (this.stack.length) return this.stack.shift();
    if (!this.cards.length) {
      // Ran out mid-round: reshuffle everything that is not on the table right now.
      this.shuffle(inPlay);
      this.emergency = true;
      this.cutAt = 0;
    }
    this.dealt++;
    return this.cards.pop();
  }
  burn() {
    if (!this.cards.length) this.shuffle();
    this.dealt++;
    return this.cards.pop();
  }
  get needsShuffle() { return this.dealt >= this.cutAt; }
  get remaining() { return this.cards.length; }
  get decksRemaining() { return Math.max(0.25, this.cards.length / 52); }
  get fractionLeft() { return this.cards.length / this.size; }
}

export class Wallet {
  constructor(balance) { this.balance = Math.trunc(balance); }
  debit(a) {
    a = Math.trunc(a);
    if (a < 0 || a > this.balance) throw new Error(`cannot debit ${a} from ${this.balance}`);
    this.balance -= a;
  }
  credit(a) {
    a = Math.trunc(a);
    if (a < 0) throw new Error("negative credit");
    this.balance += a;
  }
}

// ------------------------------------------------------------------ hands
export class Hand {
  constructor(bet) {
    this.cards = [];
    this.bet = bet;            // total wagered on this hand (includes a double)
    this.baseBet = bet;
    this.doubled = false;
    this.surrendered = false;
    this.isSplit = false;
    this.splitAces = false;
    this.done = false;
    this.result = null;        // blackjack, win, push, lose, bust, surrender, even_money
    this.payout = 0;           // returned to the player, stake included
    this.actions = [];
  }
  get total() { return handTotal(this.cards)[0]; }
  get soft() { return handTotal(this.cards)[1]; }
  get isBust() { return this.total > 21; }
  get isBlackjack() { return this.cards.length === 2 && this.total === 21 && !this.isSplit; }
  get net() { return this.payout - this.bet; }
}

export const REASONS = {
  funds: "Not enough chips", max_hands: "Maximum number of hands reached",
  first_two: "Only allowed on your first two cards", das: "This table does not allow doubling after a split",
  double_on: "This table only allows doubling on {}", not_pair: "You need two cards of the same rank",
  split_aces: "Split Aces receive only one card each", resplit_aces: "This table does not allow re-splitting Aces",
  no_surrender: "Surrender is not offered at this table", surrender_first: "Surrender is only allowed as your first decision",
  surrender_split: "You cannot surrender after splitting", doubled: "You already doubled this hand",
  twentyone: "You already have 21",
};

const ev = (kind, data = {}) => ({ kind, isAsk: false, ...data });
const ask = (kind, data = {}) => ({ kind, isAsk: true, ...data });

// ------------------------------------------------------------------ round
export class Round {
  constructor(rules, shoe, wallet, bet) {
    if (bet <= 0 || bet > wallet.balance) throw new Error("invalid bet");
    this.rules = rules; this.shoe = shoe; this.wallet = wallet;
    this.initialBet = bet;
    this.hands = [new Hand(bet)];
    this.dealer = [];
    this.holeRevealed = false;
    this.insurance = 0; this.insurancePayout = 0;
    this.insuranceOffered = false; this.evenMoneyOffered = false; this.evenMoney = false;
    this.dealerBlackjack = false;
    this.current = 0;
    this.finished = false;
    this.balanceBefore = wallet.balance;
    this.wagered = 0;          // total money put at risk this round
    this.returned = 0;         // total paid back
  }

  inPlay() { return [...this.dealer, ...this.hands.flatMap((h) => h.cards)]; }

  _draw() {
    const before = this.shoe.shuffles;
    const c = this.shoe.draw(this.inPlay());
    return [c, this.shoe.shuffles !== before];
  }
  *_dealHand(i, rotated = false) {
    const [c, reshuffled] = this._draw();
    if (reshuffled) yield ev("shuffle", { emergency: true });
    this.hands[i].cards.push(c);
    yield ev("deal", { to: "player", hand: i, card: c, index: this.hands[i].cards.length - 1, faceUp: true, rotated });
  }
  *_dealDealer(faceUp) {
    const [c, reshuffled] = this._draw();
    if (reshuffled) yield ev("shuffle", { emergency: true });
    this.dealer.push(c);
    yield ev("deal", { to: "dealer", card: c, index: this.dealer.length - 1, faceUp, rotated: false });
  }
  _bet(a) { this.wallet.debit(a); this.wagered += a; }
  _pay(a) { if (a > 0) { this.wallet.credit(a); this.returned += a; } }

  get dealerTotal() { return handTotal(this.dealer)[0]; }
  isPair(h) {
    if (h.cards.length !== 2) return false;
    const [a, b] = h.cards;
    return a.rank === b.rank || (this.rules.split_by_value && a.isTen && b.isTen);
  }

  /** {action: [allowed, reasonOrNull]} for hand i. */
  actionStatus(i = this.current) {
    const h = this.hands[i], r = this.rules, n = h.cards.length, total = h.total, bal = this.wallet.balance;
    const st = { stand: [true, null] };
    if (h.splitAces && !r.hit_split_aces) st.hit = [false, REASONS.split_aces];
    else if (total >= 21) st.hit = [false, REASONS.twentyone];
    else st.hit = [true, null];
    if (n !== 2) st.double = [false, REASONS.first_two];
    else if (h.doubled) st.double = [false, REASONS.doubled];
    else if (h.splitAces) st.double = [false, REASONS.split_aces];
    else if (h.isSplit && !r.das) st.double = [false, REASONS.das];
    else if (!r.doubleTotalOk(total)) st.double = [false, REASONS.double_on.replace("{}", r.double_on === "9-11" ? "hard 9, 10 or 11" : "hard 10 or 11")];
    else if (bal < h.bet) st.double = [false, REASONS.funds];
    else st.double = [true, null];
    if (!this.isPair(h)) st.split = [false, REASONS.not_pair];
    else if (this.hands.length >= r.max_hands) st.split = [false, REASONS.max_hands];
    else if (h.splitAces && !r.resplit_aces) st.split = [false, REASONS.resplit_aces];
    else if (bal < h.bet) st.split = [false, REASONS.funds];
    else st.split = [true, null];
    if (!r.surrenderAllowed) st.surrender = [false, REASONS.no_surrender];
    else if (h.isSplit || this.hands.length > 1) st.surrender = [false, REASONS.surrender_split];
    else if (n !== 2 || h.actions.length) st.surrender = [false, REASONS.surrender_first];
    else st.surrender = [true, null];
    return st;
  }
  legalActions(i = this.current) {
    return new Set(Object.entries(this.actionStatus(i)).filter(([, [ok]]) => ok).map(([a]) => a));
  }
  /** Actions the rules allow, ignoring whether you can afford them. */
  ruleLegalActions(i = this.current) {
    return new Set(Object.entries(this.actionStatus(i)).filter(([, [ok, why]]) => ok || why === REASONS.funds).map(([a]) => a));
  }

  *play() {
    const r = this.rules, bet = this.initialBet;
    this._bet(bet);
    yield ev("bet", { amount: bet });
    // initial deal: player, dealer up, player, dealer hole
    yield* this._dealHand(0);
    yield* this._dealDealer(true);
    yield* this._dealHand(0);
    if (r.peek) yield* this._dealDealer(false);
    yield ev("dealt");

    const h0 = this.hands[0], up = this.dealer[0], playerBj = h0.isBlackjack;

    if (up.isAce && r.insurance) {
      if (playerBj) {
        this.evenMoneyOffered = true;
        const take = yield ask("even_money", { amount: h0.bet });
        if (take) {
          this.evenMoney = true;
          h0.result = "even_money"; h0.payout = h0.bet * 2; h0.done = true;
          this._pay(h0.payout);
          yield ev("even_money", { hand: 0, payout: h0.payout });
        }
      } else {
        const cost = Math.floor(h0.bet / 2);
        this.insuranceOffered = true;
        const take = yield ask("insurance", { cost, canAfford: this.wallet.balance >= cost });
        if (take && this.wallet.balance >= cost && cost > 0) {
          this._bet(cost);
          this.insurance = cost;
          yield ev("insurance", { amount: cost });
        }
      }
    }

    if (r.peek && (up.isAce || up.isTen)) {
      this.dealerBlackjack = handTotal(this.dealer)[0] === 21;
      yield ev("peek", { dealerBlackjack: this.dealerBlackjack });
      if (this.dealerBlackjack) {
        this.holeRevealed = true;
        yield ev("reveal", { card: this.dealer[1] });
        yield ev("dealer_blackjack");
        yield* this._settle();
        return;
      }
      if (this.insurance) yield ev("insurance_lost", { amount: this.insurance });
    }

    if (this.evenMoney) {
      yield* this._dealerTurn();
      yield* this._settle();
      return;
    }

    if (playerBj) {
      h0.done = true;
      if (r.peek || !(up.isAce || up.isTen)) {
        const pay = h0.bet + Math.floor((h0.bet * r.bj_num) / r.bj_den);
        h0.result = "blackjack"; h0.payout = pay;
        this._pay(pay);
        yield ev("blackjack", { hand: 0, payout: pay });
      } else {
        yield ev("blackjack_pending", { hand: 0 });     // European: the dealer could still match it
      }
    }

    let i = 0;
    while (i < this.hands.length) {
      const h = this.hands[i];
      this.current = i;
      if (!h.done) {
        if (h.cards.length < 2) yield* this._dealHand(i);
        yield* this._playHand(i);
      }
      i++;
    }
    this.current = this.hands.length - 1;
    yield* this._dealerTurn();
    yield* this._settle();
  }

  *_playHand(i) {
    const h = this.hands[i];
    yield ev("turn", { hand: i });
    while (!h.done) {
      if (h.isBust) { h.done = true; yield ev("bust", { hand: i }); break; }
      if (h.total === 21) { h.done = true; yield ev("stand", { hand: i, auto: true, reason: "21" }); break; }
      const legal = this.legalActions(i);
      if (legal.size === 1 && legal.has("stand")) {
        h.done = true;
        yield ev("stand", { hand: i, auto: true, reason: h.splitAces ? "split_aces" : "only" });
        break;
      }
      const action = yield ask("action", { hand: i, legal });
      if (!legal.has(action)) throw new Error(`${action} not legal`);
      h.actions.push(action);
      if (action === "stand") {
        h.done = true;
        yield ev("stand", { hand: i, auto: false, reason: "player" });
      } else if (action === "hit") {
        yield ev("hit", { hand: i });
        yield* this._dealHand(i);
      } else if (action === "double") {
        const extra = h.bet;
        this._bet(extra);
        h.bet += extra; h.doubled = true;
        yield ev("double", { hand: i, amount: extra });
        yield* this._dealHand(i, true);
        h.done = true;
        if (h.isBust) yield ev("bust", { hand: i });
        else yield ev("stand", { hand: i, auto: true, reason: "double" });
      } else if (action === "split") {
        const amount = h.bet;
        this._bet(amount);
        const moved = h.cards.pop();
        const nh = new Hand(amount);
        nh.cards.push(moved);
        nh.isSplit = true; h.isSplit = true;
        if (moved.isAce) { nh.splitAces = true; h.splitAces = true; }
        this.hands.splice(i + 1, 0, nh);
        yield ev("split", { hand: i, newHand: i + 1, amount, card: moved });
        yield* this._dealHand(i);
      } else if (action === "surrender") {
        h.surrendered = true; h.done = true;
        yield ev("surrender", { hand: i });
      }
    }
  }

  _needsDealerDraw() {
    return this.hands.some((h) => h.result === null && !h.surrendered && !h.isBust && !h.isBlackjack);
  }

  *_dealerTurn() {
    const r = this.rules;
    yield ev("dealer_turn");
    if (r.peek) {
      if (!this.holeRevealed) { this.holeRevealed = true; yield ev("reveal", { card: this.dealer[1] }); }
    } else {
      yield* this._dealDealer(true);        // no hole card: the second card is dealt now
      this.holeRevealed = true;
      if (handTotal(this.dealer)[0] === 21) { this.dealerBlackjack = true; yield ev("dealer_blackjack"); }
    }
    if (!this.dealerBlackjack && this._needsDealerDraw()) {
      for (;;) {
        const [t, soft] = handTotal(this.dealer);
        if (t < 17 || (t === 17 && soft && r.h17)) yield* this._dealDealer(true);
        else break;
      }
    }
    const t = this.dealerTotal;
    yield ev("dealer_done", { total: t, bust: t > 21, blackjack: this.dealerBlackjack });
  }

  *_settle() {
    const r = this.rules, dt = this.dealerTotal, dbust = dt > 21, dbj = this.dealerBlackjack;
    const results = [];
    this.hands.forEach((h, i) => {
      if (h.result === null) {
        if (h.surrendered) { h.result = "surrender"; h.payout = Math.floor(h.bet / 2); }
        else if (h.isBust) { h.result = "bust"; h.payout = 0; }
        else if (h.isBlackjack) {
          if (dbj) { h.result = "push"; h.payout = h.bet; }
          else { h.result = "blackjack"; h.payout = h.bet + Math.floor((h.bet * r.bj_num) / r.bj_den); }
        } else if (dbj) {
          // With no hole card the dealer's blackjack takes only the original bet; doubles and splits come back.
          h.result = "lose";
          h.payout = r.peek ? 0 : h.bet - (i === 0 ? this.initialBet : 0);
        } else if (dbust || h.total > dt) { h.result = "win"; h.payout = h.bet * 2; }
        else if (h.total === dt) { h.result = "push"; h.payout = h.bet; }
        else { h.result = "lose"; h.payout = 0; }
        this._pay(h.payout);
      }
      results.push([i, h.result, h.bet, h.payout]);
    });
    if (this.insurance && dbj) {
      this.insurancePayout = this.insurance * 3;
      this._pay(this.insurancePayout);
    }
    this.finished = true;
    yield ev("settle", { results, insurance: this.insurance, insurancePayout: this.insurancePayout, net: this.net });
  }

  get net() { return this.returned - this.wagered; }
}

/** Drive a round to completion with decide(ask) -> answer. Returns the events seen. */
export function runHeadless(gen, decide, firstSend) {
  const seen = [];
  let send = firstSend;
  for (let n = 0; n < 10000; n++) {
    const r = gen.next(send);
    if (r.done) return seen;
    seen.push(r.value);
    send = r.value.isAsk ? decide(r.value) : undefined;
  }
  throw new Error("round did not finish");
}

/** Split an amount (cents) into chip denominations, biggest first. */
export function chipBreakdown(amount, denoms = [500000, 100000, 50000, 10000, 2500, 500, 100, 50]) {
  const out = [];
  let rest = Math.trunc(amount);
  for (const d of denoms) while (rest >= d) { out.push(d); rest -= d; }
  if (rest > 0) out.push(rest);
  return out;
}
