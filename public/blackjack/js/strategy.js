// Basic strategy, computed (not memorised): the expected value (EV) of every
// option for any table rules, using a first-order card-removal model. The best
// option is "basic strategy", and it adapts to H17, no-DAS, doubling limits and
// European no-hole-card rules. EVs are per 1 unit bet.
import { handTotal } from "./engine.js";

const BASE_P = [0, ...Array(9).fill(1 / 13), 4 / 13];       // index 1..10 (1 = Ace)
const ORDER = ["stand", "hit", "double", "split", "surrender"];
export const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];

const best = (hard, ace) => (ace && hard + 10 <= 21 ? hard + 10 : hard);

class Model {
  constructor(rules, decks, removed) {
    this.r = rules;
    if (decks) {
      const comp = [0, ...Array(9).fill(4 * decks), 16 * decks];
      for (const c of removed) comp[c] = Math.max(0, comp[c] - 1);
      const tot = comp.reduce((a, b) => a + b, 0);
      this.P = comp.map((x) => x / tot);
    } else this.P = BASE_P;
    this._dist = new Map(); this._hit = new Map(); this._split = new Map();
  }

  dealerDist(up) {
    if (this._dist.has(up)) return this._dist.get(up);
    const { P } = this, { h17, peek } = this.r, memo = new Map();
    const finish = (hard, ace) => {
      const key = hard * 2 + (ace ? 1 : 0);
      if (memo.has(key)) return memo.get(key);
      const b = best(hard, ace), soft = ace && hard + 10 <= 21;
      let res;
      if (hard > 21) res = { 22: 1 };
      else if (b > 17 || (b === 17 && !(soft && h17))) res = { [b]: 1 };
      else {
        res = {};
        for (let c = 1; c <= 10; c++) for (const [k, v] of Object.entries(finish(hard + c, ace || c === 1))) res[k] = (res[k] || 0) + P[c] * v;
      }
      memo.set(key, res);
      return res;
    };
    let dist = {}, norm = 0;
    for (let c = 1; c <= 10; c++) {
      const p = P[c];
      if ((up === 1 && c === 10) || (up === 10 && c === 1)) {
        if (peek) continue;                 // we already know the dealer has no blackjack
        dist.bj = (dist.bj || 0) + p; norm += p;
        continue;
      }
      norm += p;
      for (const [k, v] of Object.entries(finish(up + c, up === 1 || c === 1))) dist[k] = (dist[k] || 0) + p * v;
    }
    for (const k of Object.keys(dist)) dist[k] /= norm;
    this._dist.set(up, dist);
    return dist;
  }

  evStand(total, up) {
    if (total > 21) return -1;
    const d = this.dealerDist(up);
    let ev = (d[22] || 0) - (d.bj || 0);
    for (const t of [17, 18, 19, 20, 21]) {
      const p = d[t] || 0;
      if (total > t) ev += p; else if (total < t) ev -= p;
    }
    return ev;
  }

  evHit(hard, ace, up) {
    const key = (hard * 2 + (ace ? 1 : 0)) * 12 + up;
    if (this._hit.has(key)) return this._hit.get(key);
    let ev = 0;
    for (let c = 1; c <= 10; c++) {
      const nh = hard + c, na = ace || c === 1;
      if (nh > 21) { ev -= this.P[c]; continue; }
      const b = best(nh, na);
      let s = this.evStand(b, up);
      if (b < 21) s = Math.max(s, this.evHit(nh, na, up));
      ev += this.P[c] * s;
    }
    this._hit.set(key, ev);
    return ev;
  }

  evDouble(hard, ace, up) {
    let ev = 0;
    for (let c = 1; c <= 10; c++) {
      const nh = hard + c, na = ace || c === 1;
      ev += this.P[c] * (nh > 21 ? -1 : this.evStand(best(nh, na), up));
    }
    return 2 * ev;
  }

