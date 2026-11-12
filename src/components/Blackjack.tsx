"use client";

import { useEffect, useReducer, useState, type CSSProperties, type ReactNode } from "react";
import { Reveal } from "@/components/Reveal";
import Variant from "@/components/Variant";
import {
  BUY_IN,
  CHIPS,
  DECKS,
  MIN_BET,
  canDouble,
  canSplit,
  cardValue,
  freshShoe,
  hasBlackjack,
  insuranceCost,
  needsShuffle,
  newGame,
  reduce,
  total,
  type Card,
  type Game,
  type Hand,
  type Outcome,
  type Suit,
} from "@/lib/blackjack";

const STORAGE_KEY = "blackjack-chips";
/** The pause between each thing the dealer does. */
const DEALER_BEAT = 600;
/** Player, dealer, player, dealer: the opening four cards land in turn. */
const DEAL_STAGGER = 120;

const RANK_NAMES: Partial<Record<Card["rank"], string>> = { A: "ace", K: "king", Q: "queen", J: "jack" };

const OUTCOME_LABEL: Record<Outcome, string> = {
  blackjack: "blackjack",
  win: "win",
  push: "push",
  lose: "lose",
  bust: "bust",
};

const chips = (amount: number) => amount.toLocaleString("en-IN");
const signed = (amount: number) => `${amount > 0 ? "+" : "−"}${chips(Math.abs(amount))}`;

/* Drawn rather than typed: ♥ and ♠ as characters turn into emoji on some phones. */
function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      {suit === "hearts" ? (
        <path d="M12 21C6.2 16.6 3 13.3 3 9.5 3 6.9 5 5 7.5 5 9.3 5 11 6 12 7.6 13 6 14.7 5 16.5 5 19 5 21 6.9 21 9.5c0 3.8-3.2 7.1-9 11.5z" />
      ) : suit === "diamonds" ? (
        <path d="M12 2.5 19.5 12 12 21.5 4.5 12z" />
      ) : suit === "spades" ? (
        <path d="M12 3C6.2 7.4 3 10.7 3 14.5 3 17 5 19 7.5 19c1.5 0 2.9-.7 3.8-1.8-.2 1.6-.9 3-2.1 4.3h5.6c-1.2-1.3-1.9-2.7-2.1-4.3.9 1.1 2.3 1.8 3.8 1.8 2.5 0 4.5-2 4.5-4.5C21 10.7 17.8 7.4 12 3z" />
      ) : (
        <>
          <circle cx="12" cy="7.8" r="4.2" />
          <circle cx="7.3" cy="13.8" r="4.2" />
          <circle cx="16.7" cy="13.8" r="4.2" />
          <circle cx="12" cy="12.5" r="2.2" />
          <path d="M12 13c0 3.4-.8 6-2.4 8.5h4.8C12.8 19 12 16.4 12 13z" />
        </>
      )}
    </svg>
  );
}

function PlayingCard({
  card,
  hidden = false,
  flip = false,
  delay = 0,
}: {
  card: Card;
  hidden?: boolean;
  /** Turned over in place rather than dealt. */
  flip?: boolean;
  delay?: number;
}) {
  const style = { "--deal-delay": `${delay}ms` } as CSSProperties;

  if (hidden) {
    return <div role="img" aria-label="face-down card" className="bj-card bj-card-back" style={style} />;
  }

  const red = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div
      role="img"
      aria-label={`${RANK_NAMES[card.rank] ?? card.rank} of ${card.suit}`}
      className={`bj-card${red ? " bj-red" : ""}${flip ? " bj-flip" : ""}`}
      style={style}
    >
      <span className="bj-index">
        {card.rank}
        <SuitIcon suit={card.suit} className="bj-index-suit" />
      </span>
      <SuitIcon suit={card.suit} className="bj-pip" />
    </div>
  );
}

function EmptySlots() {
  return (
    <>
      <div className="bj-card bj-slot" />
      <div className="bj-card bj-slot" />
    </>
  );
}

function Total({ children }: { children: ReactNode }) {
  return <span className="tag px-2 py-1 tabular-nums">{children}</span>;
}

function describeTotal(cards: Card[]) {
  const { total: value, soft } = total(cards);
  if (value > 21) return `${value} · bust`;
  return soft && value < 21 ? `soft ${value}` : String(value);
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="hidden text-[10px] font-normal opacity-60 md:inline">{children}</kbd>;
}

