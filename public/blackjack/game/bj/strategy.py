"""
Basic strategy, computed (not memorised).

For any table rules this module works out the expected value (EV) of every
option - stand, hit, double, split, surrender - using an infinite-deck model
(every card has the usual 1/13 chance, 10-value cards 4/13).  The best option is
"basic strategy".  For the standard 4-8 deck games this reproduces the
well-known published charts exactly (see tests), and because it is computed it
also adapts to H17, no-DAS, doubling restrictions and European no-hole-card
rules automatically.

EVs are "per 1 unit bet": +0.10 means you win 10 cents per dollar on average.
"""
from __future__ import annotations

from .engine import hand_total

BASE_P = [0.0] + [1.0 / 13] * 9 + [4.0 / 13]     # index 1..10 (1 = Ace)
ORDER = ('stand', 'hit', 'double', 'split', 'surrender')
UPCARDS = (2, 3, 4, 5, 6, 7, 8, 9, 10, 1)


def _best(hard: int, ace: bool) -> int:
    return hard + 10 if ace and hard + 10 <= 21 else hard


class _Model:
    """EV calculator for one known starting situation.

    The cards you can already see (your two cards and the dealer's upcard) are
    removed from a shoe of `decks` decks; every later card is then drawn with
    those adjusted probabilities.  This "first-order card removal" model is
    what makes the computed strategy agree with published 4-8 deck charts.
    """

    def __init__(self, rules, decks, removed):
        self.r = rules
        if decks:
            comp = [0] + [4 * decks] * 9 + [16 * decks]
            for c in removed:
                comp[c] = max(0, comp[c] - 1)
            tot = float(sum(comp))
            self.P = [x / tot for x in comp]
        else:
            self.P = BASE_P
        self._dist = {}
        self._hit = {}
        self._split = {}

    def dealer_dist(self, up: int) -> dict:
        if up in self._dist:
            return self._dist[up]
        P, h17, peek = self.P, self.r.h17, self.r.peek
        memo = {}

        def finish(hard, ace):
            key = (hard, ace)
            if key in memo:
                return memo[key]
            best = _best(hard, ace)
            soft = ace and hard + 10 <= 21
            if hard > 21:
                res = {22: 1.0}
            elif best > 17 or (best == 17 and not (soft and h17)):
                res = {best: 1.0}
            else:
                res = {}
                for c in range(1, 11):
                    for k, v in finish(hard + c, ace or c == 1).items():
                        res[k] = res.get(k, 0.0) + P[c] * v
            memo[key] = res
            return res

        dist = {}
        norm = 0.0
        for c in range(1, 11):
            p = P[c]
            if (up == 1 and c == 10) or (up == 10 and c == 1):
                if peek:
                    continue          # we already know the dealer has no blackjack
                dist['bj'] = dist.get('bj', 0.0) + p
                norm += p
                continue
            norm += p
            for k, v in finish(up + c, up == 1 or c == 1).items():
                dist[k] = dist.get(k, 0.0) + p * v
        dist = {k: v / norm for k, v in dist.items()}
        self._dist[up] = dist
        return dist

    def ev_stand(self, total: int, up: int) -> float:
        if total > 21:
            return -1.0
        d = self.dealer_dist(up)
        ev = d.get(22, 0.0) - d.get('bj', 0.0)
        for t in (17, 18, 19, 20, 21):
            p = d.get(t, 0.0)
            if total > t:
                ev += p
            elif total < t:
                ev -= p
        return ev

    def ev_hit(self, hard: int, ace: bool, up: int) -> float:
        key = (hard, ace, up)
        if key in self._hit:
            return self._hit[key]
        ev = 0.0
        for c in range(1, 11):
            nh, na = hard + c, ace or c == 1
            if nh > 21:
                ev -= self.P[c]
                continue
            b = _best(nh, na)
            s = self.ev_stand(b, up)
            if b < 21:
                s = max(s, self.ev_hit(nh, na, up))
            ev += self.P[c] * s
        self._hit[key] = ev
        return ev

    def ev_double(self, hard: int, ace: bool, up: int) -> float:
        ev = 0.0
        for c in range(1, 11):
            nh, na = hard + c, ace or c == 1
            ev += self.P[c] * (-1.0 if nh > 21 else self.ev_stand(_best(nh, na), up))
        return 2.0 * ev

    def _split_hand(self, v: int, up: int, k: int) -> float:
        """EV of ONE hand that starts with a single card of value v after a split.
        k = further splits still available (approximated per branch)."""
        key = (v, up, k)
        if key in self._split:
            return self._split[key]
        r = self.r
        tot = 0.0
        for c in range(1, 11):
            hard, ace = v + c, (v == 1 or c == 1)
            b = _best(hard, ace)
            if v == 1 and not r.hit_split_aces:
                val = self.ev_stand(b, up)
                if c == 1 and k > 0 and r.resplit_aces:
                    val = max(val, 2.0 * self._split_hand(1, up, k - 1))
            else:
                opts = [self.ev_stand(b, up)]
                if b < 21:
                    opts.append(self.ev_hit(hard, ace, up))
                if r.das and v != 1 and r.double_total_ok(b):
                    opts.append(self.ev_double(hard, ace, up))
                if c == v and k > 0 and (v != 1 or r.resplit_aces):
                    opts.append(2.0 * self._split_hand(v, up, k - 1))
                val = max(opts)
            tot += self.P[c] * val
        self._split[key] = tot
        return tot

    def ev_split(self, v: int, up: int) -> float:
        return 2.0 * self._split_hand(v, up, max(0, self.r.max_hands - 2))


