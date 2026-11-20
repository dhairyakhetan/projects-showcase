"""
Blackjack rules engine.

Pure game logic - no UI code lives here.  A round of blackjack is modelled as a
Python generator (Round.play) that *yields* two kinds of objects:

    Ev(...)   - something happened (a card was dealt, a hand busted, ...).
                The UI animates it and then resumes the generator.
    Ask(...)  - the engine needs a decision (hit/stand/..., insurance yes/no).
                The UI (or a bot) sends the answer back with gen.send(answer).

Because the whole round is one generator, the exact same rules code drives the
real game, the demo/autoplay mode, the scripted "situations" and the headless
auto-finish used when you quit in the middle of a hand.

All money is stored in integer *cents* so 3:2 payouts and half-bet surrenders
never suffer from floating point rounding.
"""
from __future__ import annotations

import random

RANKS = ('A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K')
SUITS = ('S', 'H', 'D', 'C')
SUIT_SYMBOLS = {'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣'}
SUIT_NAMES = {'S': 'Spades', 'H': 'Hearts', 'D': 'Diamonds', 'C': 'Clubs'}
RANK_NAMES = {'A': 'Ace', 'J': 'Jack', 'Q': 'Queen', 'K': 'King'}
ACTIONS = ('hit', 'stand', 'double', 'split', 'surrender')


# --------------------------------------------------------------------------- cards
class Card:
    __slots__ = ('rank', 'suit')

    def __init__(self, rank: str, suit: str):
        if rank == 'T':
            rank = '10'
        if rank not in RANKS or suit not in SUITS:
            raise ValueError(f'bad card {rank}{suit}')
        self.rank = rank
        self.suit = suit

    @classmethod
    def parse(cls, code: str) -> 'Card':
        code = code.strip().upper()
        return cls(code[:-1], code[-1])

    @property
    def value(self) -> int:
        """Blackjack value with the Ace counted as 1 (soft totals handled elsewhere)."""
        if self.rank == 'A':
            return 1
        if self.rank in ('J', 'Q', 'K'):
            return 10
        return int(self.rank)

    @property
    def is_ace(self) -> bool:
        return self.rank == 'A'

    @property
    def is_ten(self) -> bool:
        return self.value == 10

    @property
    def hilo(self) -> int:
        """Hi-Lo card counting tag."""
        v = self.value
        if 2 <= v <= 6:
            return 1
        if v == 10 or v == 1:
            return -1
        return 0

    @property
    def code(self) -> str:
        return self.rank + self.suit

    @property
    def label(self) -> str:
        return self.rank + SUIT_SYMBOLS[self.suit]

    @property
    def name(self) -> str:
        return f"{RANK_NAMES.get(self.rank, self.rank)} of {SUIT_NAMES[self.suit]}"

    def __eq__(self, other):
        return isinstance(other, Card) and other.rank == self.rank and other.suit == self.suit

    def __hash__(self):
        return hash((self.rank, self.suit))

    def __repr__(self):
        return f'Card({self.code})'


def cards(*codes) -> list:
    """cards('AS', 'KH') -> [Card, Card]  (handy for scenarios and tests)"""
    out = []
    for c in codes:
        out.extend(Card.parse(x) for x in c.split()) if ' ' in c else out.append(Card.parse(c))
    return out


def hand_total(cs) -> tuple:
    """Return (best_total, is_soft)."""
    hard = 0
    ace = False
    for c in cs:
        hard += c.value
        if c.rank == 'A':
            ace = True
    if ace and hard + 10 <= 21:
        return hard + 10, True
    return hard, False


def total_text(cs) -> str:
    """'7 / 17' for soft hands, '16' for hard ones."""
    t, soft = hand_total(cs)
    if soft and t != 21:
        return f'{t - 10} / {t}'
    return str(t)


# --------------------------------------------------------------------------- money
def fmt_money(cents: int, plus: bool = False) -> str:
    neg = cents < 0
    cents = abs(int(cents))
    dollars, rem = divmod(cents, 100)
    s = f'${dollars:,}'
    if rem:
        s += f'.{rem:02d}'
    if neg:
        return '−' + s
    if plus and cents > 0:
        return '+' + s
    return s


def fmt_chip(cents: int) -> str:
    d = cents // 100
    if d >= 1000 and d % 1000 == 0:
        return f'{d // 1000}K'
    return str(d)


