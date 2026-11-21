// The optional "Win rate" setting. In Normal the shoe is a fair shuffle and none of
// this runs. In the other modes a round is sometimes *stacked* in the player's favour:
// when the dealer reaches for a card he picks one from the shoe on purpose (the dealer
// ends up stiff and busts; the player's hits avoid busting). Rounds are stacked just
// often enough that the share of rounds won tracks the target.
import { handTotal } from "./engine.js";

export const WIN_RATES = ["normal", 0.6, 0.8, 0.9, 1];

function randBelow(n) {
  const buf = new Uint32Array(1), limit = Math.floor(0x100000000 / n) * n;
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}
const pick = (idx) => (idx.length ? idx[randBelow(idx.length)] : null);
const hardOf = (cs) => cs.reduce((t, c) => t + c.value, 0);

export class Rig {
  constructor(target, luck) { this.target = target; this.luck = luck; this.active = false; }

  /** Once per round: stack this one? The chance is the deficit between the target share of wins and what has happened so far. */
  decide() {
    const deficit = this.target * (this.luck.rounds + 1) - this.luck.wins;
    this.active = deficit >= 1 || randBelow(1000000) / 1000000 < Math.max(0, deficit);
    return this.active;
  }

  /** Index into shoe.cards of the card to deal, or null for the normal (random) one. */
  choose(cards, ctx) {
    return ctx.who === "dealer" ? this.dealerCard(cards, ctx.round) : this.playerCard(cards, ctx.hand);
  }

  dealerCard(cards, round) {
    const d = round.dealer;
    if (!d.length) return null;                                  // the up card stays random
    const hard = hardOf(d), hasAce = d.some((c) => c.isAce), out = { stiff: [], bust: [] };
    cards.forEach((c, i) => {
      const nh = hard + c.value, na = hasAce || c.isAce, nt = na && nh + 10 <= 21 ? nh + 10 : nh;
      if (nh > 21) out.bust.push(i);
      else if (nt >= 12 && nt <= 16) out.stiff.push(i);
    });
    if (d.length === 1) return pick(out.stiff);                  // second card: a hand that has to draw
    return pick(out.bust) ?? pick(out.stiff);                    // then draw to a bust
  }

  playerCard(cards, hand) {
    if (!hand || hand.cards.length < 2) return null;             // opening cards stay random
    const hard = hardOf(hand.cards), safe = [];
    cards.forEach((c, i) => { if (hard + c.value <= 21) safe.push(i); });
    void handTotal;
    return pick(safe);                                           // a hit that does not bust
  }
}