/** The line across the middle of the table once a round is over. */
function verdict(game: Game) {
  if (game.phase !== "bet" || game.net === null) return null;

  const { net, hands } = game;
  const dealerNatural = game.dealer.length === 2 && total(game.dealer).total === 21;
  let words: [string, string];

  if (hands[0].outcome === "blackjack") words = ["Black", "jack."];
  else if (dealerNatural) words = ["Dealer has ", "blackjack."];
  else if (net > 0) words = ["You ", "win."];
  else if (net === 0) words = ["It's a ", "push."];
  else if (hands.every(hand => hand.outcome === "bust")) words = ["You ", "bust."];
  else words = ["Dealer ", "wins."];

  const amount = net !== 0 ? signed(net) : game.insurance > 0 ? "insurance covered it" : "bet returned";
  return { words, amount, net };
}

function handResult(hand: Hand) {
  if (!hand.outcome) return null;

  const won = hand.outcome === "blackjack" ? hand.bet * 1.5 : hand.outcome === "win" ? hand.bet : 0;
  const lost = hand.outcome === "lose" || hand.outcome === "bust";
  const tone = won ? "text-accent" : lost ? "text-err" : "text-dim";
  const amount = won ? ` ${signed(won)}` : lost ? ` ${signed(-hand.bet)}` : "";

  return (
    <span className={tone}>
      {OUTCOME_LABEL[hand.outcome]}
      {amount}
    </span>
  );
}

/**
 * A blackjack table on pretend chips. The rules and every state change are in
 * lib/blackjack.ts; this draws the table, paces the dealer and keeps the
 * balance between visits.
 */