# --------------------------------------------------------------------------- rules
class Rules:
    """Table rules.  Everything that changes how the game plays lives here."""

    FIELDS = {
        'decks': 6,              # 1, 2, 4, 6, 8
        'h17': False,            # dealer hits soft 17
        'bj_num': 3,             # blackjack pays bj_num : bj_den
        'bj_den': 2,
        'peek': True,            # US hole card + peek; False = European no-hole-card
        'double_on': 'any',      # 'any' | '9-11' | '10-11'
        'das': True,             # double after split
        'max_hands': 4,          # split up to this many hands
        'resplit_aces': False,
        'hit_split_aces': False,
        'split_by_value': True,  # any two 10-value cards (K+Q) count as a pair
        'surrender': True,       # late surrender
        'insurance': True,
        'penetration': 0.75,     # fraction of the shoe dealt before reshuffling
        'min_bet': 1000,         # cents
        'max_bet': 100000,       # cents
    }

    def __init__(self, **kw):
        for k, v in self.FIELDS.items():
            setattr(self, k, v)
        for k, v in kw.items():
            if k in self.FIELDS:
                setattr(self, k, v)
        self.validate()

    def validate(self):
        self.decks = int(self.decks) if int(self.decks) in (1, 2, 4, 6, 8) else 6
        self.max_hands = min(4, max(2, int(self.max_hands)))
        if self.double_on not in ('any', '9-11', '10-11'):
            self.double_on = 'any'
        if (self.bj_num, self.bj_den) not in ((3, 2), (6, 5), (2, 1), (7, 5)):
            self.bj_num, self.bj_den = 3, 2
        self.penetration = min(0.9, max(0.4, float(self.penetration)))
        self.min_bet = max(100, int(self.min_bet))
        self.max_bet = max(self.min_bet, int(self.max_bet))
        for b in ('h17', 'peek', 'das', 'resplit_aces', 'hit_split_aces', 'split_by_value',
                  'surrender', 'insurance'):
            setattr(self, b, bool(getattr(self, b)))
        return self

    @property
    def surrender_allowed(self) -> bool:
        # Late surrender only makes sense when the dealer has already checked for blackjack.
        return self.surrender and self.peek

    def copy(self, **kw) -> 'Rules':
        d = self.to_dict()
        d.update(kw)
        return Rules(**d)

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in self.FIELDS}

    @classmethod
    def from_dict(cls, d) -> 'Rules':
        try:
            return cls(**{k: v for k, v in (d or {}).items() if k in cls.FIELDS})
        except Exception:
            return cls()

    def payout_text(self) -> str:
        return f'{self.bj_num} to {self.bj_den}'

    def short(self) -> str:
        parts = [f"{self.decks} DECK{'S' if self.decks > 1 else ''}",
                 'H17' if self.h17 else 'S17',
                 f'BJ {self.bj_num}:{self.bj_den}']
        if not self.peek:
            parts.append('NO HOLE CARD')
        if self.double_on != 'any':
            parts.append(f'DOUBLE {self.double_on}')
        parts.append('DAS' if self.das else 'NO DAS')
        if self.surrender_allowed:
            parts.append('SURRENDER')
        return '  ·  '.join(parts)

    def double_total_ok(self, total: int) -> bool:
        if self.double_on == '9-11':
            return 9 <= total <= 11
        if self.double_on == '10-11':
            return 10 <= total <= 11
        return True

    def __eq__(self, other):
        return isinstance(other, Rules) and self.to_dict() == other.to_dict()