  _splitHand(v, up, k) {
    const key = (v * 12 + up) * 8 + k;
    if (this._split.has(key)) return this._split.get(key);
    const r = this.r;
    let tot = 0;
    for (let c = 1; c <= 10; c++) {
      const hard = v + c, ace = v === 1 || c === 1, b = best(hard, ace);
      let val;
      if (v === 1 && !r.hit_split_aces) {
        val = this.evStand(b, up);
        if (c === 1 && k > 0 && r.resplit_aces) val = Math.max(val, 2 * this._splitHand(1, up, k - 1));
      } else {
        const opts = [this.evStand(b, up)];
        if (b < 21) opts.push(this.evHit(hard, ace, up));
        if (r.das && v !== 1 && r.doubleTotalOk(b)) opts.push(this.evDouble(hard, ace, up));
        if (c === v && k > 0 && (v !== 1 || r.resplit_aces)) opts.push(2 * this._splitHand(v, up, k - 1));
        val = Math.max(...opts);
      }
      tot += this.P[c] * val;
    }
    this._split.set(key, tot);
    return tot;
  }
  evSplit(v, up) { return 2 * this._splitHand(v, up, Math.max(0, this.r.max_hands - 2)); }
}

export class Strategy {
  constructor(rules) {
    this.r = rules;
    this.decks = rules.decks >= 4 ? 6 : rules.decks;       // 4, 6 and 8 decks share one chart
    this._models = new Map(); this._cells = new Map();
    this._base = new Model(rules, 0, []);
  }
  get approximate() { return this.decks < 4; }
  _model(removed) {
    const key = [...removed].sort((a, b) => a - b).join(",");
    let m = this._models.get(key);
    if (!m) { m = new Model(this.r, this.decks, removed); this._models.set(key, m); }
    return m;
  }
  bustChance(up) { return this._base.dealerDist(up)[22] || 0; }

  /** EVs of all rule-allowed options for a chart cell. kind: hard (row 4..20), soft (row 2..9 = A,2..A,9), pair (row 1..10). */
  cellEvs(kind, row, up) {
    const key = `${kind}${row}/${up}`;
    if (this._cells.has(key)) return this._cells.get(key);
    const r = this.r;
    let comps, hard, ace;
    if (kind === "hard") {
      comps = [];
      for (let a = 2; a <= 10; a++) if (a < row - a && row - a <= 10) comps.push([a, row - a]);
      if (!comps.length) comps = [[Math.floor(row / 2), row - Math.floor(row / 2)]];
      hard = row; ace = false;
    } else if (kind === "soft") { comps = [[1, row]]; hard = 1 + row; ace = true; }
    else { comps = [[row, row]]; hard = 2 * row; ace = row === 1; }
    const b = best(hard, ace), acc = {};
    let wsum = 0;
    for (const [c1, c2] of comps) {
      const w = BASE_P[c1] * BASE_P[c2], m = this._model([c1, c2, up]);
      const evs = { stand: m.evStand(b, up) };
      if (b < 21) evs.hit = m.evHit(hard, ace, up);
      if (r.doubleTotalOk(b)) evs.double = m.evDouble(hard, ace, up);
      if (kind === "pair") evs.split = m.evSplit(row, up);
      for (const [a, e] of Object.entries(evs)) acc[a] = (acc[a] || 0) + w * e;
      wsum += w;
    }
    const out = {};
    for (const [a, e] of Object.entries(acc)) out[a] = e / wsum;
    if (r.surrenderAllowed) out.surrender = -0.5;
    this._cells.set(key, out);
    return out;
  }

  static cellOf(cards, pairOk = true) {
    const [t, soft] = handTotal(cards);
    if (pairOk && cards.length === 2 && (cards[0].rank === cards[1].rank || (cards[0].isTen && cards[1].isTen))) return ["pair", cards[0].value];
    if (soft && t >= 13 && t <= 20) return ["soft", t - 11];
    if (soft && t === 12) return ["pair", 1];
    return ["hard", Math.max(4, Math.min(20, t))];
  }

  static pick(evs) {
    let bestA = null, bestEv = null;
    for (const a of ORDER) if (a in evs && (bestEv === null || evs[a] > bestEv + 1e-12)) { bestA = a; bestEv = evs[a]; }
    return bestA;
  }

  evaluate(cards, upCard, legal) {
    const up = typeof upCard === "number" ? upCard : upCard.value;
    const [t] = handTotal(cards);
    if (t >= 21) return legal.has("stand") ? { stand: this._base.evStand(Math.min(t, 22), up) } : {};
    let [kind, row] = Strategy.cellOf(cards);
    let evs = this.cellEvs(kind, row, up);
    if (kind === "pair" && cards.length !== 2) { [kind, row] = Strategy.cellOf(cards, false); evs = this.cellEvs(kind, row, up); }
    const out = {};
    for (const [a, e] of Object.entries(evs)) if (legal.has(a)) out[a] = e;
    return out;
  }
  bestAction(cards, upCard, legal) {
    const evs = this.evaluate(cards, upCard, legal);
    return [Strategy.pick(evs), evs];
  }
  /** Advice for hand i of an engine Round: `ideal` under the rules, `action` the best you can actually do now. */
  advise(rnd, i = rnd.current) {
    const h = rnd.hands[i], up = rnd.dealer[0];
    const [ideal, idealEvs] = this.bestAction(h.cards, up, rnd.ruleLegalActions(i));
    const [action, evs] = this.bestAction(h.cards, up, rnd.legalActions(i));
    return { action, evs, ideal, idealEvs, blocked: ideal !== action };
  }

