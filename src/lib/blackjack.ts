/**
 * The rules of the blackjack table at /blackjack, with no React in them.
 *
 * Six decks, dealer stands on every 17, blackjack pays 3:2, double on any two
 * cards (after a split too), split up to four hands with one card to each
 * split ace, insurance at 2:1, and the dealer checks for blackjack before
 * anyone plays. The chips are pretend.
 *
 * `reduce` never shuffles or reads a clock: a new shoe is handed in with the
 * `deal` action, so the same state and action always give the same table.
 */

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  /** Unique within a shoe. */
  id: number;
  rank: Rank;
  suit: Suit;
}

export type Outcome = "blackjack" | "win" | "push" | "lose" | "bust";

export interface Hand {
  cards: Card[];
  bet: number;
  /** Takes no more cards: stood, doubled, bust, on 21, or a split ace. */
  done: boolean;
  /** 21 on two cards after a split is just 21, not a blackjack. */
  split: boolean;
  outcome: Outcome | null;
}

/** "bet" is also the end of a round: the last hands stay out until the next deal. */
export type Phase = "bet" | "insurance" | "player" | "dealer";

export interface Game {
  phase: Phase;
  shoe: Card[];
  /** Chips not on the table. */
  balance: number;
  /** What the next deal will stake. */
  bet: number;
  dealer: Card[];
  holeHidden: boolean;
  hands: Hand[];
  active: number;
  insurance: number;
  /** What the round just finished won or lost overall; null until one has. */
  net: number | null;
}

export type Action =
  | { type: "restore"; balance: number }
  | { type: "chip"; amount: number }
  | { type: "clear" }
  | { type: "deal"; shoe: Card[] | null }
  | { type: "insurance"; take: boolean }
  | { type: "hit" }
  | { type: "stand" }
  | { type: "double" }
  | { type: "split" }
  | { type: "dealer" }
  | { type: "rebuy" };

export const DECKS = 6;
export const BUY_IN = 1000;
export const MIN_BET = 10;
export const CHIPS = [10, 50, 100, 500] as const;
export const MAX_HANDS = 4;
/** The cut card: a round never starts with fewer cards than this left. */
const RESHUFFLE_BELOW = 75;

/** What comes back per chip staked, stake included. */
const RETURNS: Record<Outcome, number> = { blackjack: 2.5, win: 2, push: 1, lose: 0, bust: 0 };

export function newGame(): Game {
  return {
    phase: "bet",
    shoe: [],
    balance: BUY_IN,
    bet: 50,
    dealer: [],
    holeHidden: true,
    hands: [],
    active: 0,
    insurance: 0,
    net: null,
  };
}

export function freshShoe(random: () => number = Math.random): Card[] {
  const shoe: Card[] = [];
  for (let deck = 0; deck < DECKS; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) shoe.push({ id: shoe.length, rank, suit });
    }
  }

  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export function needsShuffle(shoe: Card[]) {
  return shoe.length < RESHUFFLE_BELOW;
}

export function cardValue(rank: Rank) {
  if (rank === "A") return 11;
  return rank === "K" || rank === "Q" || rank === "J" ? 10 : Number(rank);
}

/** Aces count 11 until that would bust the hand. `soft` means one still does. */
export function total(cards: Card[]) {
  let sum = 0;
  let aces = 0;

  for (const card of cards) {
    sum += cardValue(card.rank);
    if (card.rank === "A") aces++;
  }
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  return { total: sum, soft: aces > 0 };
}

function isNatural(cards: Card[]) {
  return cards.length === 2 && total(cards).total === 21;
}

export function hasBlackjack(hand: Hand) {
  return !hand.split && isNatural(hand.cards);
}

export function insuranceCost(game: Game) {
  return game.bet / 2;
}

export function canDouble(game: Game) {
  const hand = game.hands[game.active];
  return game.phase === "player" && !!hand && hand.cards.length === 2 && game.balance >= hand.bet;
}

/** Any two cards worth the same split, so a king and a ten do. */
export function canSplit(game: Game) {
  const hand = game.hands[game.active];
  return (
    game.phase === "player" &&
    !!hand &&
    hand.cards.length === 2 &&
    cardValue(hand.cards[0].rank) === cardValue(hand.cards[1].rank) &&
    game.hands.length < MAX_HANDS &&
    game.balance >= hand.bet
  );
}

/** The largest bet the balance covers, in whole minimum chips. */
function affordable(bet: number, balance: number) {
  return Math.min(bet, Math.floor(balance / MIN_BET) * MIN_BET);
}

function draw(shoe: Card[], count: number): [Card[], Card[]] {
  return [shoe.slice(-count).reverse(), shoe.slice(0, -count)];
}

/** The dealer has looked at the hole card: a blackjack on either side ends the round here. */
function afterPeek(game: Game): Game {
  const decided = isNatural(game.dealer) || hasBlackjack(game.hands[0]);
  return { ...game, phase: decided ? "dealer" : "player" };
}