export default function Blackjack() {
  const [game, dispatch] = useReducer(reduce, undefined, newGame);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const balance = stored === null ? NaN : Number(stored);
      if (Number.isFinite(balance) && balance >= 0) dispatch({ type: "restore", balance });
    } catch {
      // No storage: every visit starts on a fresh buy-in.
    }
    setRestored(true);
  }, []);

  // Saved between rounds only, so leaving mid-hand hands the bet back.
  useEffect(() => {
    if (!restored || game.phase !== "bet") return;
    try {
      localStorage.setItem(STORAGE_KEY, String(game.balance));
    } catch {
      // Nothing to do; the game plays on.
    }
  }, [restored, game.phase, game.balance]);

  // One step per beat: turn the hole card, draw, draw, settle.
  useEffect(() => {
    if (game.phase !== "dealer") return;
    const timer = setTimeout(() => dispatch({ type: "dealer" }), DEALER_BEAT);
    return () => clearTimeout(timer);
  }, [game]);

  const broke = game.phase === "bet" && game.balance < MIN_BET;
  const canDeal = game.phase === "bet" && game.bet >= MIN_BET && game.bet <= game.balance;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      // The "do you write code?" prompt is up and owns the page.
      if (document.documentElement.dataset.audience === "unset") return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable], [role=dialog]")) return;

      const key = event.key.toLowerCase();

      if (key === "enter" || key === " ") {
        // On a focused button these already click it.
        if (target?.closest("button, a") || !canDeal) return;
        event.preventDefault();
        dispatch({ type: "deal", shoe: needsShuffle(game.shoe) ? freshShoe() : null });
      } else if (game.phase === "insurance" && (key === "y" || key === "n")) {
        dispatch({ type: "insurance", take: key === "y" });
      } else if (game.phase === "player") {
        const move = ({ h: "hit", s: "stand", d: "double", p: "split" } as const)[key];
        if (move) dispatch({ type: move });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, canDeal]);

  const result = verdict(game);
  const acting = game.phase === "player";
  const multi = game.hands.length > 1;
  const dealerShown = game.holeHidden ? game.dealer.slice(0, 1) : game.dealer;
  const dealerTotal =
    game.dealer.length === 0
      ? null
      : game.holeHidden
        ? String(cardValue(game.dealer[0].rank))
        : describeTotal(game.dealer);

  const hint =
    game.phase === "insurance"
      ? "dealer shows an ace"
      : game.phase === "dealer"
        ? "dealer's turn"
        : acting
          ? multi
            ? `hand ${game.active + 1} of ${game.hands.length} — your move`
            : "your move"
          : broke
            ? "out of chips"
            : "place a bet, then deal";

  const spoken = result
    ? `${result.words.join("")} Dealer ${describeTotal(game.dealer)}, you ${game.hands
        .map(hand => describeTotal(hand.cards))
        .join(" and ")}. ${result.amount}.`
    : game.phase === "insurance"
      ? "Dealer shows an ace. Insurance?"
      : acting
        ? `You have ${describeTotal(game.hands[game.active].cards)}${
            multi ? ` on hand ${game.active + 1}` : ""
          }. Dealer shows ${dealerTotal}.`
        : "";

  return (
    // From xl the heading, chips and rules stand beside the table, so a whole
    // round fits on a laptop screen without scrolling.
    <section
      aria-label="Blackjack"
      className="flex flex-col gap-5 md:gap-8 xl:grid xl:grid-cols-[300px_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:items-start xl:gap-x-14 xl:gap-y-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-6 xl:flex-col xl:items-start xl:gap-10">
        <div className="flex flex-col gap-3.5">
          <Reveal>
            <p className="text-xs text-dim">
              <Variant
                dev={
                  <>
                    <span className="text-accent">$</span> python blackjack.py
                  </>
                }
                plain={
                  <>
                    <span className="text-accent">●</span> a quick game
                  </>
                }
              />
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-[clamp(2.4rem,8vw,4.5rem)] font-normal leading-none tracking-[-0.02em]">
              Black<span className="italic text-accent">jack.</span>
            </h1>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <div className="flex flex-col items-end gap-1.5 xl:items-start">
            <p className="text-[10px] text-dim">chips · pretend ones</p>
            <p
              data-testid="balance"
              className="font-display text-[clamp(2.25rem,6vw,3.25rem)] leading-none tabular-nums"
            >
              {chips(game.balance)}
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={180} className="xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <div className="panel bj shadow-[var(--shadow)]">
          <div className="panel-bar">
            <span>blackjack pays 3:2</span>
            <span className="hidden sm:inline">dealer stands on 17</span>
            <span className="tabular-nums">
              {DECKS} decks{game.shoe.length > 0 ? ` · ${game.shoe.length} left` : ""}
            </span>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4 md:gap-5 md:px-8 md:py-6">
            <div className="flex flex-col gap-2.5 md:gap-3">
              <p className="flex h-5 items-center md:h-6 gap-2.5 text-[11px] text-dim">
                dealer {dealerTotal ? <Total>{dealerTotal}</Total> : null}
              </p>
              <div className="flex" data-testid="dealer">
                {game.dealer.length === 0 ? <EmptySlots /> : null}
                {game.dealer.map((card, index) => {
                  const hidden = index === 1 && game.holeHidden;
                  // Re-keyed when it turns over, so the face arrives with the flip.
                  return (
                    <PlayingCard
                      key={hidden ? `${card.id}-down` : card.id}
                      card={card}
                      hidden={hidden}
                      flip={index === 1 && !hidden}
                      delay={index < 2 ? DEAL_STAGGER * (index * 2 + 1) : 0}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-y border-line-soft py-2 md:min-h-[52px]">
              {result ? (
                <>
                  <p data-testid="verdict" className="font-display text-[clamp(1.6rem,5vw,2.25rem)] leading-none">
                    {result.words[0]}
                    <span className="italic text-accent">{result.words[1]}</span>
                  </p>
                  <p
                    data-testid="net"
                    className={`text-sm tabular-nums ${
                      result.net > 0 ? "text-accent" : result.net < 0 ? "text-err" : "text-dim"
                    }`}
                  >
                    {result.amount}
                  </p>
                </>
              ) : (
                <p className="text-xs text-dim">{hint}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-5" data-testid="player">
              {game.hands.length === 0 ? (
                <div className="flex flex-col gap-2.5 md:gap-3">
                  <p className="flex h-5 items-center md:h-6 text-[11px] text-dim">you</p>
                  <div className="flex">
                    <EmptySlots />
                  </div>
                  <p className="text-[11px] text-faint">&nbsp;</p>
                </div>
              ) : null}

              {game.hands.map((hand, index) => {
                const waiting = acting && multi && index !== game.active;

                return (
                  <div
                    key={index}
                    className={`flex flex-col gap-2.5 md:gap-3 transition-opacity duration-300 ${waiting ? "opacity-45" : ""}`}
                  >
                    <p className="flex h-5 items-center md:h-6 gap-2.5 text-[11px] text-dim">
                      {multi ? (
                        <span className={acting && index === game.active ? "text-accent" : undefined}>
                          hand {index + 1}
                        </span>
                      ) : (
                        "you"
                      )}
                      <Total>{describeTotal(hand.cards)}</Total>
                    </p>
                    <div className="flex">
                      {hand.cards.map((card, position) => (
                        <PlayingCard
                          key={card.id}
                          card={card}
                          delay={!hand.split && position < 2 ? DEAL_STAGGER * position * 2 : 0}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] tabular-nums text-faint">
                      {handResult(hand) ?? `bet ${chips(hand.bet)}`}
                      {hasBlackjack(hand) && !hand.outcome ? " · blackjack" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A fixed floor, so the table keeps its height from bet to play to
              result and a round on a phone needs no scrolling. */}
          <div className="flex min-h-[140px] items-center border-t border-rule px-5 py-4 md:min-h-[92px] md:px-8">
            {game.phase === "insurance" ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:gap-4">
                <p className="max-w-[420px] text-xs leading-relaxed text-dim">
                  Insurance costs <span className="text-ink">{chips(insuranceCost(game))}</span> and pays 2:1 if
                  the dealer has blackjack.
                </p>
                <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "insurance", take: true })}
                    data-cursor-label="insure"
                    className="btn btn-ghost"
                  >
                    insure <Key>Y</Key>
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "insurance", take: false })}
                    data-cursor-label="skip"
                    className="btn btn-primary"
                  >
                    no thanks <Key>N</Key>
                  </button>
                </div>
              </div>
            ) : game.phase !== "bet" ? (
              <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:gap-2.5">
                <button
                  type="button"
                  disabled={!acting}
                  onClick={() => dispatch({ type: "hit" })}
                  data-cursor-label="hit"
                  className="btn btn-primary px-0 sm:px-[26px]"
                >
                  hit <Key>H</Key>
                </button>
                <button
                  type="button"
                  disabled={!acting}
                  onClick={() => dispatch({ type: "stand" })}
                  data-cursor-label="stand"
                  className="btn btn-ghost px-0 sm:px-[26px]"
                >
                  stand <Key>S</Key>
                </button>
                <button
                  type="button"
                  disabled={!canDouble(game)}
                  onClick={() => dispatch({ type: "double" })}
                  data-cursor-label="double"
                  className="btn btn-ghost px-0 sm:px-[26px]"
                >
                  double <Key>D</Key>
                </button>
                <button
                  type="button"
                  disabled={!canSplit(game)}
                  onClick={() => dispatch({ type: "split" })}
                  data-cursor-label="split"
                  className="btn btn-ghost px-0 sm:px-[26px]"
                >
                  split <Key>P</Key>
                </button>
              </div>
            ) : broke ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-4">
                <p className="text-xs leading-relaxed text-dim">
                  That&apos;s the lot. The house will spot you another {chips(BUY_IN)}.
                </p>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "rebuy" })}
                  data-cursor-label="rebuy"
                  className="btn btn-primary w-full sm:w-auto"
                >
                  take {chips(BUY_IN)} more
                </button>
              </div>
            ) : (
              <div className="grid w-full grid-cols-[1fr_auto] items-center gap-x-7 gap-y-4 sm:flex sm:flex-wrap">
                <div className="flex min-w-[72px] flex-col gap-1">
                  <span className="text-[10px] text-dim">bet</span>
                  <span data-testid="bet" className="text-lg tabular-nums">
                    {chips(game.bet)}
                  </span>
                </div>

                <div className="col-span-2 row-start-2 flex gap-1.5 sm:gap-2">
                  {CHIPS.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      disabled={game.bet + amount > game.balance}
                      onClick={() => dispatch({ type: "chip", amount })}
                      aria-label={`add ${amount} to the bet`}
                      data-cursor-label="bet"
                      className="chip h-10 flex-1 px-0 tabular-nums sm:h-[30px] sm:flex-none sm:px-3"
                    >
                      +{amount}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={game.bet === 0}
                    onClick={() => dispatch({ type: "clear" })}
                    data-cursor-label="clear"
                    className="chip h-10 flex-1 px-0 sm:h-[30px] sm:flex-none sm:px-3"
                  >
                    clear
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!canDeal}
                  onClick={() => dispatch({ type: "deal", shoe: needsShuffle(game.shoe) ? freshShoe() : null })}
                  data-cursor-label="deal"
                  className="btn btn-primary col-start-2 row-start-1 sm:ml-auto"
                >
                  {game.net === null ? "deal" : "deal again"} <span aria-hidden className="nudge">→</span>
                </button>
              </div>
            )}
          </div>

          <p aria-live="polite" className="sr-only">
            {spoken}
          </p>
        </div>
      </Reveal>

      <Reveal delay={240}>
        <div className="flex flex-col gap-2 text-[11px] leading-relaxed text-faint">
          <p>
            {DECKS} decks · dealer stands on every 17 · blackjack pays 3:2 · double on any two cards · split up
            to four hands · insurance pays 2:1. The chips are pretend — nothing here is real money.
          </p>
          <p className="hidden md:block">
            keys: <span className="text-dim">enter</span> deal · <span className="text-dim">H</span> hit ·{" "}
            <span className="text-dim">S</span> stand · <span className="text-dim">D</span> double ·{" "}
            <span className="text-dim">P</span> split
          </p>
        </div>
      </Reveal>
    </section>
  );
}