# --------------------------------------------------------------------------- shoe
class Shoe:
    """A shoe of N decks with a cut card.

    `stack` holds cards that will be dealt next, in order (used by the
    scripted situations and by tests).
    """

    def __init__(self, decks: int = 6, penetration: float = 0.75, rng=None):
        self.rng = rng or random.Random()
        self.decks = decks
        self.penetration = penetration
        self.stack = []
        self.cards = []
        self.dealt = 0
        self.cut_at = 0
        self.shuffles = 0
        self.emergency = False
        self.shuffle()

    @property
    def size(self) -> int:
        return self.decks * 52

    def shuffle(self, exclude=()):
        deck = [Card(r, s) for _ in range(self.decks) for s in SUITS for r in RANKS]
        for c in exclude:
            try:
                deck.remove(c)
            except ValueError:
                pass
        self.rng.shuffle(deck)
        self.cards = deck
        self.dealt = 0
        self.cut_at = max(1, int(self.size * self.penetration))
        self.shuffles += 1

    def draw(self, in_play=()) -> Card:
        if self.stack:
            return self.stack.pop(0)
        if not self.cards:
            # Ran out mid-round (deep penetration + lots of splits): reshuffle
            # everything that is not on the table right now.
            self.shuffle(exclude=in_play)
            self.emergency = True
            self.cut_at = 0           # force a full reshuffle after this round
        self.dealt += 1
        return self.cards.pop()

    def burn(self) -> Card:
        """Burn the top card after a shuffle (never takes a stacked card)."""
        if not self.cards:
            self.shuffle()
        self.dealt += 1
        return self.cards.pop()

    @property
    def needs_shuffle(self) -> bool:
        return self.dealt >= self.cut_at

    @property
    def remaining(self) -> int:
        return len(self.cards)

    @property
    def decks_remaining(self) -> float:
        return max(0.25, len(self.cards) / 52.0)

    @property
    def fraction_left(self) -> float:
        return len(self.cards) / float(self.size)


# --------------------------------------------------------------------------- wallet
class Wallet:
    def __init__(self, balance: int):
        self.balance = int(balance)

    def debit(self, amount: int):
        amount = int(amount)
        if amount < 0 or amount > self.balance:
            raise ValueError(f'cannot debit {amount} from {self.balance}')
        self.balance -= amount

    def credit(self, amount: int):
        amount = int(amount)
        if amount < 0:
            raise ValueError('negative credit')
        self.balance += amount


# --------------------------------------------------------------------------- events
class Ev:
    """Something happened.  `kind` plus arbitrary keyword data."""
    is_ask = False

    def __init__(self, kind: str, **data):
        self.kind = kind
        self.__dict__.update(data)

    def __repr__(self):
        d = {k: v for k, v in self.__dict__.items() if k != 'kind'}
        return f'Ev({self.kind}, {d})'


class Ask(Ev):
    """The engine needs a decision."""
    is_ask = True

    def __repr__(self):
        d = {k: v for k, v in self.__dict__.items() if k != 'kind'}
        return f'Ask({self.kind}, {d})'


class IllegalAction(Exception):
    pass


# --------------------------------------------------------------------------- hands
class Hand:
    def __init__(self, bet: int):
        self.cards = []
        self.bet = bet            # total wagered on this hand (includes a double)
        self.base_bet = bet
        self.doubled = False
        self.surrendered = False
        self.is_split = False
        self.split_aces = False
        self.done = False
        self.result = None        # 'blackjack','win','push','lose','bust','surrender','even_money'
        self.payout = 0           # amount returned to the player (stake included)
        self.actions = []

    @property
    def total(self) -> int:
        return hand_total(self.cards)[0]

    @property
    def soft(self) -> bool:
        return hand_total(self.cards)[1]

    @property
    def is_bust(self) -> bool:
        return self.total > 21

    @property
    def is_blackjack(self) -> bool:
        return len(self.cards) == 2 and self.total == 21 and not self.is_split

    @property
    def net(self) -> int:
        return self.payout - self.bet

    def __repr__(self):
        return f"Hand({' '.join(c.code for c in self.cards)} bet={self.bet} {self.result or ''})"


ACTION_REASONS = {
    'funds': 'Not enough chips',
    'max_hands': 'Maximum number of hands reached',
    'first_two': 'Only allowed on your first two cards',
    'das': 'This table does not allow doubling after a split',
    'double_on': 'This table only allows doubling on {}',
    'not_pair': 'You need two cards of the same rank',
    'split_aces': 'Split Aces receive only one card each',
    'resplit_aces': 'This table does not allow re-splitting Aces',
    'no_surrender': 'Surrender is not offered at this table',
    'surrender_first': 'Surrender is only allowed as your first decision',
    'surrender_split': 'You cannot surrender after splitting',
    'doubled': 'You already doubled this hand',
    'twentyone': 'You already have 21',
}