  chartCode(kind, row, up) {
    const evs = this.cellEvs(kind, row, up), b = Strategy.pick(evs);
    if (["stand", "hit", "split"].includes(b)) return { stand: "S", hit: "H", split: "P" }[b];
    const rest = {};
    for (const [a, e] of Object.entries(evs)) if (a !== "double" && a !== "surrender") rest[a] = e;
    const fb = Strategy.pick(rest);
    if (b === "double") return fb === "stand" ? "Ds" : "Dh";
    return { stand: "Rs", hit: "Rh", split: "Rp" }[fb];
  }
  chart() {
    const out = { hard: [], soft: [], pair: [] };
    for (let t = 5; t <= 20; t++) out.hard.push([String(t), UPCARDS.map((u) => this.chartCode("hard", t, u))]);
    for (let o = 2; o <= 9; o++) out.soft.push([`A,${o}`, UPCARDS.map((u) => this.chartCode("soft", o, u))]);
    for (const v of [1, 10, 9, 8, 7, 6, 5, 4, 3, 2]) out.pair.push([v === 1 ? "A,A" : `${v},${v}`, UPCARDS.map((u) => this.chartCode("pair", v, u))]);
    return out;
  }
}

export const ACTION_LABEL = { hit: "Hit", stand: "Stand", double: "Double", split: "Split", surrender: "Surrender" };

const upName = (card) => (card.value === 1 ? "an Ace" : card.value === 8 ? "an 8" : `a ${card.value}`);

/** One or two friendly sentences explaining a basic strategy decision. */
export function explain(cards, upCard, action, strat = null) {
  const [t, soft] = handTotal(cards), up = upCard.value, weak = up >= 2 && up <= 6;
  const pair = cards.length === 2 && cards[0].rank === cards[1].rank;
  const tensPair = cards.length === 2 && cards[0].isTen && cards[1].isTen;
  const bust = strat ? ` (the dealer busts about ${Math.round(strat.bustChance(up) * 100)}% of the time from ${upName(upCard)})` : "";
  if (action === "split") {
    if (cards[0].isAce) return "Always split Aces: two hands that each start with 11 beat one soft 12.";
    if (cards[0].value === 8) return "Always split 8s: 16 is the worst total in blackjack, but each 8 is a decent start.";
    if (weak) return `Split - the dealer is weak${bust}, so you want more money on the table.`;
    return "Split - two hands starting with this card do better than one weak total.";
  }
  if (action === "surrender") return "This hand loses so often against that card that giving up half your bet is cheaper in the long run.";
  if (action === "double") {
    if (soft) return `Double your soft ${t} - the dealer is weak${bust}, and you cannot bust with one card.`;
    return `Double down on ${t}: one card will often give you a strong hand, so bet more.`;
  }
  if (action === "stand") {
    if (tensPair) return "Never split 10s - 20 is already a winning hand most of the time.";
    if (t >= 17 && !soft) return `${t} is strong enough. Hitting would risk busting for little gain.`;
    if (soft && t >= 18) return `Soft ${t} is a good total - stand.`;
    if (weak) return `Stand on ${t}: let the dealer take the risk${bust}.`;
    return `Stand on ${t}.`;
  }
  if (action === "hit") {
    if (pair && cards[0].value === 5) return "Never split 5s - treat them as a 10.";
    if (t <= 11 && !soft) return `With ${t} you cannot bust, so taking a card is free.`;
    if (soft) return `A soft ${t} cannot bust with one more card (the Ace can count as 1), so hit to improve.`;
    if (up >= 7 || up === 1) return `${t} is a "stiff" hand. The dealer's ${upCard.rank} will often make 17 or better, so you need to improve.`;
    return `Hit ${t} against ${upName(upCard)}.`;
  }
  return "";
}