function settle(game: Game): Game {
  const dealer = total(game.dealer).total;
  const dealerNatural = isNatural(game.dealer);
  let staked = game.insurance;
  let returned = dealerNatural ? game.insurance * 3 : 0;

  const hands = game.hands.map(hand => {
    const mine = total(hand.cards).total;
    const natural = hasBlackjack(hand);
    let outcome: Outcome;

    if (mine > 21) outcome = "bust";
    else if (natural && !dealerNatural) outcome = "blackjack";
    else if (dealerNatural && !natural) outcome = "lose";
    else if (dealer > 21 || mine > dealer) outcome = "win";
    else outcome = mine === dealer ? "push" : "lose";

    staked += hand.bet;
    returned += hand.bet * RETURNS[outcome];
    return { ...hand, done: true, outcome };
  });

  const balance = game.balance + returned;
  return {
    ...game,
    phase: "bet",
    hands,
    holeHidden: false,
    balance,
    bet: affordable(game.bet, balance),
    net: returned - staked,
  };
}

/** Moves to the next hand still owed a decision, or hands over to the dealer. */
function advance(game: Game): Game {
  const hands = game.hands.map(hand =>
    hand.done || total(hand.cards).total < 21 ? hand : { ...hand, done: true },
  );
  const next = hands.findIndex(hand => !hand.done);
  if (next !== -1) return { ...game, hands, active: next };

  // Nothing left to beat, so the dealer turns the card over and draws nothing.
  if (hands.every(hand => total(hand.cards).total > 21)) {
    return settle({ ...game, hands });
  }
  return { ...game, hands, phase: "dealer" };
}

function dealerDraws(game: Game) {
  const contested = game.hands.some(hand => total(hand.cards).total <= 21 && !hasBlackjack(hand));
  return contested && total(game.dealer).total < 17;
}

function withActive(game: Game, change: (hand: Hand) => Hand): Hand[] {
  return game.hands.map((hand, index) => (index === game.active ? change(hand) : hand));
}

export function reduce(game: Game, action: Action): Game {
  const betting = game.phase === "bet";
  const hand = game.hands[game.active];

  switch (action.type) {
    case "restore":
      if (!betting || game.net !== null) return game;
      return { ...game, balance: action.balance, bet: affordable(game.bet, action.balance) };

    case "chip":
      if (!betting || game.bet + action.amount > game.balance) return game;
      return { ...game, bet: game.bet + action.amount };

    case "clear":
      return betting ? { ...game, bet: 0 } : game;

    case "rebuy":
      if (!betting || game.balance >= MIN_BET) return game;
      return { ...game, balance: BUY_IN, bet: 50 };

    case "deal": {
      const shoe = action.shoe ?? game.shoe;
      if (!betting || game.bet < MIN_BET || game.bet > game.balance || shoe.length < 4) return game;

      const [[mine1, up, mine2, hole], rest] = draw(shoe, 4);
      const dealt: Game = {
        ...game,
        shoe: rest,
        balance: game.balance - game.bet,
        dealer: [up, hole],
        holeHidden: true,
        hands: [{ cards: [mine1, mine2], bet: game.bet, done: false, split: false, outcome: null }],
        active: 0,
        insurance: 0,
        net: null,
      };

      if (up.rank === "A" && dealt.balance >= insuranceCost(dealt)) {
        return { ...dealt, phase: "insurance" };
      }
      return afterPeek(dealt);
    }

    case "insurance": {
      if (game.phase !== "insurance") return game;
      const cost = action.take ? insuranceCost(game) : 0;
      return afterPeek({ ...game, balance: game.balance - cost, insurance: cost });
    }

    case "hit": {
      if (game.phase !== "player") return game;
      const [[card], shoe] = draw(game.shoe, 1);
      return advance({
        ...game,
        shoe,
        hands: withActive(game, current => ({ ...current, cards: [...current.cards, card] })),
      });
    }

    case "stand":
      if (game.phase !== "player") return game;
      return advance({ ...game, hands: withActive(game, current => ({ ...current, done: true })) });

    case "double": {
      if (!canDouble(game)) return game;
      const [[card], shoe] = draw(game.shoe, 1);
      return advance({
        ...game,
        shoe,
        balance: game.balance - hand.bet,
        hands: withActive(game, current => ({
          ...current,
          cards: [...current.cards, card],
          bet: current.bet * 2,
          done: true,
        })),
      });
    }

    case "split": {
      if (!canSplit(game)) return game;
      const [[first, second], shoe] = draw(game.shoe, 2);
      const [left, right] = hand.cards;
      // Split aces get one card each and stop there.
      const part = (kept: Card, drawn: Card): Hand => ({
        cards: [kept, drawn],
        bet: hand.bet,
        done: kept.rank === "A",
        split: true,
        outcome: null,
      });

      return advance({
        ...game,
        shoe,
        balance: game.balance - hand.bet,
        hands: game.hands.flatMap((current, index) =>
          index === game.active ? [part(left, first), part(right, second)] : [current],
        ),
      });
    }

    case "dealer": {
      if (game.phase !== "dealer") return game;
      if (game.holeHidden) return { ...game, holeHidden: false };
      if (!dealerDraws(game)) return settle(game);

      const [[card], shoe] = draw(game.shoe, 1);
      return { ...game, shoe, dealer: [...game.dealer, card] };
    }
  }
}