# --------------------------------------------------------------------------- round
class Round:
    """One round of blackjack.  Drive it with `play()` (a generator)."""

    def __init__(self, rules: Rules, shoe: Shoe, wallet: Wallet, bet: int):
        if bet <= 0 or bet > wallet.balance:
            raise ValueError('invalid bet')
        self.rules = rules
        self.shoe = shoe
        self.wallet = wallet
        self.initial_bet = bet
        self.hands = [Hand(bet)]
        self.dealer = []
        self.hole_revealed = False
        self.insurance = 0
        self.insurance_payout = 0
        self.insurance_offered = False
        self.even_money_offered = False
        self.even_money = False
        self.dealer_blackjack = False
        self.current = 0
        self.finished = False
        self.balance_before = wallet.balance
        self.wagered = 0          # total money put at risk this round
        self.returned = 0         # total paid back
        self.log = []

    # ------------------------------------------------------------ helpers
    def in_play(self):
        out = list(self.dealer)
        for h in self.hands:
            out.extend(h.cards)
        return out

    def _draw(self):
        shuffles = self.shoe.shuffles
        c = self.shoe.draw(self.in_play())
        return c, self.shoe.shuffles != shuffles

    def _deal_hand(self, i: int, rotated: bool = False):
        c, reshuffled = self._draw()
        if reshuffled:
            yield Ev('shuffle', emergency=True)
        self.hands[i].cards.append(c)
        yield Ev('deal', to='player', hand=i, card=c, index=len(self.hands[i].cards) - 1,
                 face_up=True, rotated=rotated)

    def _deal_dealer(self, face_up: bool):
        c, reshuffled = self._draw()
        if reshuffled:
            yield Ev('shuffle', emergency=True)
        self.dealer.append(c)
        yield Ev('deal', to='dealer', card=c, index=len(self.dealer) - 1, face_up=face_up,
                 rotated=False)

    def _bet(self, amount: int):
        self.wallet.debit(amount)
        self.wagered += amount

    def _pay(self, amount: int):
        if amount > 0:
            self.wallet.credit(amount)
            self.returned += amount

    @property
    def dealer_total(self) -> int:
        return hand_total(self.dealer)[0]

    @property
    def dealer_visible_cards(self):
        if self.hole_revealed or not self.rules.peek:
            return list(self.dealer)
        return self.dealer[:1]

    def is_pair(self, h: Hand) -> bool:
        if len(h.cards) != 2:
            return False
        a, b = h.cards
        if a.rank == b.rank:
            return True
        return self.rules.split_by_value and a.is_ten and b.is_ten

    def action_status(self, i: int = None) -> dict:
        """{action: (allowed, reason_or_None)} for the given hand."""
        if i is None:
            i = self.current
        h = self.hands[i]
        r = self.rules
        n = len(h.cards)
        total = h.total
        bal = self.wallet.balance
        st = {}
        st['stand'] = (True, None)
        # --- hit
        if h.split_aces and not r.hit_split_aces:
            st['hit'] = (False, ACTION_REASONS['split_aces'])
        elif total >= 21:
            st['hit'] = (False, ACTION_REASONS['twentyone'])
        else:
            st['hit'] = (True, None)
        # --- double
        if n != 2:
            st['double'] = (False, ACTION_REASONS['first_two'])
        elif h.doubled:
            st['double'] = (False, ACTION_REASONS['doubled'])
        elif h.split_aces:
            st['double'] = (False, ACTION_REASONS['split_aces'])
        elif h.is_split and not r.das:
            st['double'] = (False, ACTION_REASONS['das'])
        elif not r.double_total_ok(total):
            st['double'] = (False, ACTION_REASONS['double_on'].format(
                'hard 9, 10 or 11' if r.double_on == '9-11' else 'hard 10 or 11'))
        elif bal < h.bet:
            st['double'] = (False, ACTION_REASONS['funds'])
        else:
            st['double'] = (True, None)
        # --- split
        if not self.is_pair(h):
            st['split'] = (False, ACTION_REASONS['not_pair'])
        elif len(self.hands) >= r.max_hands:
            st['split'] = (False, ACTION_REASONS['max_hands'])
        elif h.split_aces and not r.resplit_aces:
            st['split'] = (False, ACTION_REASONS['resplit_aces'])
        elif bal < h.bet:
            st['split'] = (False, ACTION_REASONS['funds'])
        else:
            st['split'] = (True, None)
        # --- surrender
        if not r.surrender_allowed:
            st['surrender'] = (False, ACTION_REASONS['no_surrender'])
        elif h.is_split or len(self.hands) > 1:
            st['surrender'] = (False, ACTION_REASONS['surrender_split'])
        elif n != 2 or h.actions:
            st['surrender'] = (False, ACTION_REASONS['surrender_first'])
        else:
            st['surrender'] = (True, None)
        return st

    def legal_actions(self, i: int = None) -> frozenset:
        return frozenset(a for a, (ok, _) in self.action_status(i).items() if ok)

    def rule_legal_actions(self, i: int = None) -> frozenset:
        """Actions the table rules allow, ignoring whether you can afford them."""
        st = self.action_status(i)
        return frozenset(a for a, (ok, why) in st.items()
                         if ok or why == ACTION_REASONS['funds'])

    # ------------------------------------------------------------ the round
    def play(self):
        r = self.rules
        bet = self.initial_bet
        self._bet(bet)
        yield Ev('bet', amount=bet)

        # --- initial deal: player, dealer up, player, dealer hole (US)
        yield from self._deal_hand(0)
        yield from self._deal_dealer(face_up=True)
        yield from self._deal_hand(0)
        if r.peek:
            yield from self._deal_dealer(face_up=False)
        yield Ev('dealt')

        h0 = self.hands[0]
        up = self.dealer[0]
        player_bj = h0.is_blackjack

        # --- insurance / even money
        if up.is_ace and r.insurance:
            if player_bj:
                self.even_money_offered = True
                take = yield Ask('even_money', amount=h0.bet)
                if take:
                    self.even_money = True
                    h0.result = 'even_money'
                    h0.payout = h0.bet * 2
                    h0.done = True
                    self._pay(h0.payout)
                    yield Ev('even_money', hand=0, payout=h0.payout)
            else:
                cost = h0.bet // 2
                self.insurance_offered = True
                take = yield Ask('insurance', cost=cost, can_afford=self.wallet.balance >= cost)
                if take and self.wallet.balance >= cost and cost > 0:
                    self._bet(cost)
                    self.insurance = cost
                    yield Ev('insurance', amount=cost)

        # --- dealer peek (US rules) with an Ace or 10 showing
        if r.peek and (up.is_ace or up.is_ten):
            self.dealer_blackjack = hand_total(self.dealer)[0] == 21
            yield Ev('peek', dealer_blackjack=self.dealer_blackjack)
            if self.dealer_blackjack:
                self.hole_revealed = True
                yield Ev('reveal', card=self.dealer[1])
                yield Ev('dealer_blackjack')
                yield from self._settle()
                return
            if self.insurance:
                yield Ev('insurance_lost', amount=self.insurance)

        if self.even_money:
            # Paid already; just show the hole card and finish.
            yield from self._dealer_turn()
            yield from self._settle()
            return

        # --- player blackjack
        if player_bj:
            h0.done = True
            if r.peek or not (up.is_ace or up.is_ten):
                bj_pay = h0.bet + h0.bet * r.bj_num // r.bj_den
                h0.result = 'blackjack'
                h0.payout = bj_pay
                self._pay(bj_pay)
                yield Ev('blackjack', hand=0, payout=bj_pay)
            else:
                # European rules: a dealer Ace/10 could still make blackjack.
                yield Ev('blackjack_pending', hand=0)

        # --- player's turn(s)
        i = 0
        while i < len(self.hands):
            h = self.hands[i]
            self.current = i
            if not h.done:
                if len(h.cards) < 2:
                    yield from self._deal_hand(i)
                yield from self._play_hand(i)
            i += 1
        self.current = len(self.hands) - 1

        yield from self._dealer_turn()
        yield from self._settle()

    def _play_hand(self, i: int):
        h = self.hands[i]
        yield Ev('turn', hand=i)
        while not h.done:
            if h.is_bust:
                h.done = True
                yield Ev('bust', hand=i)
                break
            if h.total == 21:
                h.done = True
                yield Ev('stand', hand=i, auto=True, reason='21')
                break
            legal = self.legal_actions(i)
            if legal == {'stand'}:
                h.done = True
                yield Ev('stand', hand=i, auto=True,
                         reason='split_aces' if h.split_aces else 'only')
                break
            action = yield Ask('action', hand=i, legal=legal)
            if action not in legal:
                raise IllegalAction(f'{action!r} not legal (legal: {sorted(legal)})')
            h.actions.append(action)
            if action == 'stand':
                h.done = True
                yield Ev('stand', hand=i, auto=False, reason='player')
            elif action == 'hit':
                yield Ev('hit', hand=i)
                yield from self._deal_hand(i)
            elif action == 'double':
                extra = h.bet
                self._bet(extra)
                h.bet += extra
                h.doubled = True
                yield Ev('double', hand=i, amount=extra)
                yield from self._deal_hand(i, rotated=True)
                h.done = True
                if h.is_bust:
                    yield Ev('bust', hand=i)
                else:
                    yield Ev('stand', hand=i, auto=True, reason='double')
            elif action == 'split':
                amount = h.bet
                self._bet(amount)
                moved = h.cards.pop()
                nh = Hand(amount)
                nh.cards.append(moved)
                nh.is_split = True
                h.is_split = True
                if moved.is_ace:
                    nh.split_aces = True
                    h.split_aces = True
                self.hands.insert(i + 1, nh)
                yield Ev('split', hand=i, new_hand=i + 1, amount=amount, card=moved)
                yield from self._deal_hand(i)
            elif action == 'surrender':
                h.surrendered = True
                h.done = True
                yield Ev('surrender', hand=i)

    def _needs_dealer_draw(self) -> bool:
        for h in self.hands:
            if h.result is None and not h.surrendered and not h.is_bust and not h.is_blackjack:
                return True
        return False

    def _dealer_turn(self):
        r = self.rules
        yield Ev('dealer_turn')
        if r.peek:
            if not self.hole_revealed:
                self.hole_revealed = True
                yield Ev('reveal', card=self.dealer[1])
        else:
            # No hole card: the dealer's second card is dealt now.
            yield from self._deal_dealer(face_up=True)
            self.hole_revealed = True
            if hand_total(self.dealer)[0] == 21:
                self.dealer_blackjack = True
                yield Ev('dealer_blackjack')
        if not self.dealer_blackjack and self._needs_dealer_draw():
            while True:
                t, soft = hand_total(self.dealer)
                if t < 17 or (t == 17 and soft and r.h17):
                    yield from self._deal_dealer(face_up=True)
                else:
                    break
        t = self.dealer_total
        yield Ev('dealer_done', total=t, bust=t > 21, blackjack=self.dealer_blackjack)

    def _settle(self):
        r = self.rules
        dt = self.dealer_total
        dbust = dt > 21
        dbj = self.dealer_blackjack
        results = []
        for i, h in enumerate(self.hands):
            if h.result is None:
                if h.surrendered:
                    h.result, h.payout = 'surrender', h.bet // 2
                elif h.is_bust:
                    h.result, h.payout = 'bust', 0
                elif h.is_blackjack:
                    if dbj:
                        h.result, h.payout = 'push', h.bet
                    else:
                        h.result, h.payout = 'blackjack', h.bet + h.bet * r.bj_num // r.bj_den
                elif dbj:
                    h.result, h.payout = 'lose', 0
                elif dbust or h.total > dt:
                    h.result, h.payout = 'win', h.bet * 2
                elif h.total == dt:
                    h.result, h.payout = 'push', h.bet
                else:
                    h.result, h.payout = 'lose', 0
                self._pay(h.payout)
            results.append((i, h.result, h.bet, h.payout))
        if self.insurance:
            if dbj:
                self.insurance_payout = self.insurance * 3
                self._pay(self.insurance_payout)
        self.finished = True
        yield Ev('settle', results=results, insurance=self.insurance,
                 insurance_payout=self.insurance_payout, net=self.net)

    @property
    def net(self) -> int:
        return self.returned - self.wagered


def run_headless(gen, decide, first_send=None, max_steps=10000):
    """Drive a round generator to completion with a decision function.

    decide(ask) -> answer.  Returns the list of events seen.
    `first_send` is the value to send first (use when resuming a generator
    that is currently paused on an Ask).
    """
    seen = []
    send = first_send
    for _ in range(max_steps):
        try:
            item = gen.send(send)
        except StopIteration:
            return seen
        seen.append(item)
        send = decide(item) if item.is_ask else None
    raise RuntimeError('round did not finish')


def default_chip_breakdown(amount: int, denoms=(500000, 100000, 50000, 10000, 2500, 500, 100, 50)):
    """Split an amount (cents) into chip denominations, biggest first."""
    out = []
    rest = int(amount)
    for d in denoms:
        while rest >= d:
            out.append(d)
            rest -= d
    if rest > 0:
        out.append(rest)   # odd cents (e.g. after a 3:2 payout on an odd bet)
    return out