class Strategy:
    """Total-dependent basic strategy for a set of table rules.

    Every chart cell (hard total / soft hand / pair vs dealer upcard) gets EVs
    for each option; hints during play use exactly the same cells, so the
    in-game advice always matches the chart in the rules guide.
    """

    def __init__(self, rules):
        self.r = rules
        # 4, 6 and 8 deck games share the classic multi-deck chart
        self.decks = 6 if rules.decks >= 4 else rules.decks
        self._models = {}
        self._cells = {}
        self._base = _Model(rules, 0, ())

    @property
    def approximate(self) -> bool:
        return self.decks < 4

    def _model(self, removed) -> _Model:
        key = tuple(sorted(removed))
        m = self._models.get(key)
        if m is None:
            m = self._models[key] = _Model(self.r, self.decks, key)
        return m

    def bust_chance(self, up: int) -> float:
        return self._base.dealer_dist(up).get(22, 0.0)

    # ------------------------------------------------------------ cells
    def cell_evs(self, kind: str, row: int, up: int) -> dict:
        """EVs of all rule-allowed options for a chart cell.

        kind 'hard' (row = total 4..20), 'soft' (row = 2..9 meaning A,2..A,9),
        'pair' (row = card value 1..10)."""
        key = (kind, row, up)
        if key in self._cells:
            return self._cells[key]
        r = self.r
        if kind == 'hard':
            comps = [(a, row - a) for a in range(2, 11)
                     if a < row - a <= 10]
            if not comps:                      # 4 = 2+2, 20 = 10+10
                comps = [(row // 2, row - row // 2)]
            hard, ace = row, False
        elif kind == 'soft':
            comps = [(1, row)]
            hard, ace = 1 + row, True
        else:
            comps = [(row, row)]
            hard, ace = 2 * row, row == 1
        b = _best(hard, ace)
        acc = {}
        wsum = 0.0
        for c1, c2 in comps:
            w = BASE_P[c1] * BASE_P[c2]
            m = self._model((c1, c2, up))
            evs = {'stand': m.ev_stand(b, up)}
            if b < 21:
                evs['hit'] = m.ev_hit(hard, ace, up)
            if r.double_total_ok(b):
                evs['double'] = m.ev_double(hard, ace, up)
            if kind == 'pair':
                evs['split'] = m.ev_split(row, up)
            for a, e in evs.items():
                acc[a] = acc.get(a, 0.0) + w * e
            wsum += w
        out = {a: e / wsum for a, e in acc.items()}
        if r.surrender_allowed:
            out['surrender'] = -0.5
        self._cells[key] = out
        return out

    @staticmethod
    def cell_of(cards, pair_ok=True):
        """Which chart cell a hand belongs to: (kind, row)."""
        t, soft = hand_total(cards)
        if pair_ok and len(cards) == 2 and (cards[0].rank == cards[1].rank or
                                             (cards[0].is_ten and cards[1].is_ten)):
            return 'pair', cards[0].value
        if soft and 13 <= t <= 20:
            return 'soft', t - 11
        if soft and t == 12:
            return 'pair', 1
        return 'hard', max(4, min(20, t))

    # ------------------------------------------------------------ decisions
    @staticmethod
    def pick(evs: dict) -> str:
        best, best_ev = None, None
        for a in ORDER:
            if a in evs and (best_ev is None or evs[a] > best_ev + 1e-12):
                best, best_ev = a, evs[a]
        return best

    def evaluate(self, cards, up_card, legal) -> dict:
        up = up_card.value if hasattr(up_card, 'value') else int(up_card)
        t, _ = hand_total(cards)
        if t >= 21:
            return {'stand': self._base.ev_stand(min(t, 22), up)} if 'stand' in legal else {}
        kind, row = self.cell_of(cards)
        evs = self.cell_evs(kind, row, up)
        if kind == 'pair' and len(cards) != 2:
            kind, row = self.cell_of(cards, pair_ok=False)
            evs = self.cell_evs(kind, row, up)
        return {a: e for a, e in evs.items() if a in legal}

    def best_action(self, cards, up_card, legal):
        evs = self.evaluate(cards, up_card, legal)
        return self.pick(evs), evs

    def advise(self, rnd, i=None) -> dict:
        """Advice for hand i of an engine Round.

        `ideal` is the best play under the table rules, `action` the best play
        you can actually make right now (e.g. ideal = double but you can't
        afford it, so action = hit)."""
        if i is None:
            i = rnd.current
        h = rnd.hands[i]
        up = rnd.dealer[0]
        ideal, ideal_evs = self.best_action(h.cards, up, rnd.rule_legal_actions(i))
        action, evs = self.best_action(h.cards, up, rnd.legal_actions(i))
        return dict(action=action, evs=evs, ideal=ideal, ideal_evs=ideal_evs,
                    blocked=ideal != action)

    # ------------------------------------------------------------ chart
    def chart_code(self, kind: str, row: int, up: int) -> str:
        """Codes: H, S, P, Dh, Ds, Rh, Rs, Rp."""
        evs = self.cell_evs(kind, row, up)
        best = self.pick(evs)
        if best in ('stand', 'hit', 'split'):
            return {'stand': 'S', 'hit': 'H', 'split': 'P'}[best]
        fb = self.pick({a: e for a, e in evs.items() if a not in ('double', 'surrender')})
        if best == 'double':
            return 'Ds' if fb == 'stand' else 'Dh'
        return {'stand': 'Rs', 'hit': 'Rh', 'split': 'Rp'}[fb]

    def chart(self):
        """{'hard'|'soft'|'pair': [(row_label, [code per upcard 2..A])]}"""
        out = {'hard': [], 'soft': [], 'pair': []}
        for t in range(5, 21):
            out['hard'].append((str(t), [self.chart_code('hard', t, u) for u in UPCARDS]))
        for o in range(2, 10):
            out['soft'].append((f'A,{o}', [self.chart_code('soft', o, u) for u in UPCARDS]))
        for v in (1, 10, 9, 8, 7, 6, 5, 4, 3, 2):
            lab = 'A,A' if v == 1 else f'{v},{v}'
            out['pair'].append((lab, [self.chart_code('pair', v, u) for u in UPCARDS]))
        return out


ACTION_LABEL = {'hit': 'Hit', 'stand': 'Stand', 'double': 'Double', 'split': 'Split',
                'surrender': 'Surrender'}


def up_name(card) -> str:
    v = card.value
    return 'an Ace' if v == 1 else ('an 8' if v == 8 else f'a {v}')


def explain(cards, up_card, action, strat=None, is_split=False) -> str:
    """One or two friendly sentences explaining a basic strategy decision."""
    t, soft = hand_total(cards)
    up = up_card.value
    weak = 2 <= up <= 6
    pair = len(cards) == 2 and cards[0].rank == cards[1].rank
    tens_pair = len(cards) == 2 and cards[0].is_ten and cards[1].is_ten
    bust = ''
    if strat is not None:
        bust = f' (the dealer busts about {round(strat.bust_chance(up) * 100)}% of the time from {up_name(up_card)})'
    if action == 'split':
        if cards[0].is_ace:
            return 'Always split Aces: two hands that each start with 11 beat one soft 12.'
        if cards[0].value == 8:
            return 'Always split 8s: 16 is the worst total in blackjack, but each 8 is a decent start.'
        if weak:
            return f'Split - the dealer is weak{bust}, so you want more money on the table.'
        return 'Split - two hands starting with this card do better than one weak total.'
    if action == 'surrender':
        return ('This hand loses so often against that card that giving up half your bet '
                'is cheaper in the long run.')
    if action == 'double':
        if soft:
            return (f'Double your soft {t} - the dealer is weak{bust}, and you cannot bust '
                    'with one card.')
        return f'Double down on {t}: one card will often give you a strong hand, so bet more.'
    if action == 'stand':
        if tens_pair:
            return 'Never split 10s - 20 is already a winning hand most of the time.'
        if t >= 17 and not soft:
            return f'{t} is strong enough. Hitting would risk busting for little gain.'
        if soft and t >= 18:
            return f'Soft {t} is a good total - stand.'
        if weak:
            return f'Stand on {t}: let the dealer take the risk{bust}.'
        return f'Stand on {t}.'
    if action == 'hit':
        if pair and cards[0].value == 5:
            return 'Never split 5s - treat them as a 10.'
        if t <= 11 and not soft:
            return f'With {t} you cannot bust, so taking a card is free.'
        if soft:
            return (f'A soft {t} cannot bust with one more card (the Ace can count as 1), '
                    'so hit to improve.')
        if up >= 7 or up == 1:
            return (f'{t} is a "stiff" hand. The dealer\'s {up_card.rank} will often make 17 '
                    'or better, so you need to improve.')
        return f'Hit {t} against {up_name(up_card)}.'
    return ''
