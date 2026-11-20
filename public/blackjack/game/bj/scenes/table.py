"""
The blackjack table, played with your saved bankroll.

The rules engine (engine.Round) is a generator; _round_flow() walks through it,
animating every event and asking you (or the bot) for decisions.
"""
from __future__ import annotations

import math
import random

from .. import art, gfx
from ..engine import ACTIONS, Round, Shoe, Wallet, fmt_money, hand_total, run_headless, total_text
from ..sprites import (warm_cards, CARD_H, CARD_W, CHIP_D, CardSprite, ChipButton, ChipStack, CoachPanel, Confetti,
                       CountingText, banner)
from ..strategy import Strategy, explain
from ..ui import (Button, Future, ImageSprite, Scene, Sprite, TextSprite, ease_in_cubic, ease_in_out_cubic,
                  ease_out_back, ease_out_cubic, linear)

DEALER_Y = 205
PLAYER_Y = 590
BET_Y = 728
SHOE = (1396, 138)
DISCARD = (160, 132)
TRAY = (800, 24)
BAL = (118, 866)
INS = (800, 430)
HUD_Y = 858
RISE = 6

ACTION_INFO = {
    'hit': ('Hit', 'green', 'plus', 'h', 'Take another card'),
    'stand': ('Stand', 'red', 'stand', 's', 'Keep your total and end your turn'),
    'double': ('Double', 'amber', 'double', 'd', 'Double your bet, take exactly one more card'),
    'split': ('Split', 'purple', 'split', 'p', 'Split your pair into two hands (adds an equal bet)'),
    'surrender': ('Surrender', 'slate', 'flag', 'r', 'Give up this hand and get half your bet back'),
}
RESULT_STYLE = {
    'blackjack': ('BLACKJACK', (255, 205, 80)),
    'win': ('WIN', (120, 220, 140)),
    'even_money': ('EVEN MONEY', (120, 220, 140)),
    'push': ('PUSH', (150, 190, 240)),
    'lose': ('LOSE', (240, 120, 104)),
    'bust': ('BUST', (240, 120, 104)),
    'surrender': ('SURRENDER', (200, 200, 210)),
}


def _discard_card(a, back):
    S = a.liveS
    return gfx.card('BACK', round(CARD_W * 0.84 * S), back=back).rotate(12, resample=gfx.BICUBIC, expand=True)


def hand_centers(n):
    return {1: [800], 2: [588, 1012], 3: [448, 800, 1152], 4: [334, 645, 955, 1266]}[max(1, min(4, n))]


class ViewImage(Sprite):
    """An image that always covers the whole window (felt, overlays)."""

    def __init__(self, scene, layer, key_fn, make_fn):
        self.key_fn = key_fn
        self.make_fn = make_fn
        super().__init__(scene, layer, 0, 0)

    def _create(self):
        a = self.app
        self.photo = a.assets.photo(self.key_fn(), self.make_fn)
        return [self.c.create_image(0, 0, image=self.photo, anchor='nw')]

    def refresh(self):
        self.remount()


class ViewBar(Sprite):
    """Dark bar along the bottom of the window (behind the HUD)."""

    def __init__(self, scene, layer, y0):
        self.y0 = y0
        super().__init__(scene, layer, 0, y0)

    def _create(self):
        a = self.app
        y0px = self.scene.P(0, self.y0)[1]
        h = max(4, int(a.H - y0px))
        W = a.W
        self.photo = a.assets.photo(('hudbar', W, h), lambda: _hud_bar(W, h, a.S))
        return [self.c.create_image(0, y0px, image=self.photo, anchor='nw')]


def _hud_bar(W, h, S):
    from PIL import ImageDraw
    img = art.vgradient(W, h, (22, 19, 16), (6, 6, 7))
    img.putalpha(236)
    d = ImageDraw.Draw(img)
    d.line([(0, 0), (W, 0)], fill=(233, 196, 106, 150), width=max(1, int(2 * S)))
    d.line([(0, int(3 * S)), (W, int(3 * S))], fill=(0, 0, 0, 120), width=max(1, int(S)))
    return img


class HandView:
    def __init__(self, cx):
        self.cx = cx
        self.cards = []
        self.stack = None
        self.win_stack = None
        self.badge = None
        self.badge_text = None
        self.result = None
        self.collected = False
        self.done = False


class TableScene(Scene):
    name = 'table'

    def __init__(self, app, **kw):
        super().__init__(app, **kw)
        st = app.store
        self.rules = st.rules()
        self.strategy = Strategy(self.rules)
        sess = app.session
        self.wallet = Wallet(st.bankroll)
        key = (self.rules.decks, self.rules.penetration)
        if sess.get('shoe') is None or sess.get('shoe_key') != key:
            sess['shoe'] = Shoe(self.rules.decks, self.rules.penetration)
            sess['shoe_key'] = key
            sess['rc'] = 0
            sess['discards'] = 0
            sess['fresh_shoe'] = True
        self.shoe = sess['shoe']
        self.rc = sess.get('rc', 0)
        self.discards = sess.get('discards', 0)
        self.pending = 0
        self.bet_chips = []
        self.inflight = []
        self.phase = 'betting'
        self.round = None
        self.engine_gen = None
        self.pending_ask = None
        self.ask_future = None
        self.ask_advice = None
        self.hands = []
        self.dealer_cards = []
        self.discard_sprites = []
        self.leftovers = []          # sprites from the finished round still on the table
        self.sweep_future = None
        self.round_task = None
        self.decisions = [0, 0]
        self.action_count = 0
        self.ins_stack = None
        self.active_hand = None
        self.arrow = None
        self.extras = []

    # ================================================================ build
    def build(self):
        a = self.app
        s = a.store.settings
        felt = s.get('felt', 'green')
        lines = self._felt_lines()
        self.felt = ViewImage(self, 'bg', lambda: ('felt', a.W, a.H, felt, lines),
                              lambda: gfx.felt(felt, lines, a.W, a.H, a.S, a.ox, a.oy))
        ViewBar(self, 'hud', 812)
        self._build_topbar()
        self._build_hud()
        self.coach = CoachPanel(self)
        self.bet_stack = ChipStack(self, 'chips', 800, BET_Y, 0, label=True)
        self._build_rack()
        self._build_bet_buttons()
        self._build_action_buttons()
        self.run(warm_cards(self))
        self.status = TextSprite(self, 'hud', 800, 793, '', size=15.5, color='#f3e6c6', shadow='#000000')
        self.count_text = TextSprite(self, 'hud', 1440, 188, '', size=13, color='#d8cfb8', family='num',
                                     shadow='#000000', justify='center')
        self._rebuild_discard()
        self._update_count()
        restore = self.app.session.pop('pending_chips', None)
        self.set_phase('betting')
        if restore:
            for d in restore:
                if self.pending + d <= min(self.wallet.balance, self.rules.max_bet):
                    self.pending += d
                    self.bet_chips.append(d)
            self.bet_stack.set_amount(self.pending)
            self._update_bet_ui()
        if a.store.load_warning:
            self.toast(a.store.load_warning, 'bad', 4)
            a.store.load_warning = None
        if self.wallet.balance < self.rules.min_bet:
            self.run(self._broke_flow())

    def _felt_lines(self):
        r = self.rules
        return (f'BLACKJACK PAYS {r.bj_num} TO {r.bj_den}',
                'DEALER MUST HIT SOFT 17' if r.h17 else 'DEALER MUST STAND ON ALL 17s',
                'INSURANCE PAYS 2 TO 1' if r.insurance else 'NO INSURANCE')

    def _build_topbar(self):
        self.btn_menu = Button(self, 'hud', 74, 34, 118, 42, 'Menu', 'ghost', icon='menu', icon_size=18,
                               font_size=15, on_click=self.on_menu, tooltip='Back to the main menu  [Esc]')
        self.btn_stats = Button(self, 'hud', 1452, 34, 44, 42, '', 'ghost', icon='stats', icon_size=20,
                                on_click=self.on_stats, tooltip='Statistics')
        self.btn_settings = Button(self, 'hud', 1504, 34, 44, 42, '', 'ghost', icon='gear', icon_size=22,
                                   on_click=self.on_settings, tooltip='Settings')
        self.top_buttons = [self.btn_menu, self.btn_stats, self.btn_settings]
        TextSprite(self, 'hud', 800, 70, self.rules.short(), size=11.5, color='#d9c99e', family='num',
                   shadow='#000000')
        muted = self.app.store.settings.get('muted')
        self.btn_sound = Button(self, 'hud', 1556, 34, 44, 42, '', 'ghost', icon='mute' if muted else 'sound',
                                icon_size=22, on_click=self.app.toggle_mute, tooltip='Sound on/off')

    def on_audio_changed(self):
        muted = self.app.store.settings.get('muted')
        self.btn_sound.icon = 'mute' if muted else 'sound'
        self.btn_sound.remount()

    def _build_hud(self):
        TextSprite(self, 'hud', 36, 836, 'BALANCE', size=12, color='#c9a85a', weight='bold', anchor='w', shadow=None)
        self.bal_text = TextSprite(self, 'hud', 36, 867, '', size=28, color='#f6ecd2', weight='bold',
                                   family='num', anchor='w')
        self.bal = CountingText(self, self.bal_text, self.wallet.balance)
        TextSprite(self, 'hud', 268, 836, 'BET', size=12, color='#c9a85a', weight='bold', anchor='w', shadow=None)
        self.bet_text = TextSprite(self, 'hud', 268, 864, '$0', size=22, color='#f6ecd2', weight='bold',
                                   family='num', anchor='w')
        r = self.rules
        self.limits_text = TextSprite(self, 'hud', 268, 886, f'Limits {fmt_money(r.min_bet)} – '
                                                             f'{fmt_money(r.max_bet)}',
                                      size=10.5, color='#8f8670', anchor='w', shadow=None)

    def _rack_denoms(self):
        r = self.rules
        allc = [100, 500, 2500, 10000, 50000, 100000, 500000]
        ok = [d for d in allc if d <= r.max_bet]
        if len(ok) > 6:
            ok = ok[-6:]
        return ok

    def _build_rack(self):
        self.rack = []
        dens = self._rack_denoms()
        n = len(dens)
        for i, d in enumerate(dens):
            x = 800 + (i - (n - 1) / 2) * 80
            self.rack.append(ChipButton(self, 'hud2', x, 856, d, self.on_chip, d=62, hotkey=str(i + 1)))

    def _build_bet_buttons(self):
        self.btn_undo = Button(self, 'hud2', 1094, 858, 46, 46, '', 'dark', icon='undo', icon_size=20,
                               on_click=self.on_undo, tooltip='Undo last chip  [Backspace]', keycap='Bksp')
        self.btn_clear = Button(self, 'hud2', 1146, 858, 46, 46, '', 'dark', icon='close', icon_size=18,
                                on_click=self.on_clear, tooltip='Clear bet  [C]', keycap='C')
        self.btn_x2 = Button(self, 'hud2', 1198, 858, 46, 46, '', 'dark', icon='x2', icon_size=24,
                             on_click=self.on_x2, tooltip='Double the bet  [X]', keycap='X')
        self.btn_rebet = Button(self, 'hud2', 1290, 858, 120, 46, 'Rebet', 'dark', icon='rebet', icon_size=18,
                                font_size=15, on_click=self.on_rebet, tooltip='Repeat your last bet  [R]', keycap='R')
        self.btn_max = Button(self, 'hud2', 470, 840, 128, 32, 'MAX BET', 'amber', font_size=13,
                              on_click=self.on_max, tooltip='Bet the table maximum  [M]', keycap='M',
                              keycap_side='right')
        self.btn_allin = Button(self, 'hud2', 470, 878, 128, 32, 'ALL IN', 'red', font_size=13,
                                on_click=self.on_allin, tooltip='Bet everything you have  [A]', keycap='A',
                                keycap_side='right')
        self.btn_deal = Button(self, 'hud2', 1468, 856, 196, 58, 'DEAL', 'gold', icon='cards', icon_size=22,
                               font_size=21, on_click=self.on_deal, tooltip='Deal the cards  [Space]', keycap='Space')
        self.bet_buttons = [self.btn_undo, self.btn_clear, self.btn_x2, self.btn_rebet, self.btn_max,
                            self.btn_allin, self.btn_deal]

    def _build_action_buttons(self):
        self.action_btns = {}
        for i, a in enumerate(ACTIONS):
            label, style, icon, key, tip = ACTION_INFO[a]
            x = 800 + (i - 2) * 162
            b = Button(self, 'hud2', x, 858, 152, 56, label, style, icon=icon, icon_size=22, font_size=18,
                       on_click=lambda a=a: self.on_action(a), tooltip=f'{tip}  [{key.upper()}]', keycap=key.upper())
            b.set_visible(False)
            self.action_btns[a] = b
        self.btn_hint = Button(self, 'hud2', 1478, 858, 150, 50, 'Hint', 'ghost', icon='hint', icon_size=20,
                               font_size=16, on_click=self.on_hint, tooltip='What does basic strategy say?  [T]', keycap='T')
        self.btn_hint.set_visible(False)

    # ================================================================ phase / ui state
    def set_phase(self, phase):
        self.phase = phase
        betting = phase == 'betting'
        for w in self.rack:
            w.set_visible(betting or (phase == 'betting_bot'))
        for b in self.bet_buttons:
            b.set_visible(betting or phase == 'betting_bot')
        player = phase == 'player'
        for b in self.action_btns.values():
            b.set_visible(player)
        hints = self.app.store.settings.get('hints', 'button')
        self.btn_hint.set_visible(player and hints != 'off')
        for b in self.top_buttons[1:]:
            b.set_enabled(phase == 'betting', 'Available between hands')
        if betting:
            self._update_bet_ui()
            if not self.leftovers:
                self.set_status('Click the chips to place a bet, then press DEAL')
            else:
                self.set_status('Place your next bet')
        elif phase == 'betting_bot':
            for w in self.rack:
                w.set_enabled(True)
            for b in self.bet_buttons:
                b.set_enabled(False)

    def set_status(self, text):
        self.status.set_text(text)

    def _update_bet_ui(self):
        r = self.rules
        bal = self.wallet.balance
        cap = min(bal, r.max_bet)
        for w in self.rack:
            if self.pending + w.denom > r.max_bet:
                w.set_enabled(False, f'Table maximum is {fmt_money(r.max_bet)}')
            elif self.pending + w.denom > bal:
                w.set_enabled(False, 'Not enough chips')
            else:
                w.set_enabled(True)
        self.btn_undo.set_enabled(bool(self.bet_chips), 'Nothing to undo')
        self.btn_clear.set_enabled(self.pending > 0, 'No bet placed')
        self.btn_x2.set_enabled(0 < self.pending and self.pending * 2 <= cap,
                                'Nothing to double' if self.pending == 0 else
                                ('Table maximum reached' if self.pending * 2 > r.max_bet else 'Not enough chips'))
        self.btn_max.set_enabled(bal >= r.max_bet and self.pending != r.max_bet,
                                 'Not enough chips for the table maximum' if bal < r.max_bet
                                 else 'Already at the table maximum')
        allin = cap // 100 * 100
        self.btn_allin.set_enabled(allin >= r.min_bet and self.pending != allin,
                                   'Not enough chips' if allin < r.min_bet else 'Already all in')
        self.btn_allin.tooltip = ('Bet everything you have  [A]' if bal <= r.max_bet else
                                  f'Table maximum caps this at {fmt_money(r.max_bet)}  [A]')
        lb = self.app.store.last_bet
        rb = min(lb, cap) // 100 * 100
        self.btn_rebet.set_enabled(rb >= r.min_bet and rb != self.pending,
                                   'No previous bet' if lb == 0 else 'Not enough chips for that bet')
        if self.pending == 0 and rb >= r.min_bet:
            if self.btn_deal.label != 'REBET & DEAL':
                self.btn_deal.font_size = 17
                self.btn_deal.set_label('REBET & DEAL')
            self.btn_deal.set_enabled(True)
            self.btn_deal.tooltip = f'Bet {fmt_money(rb)} again and deal  [Space]'
        else:
            if self.btn_deal.label != 'DEAL':
                self.btn_deal.font_size = 21
                self.btn_deal.set_label('DEAL')
            self.btn_deal.tooltip = 'Deal the cards  [Space]'
            if self.pending < r.min_bet:
                self.btn_deal.set_enabled(False, f'Minimum bet is {fmt_money(r.min_bet)}')
            else:
                self.btn_deal.set_enabled(True)
        self.bet_text.set_text(fmt_money(self.pending))
        self.bal.set(bal - self.pending, 0.25)

    # ================================================================ betting input
    def _begin_new_bet(self):
        """First betting action after a round clears the old cards."""
        if self.leftovers or self.dealer_cards or self.hands:
            self._sweep()

    def on_chip(self, denom):
        if self.phase != 'betting':
            return
        r = self.rules
        if self.pending + denom > min(self.wallet.balance, r.max_bet):
            self.app.sound.play('deny')
            self.toast('Table maximum reached' if self.pending + denom > r.max_bet else 'Not enough chips',
                       'bad', 1.4)
            return
        self._begin_new_bet()
        self.pending += denom
        self.bet_chips.append(denom)
        self._fly_chip(denom, self._rack_pos(denom), self.pending)
        self._update_bet_ui()

    def _rack_pos(self, denom):
        for w in self.rack:
            if w.denom == denom:
                return (w.x, w.y)
        return BAL

    def _fly_chip(self, denom, start, final_amount):
        stack = self.bet_stack
        spr = ChipStack(self, 'fly', start[0], start[1], denom, d=CHIP_D)
        tx, ty = 800, stack.top_y() - 2
        self.app.sound.play('chip', 0.9)
        tw = self.move(spr, tx, ty, 0.22, ease_out_cubic, clock='ui')
        self.inflight.append((spr, tw))

        def land(_):
            if (spr, tw) in self.inflight:
                self.inflight.remove((spr, tw))
            spr.destroy()
            if stack.alive and stack is self.bet_stack:
                stack.set_amount(final_amount)
        tw.then(land)

    def _land_all(self):
        for spr, tw in list(self.inflight):
            tw.cancel(finish=True)
        self.inflight = []
        self.bet_stack.set_amount(self.pending)

    def on_undo(self):
        if self.phase != 'betting' or not self.bet_chips:
            return
        self._land_all()
        d = self.bet_chips.pop()
        self.pending -= d
        self.bet_stack.set_amount(self.pending)
        self.app.sound.play('chip', 0.6)
        self._update_bet_ui()

    def on_clear(self):
        if self.phase != 'betting' or self.pending == 0:
            return
        self._land_all()
        amt = self.pending
        self.pending = 0
        self.bet_chips = []
        self._stack_fly(amt, (800, BET_Y), BAL, 0.3)
        self.bet_stack.set_amount(0)
        self.app.sound.play('chips_stack', 0.7)
        self._update_bet_ui()

    def on_x2(self):
        if self.phase != 'betting' or self.pending == 0:
            return
        cap = min(self.wallet.balance, self.rules.max_bet)
        if self.pending * 2 > cap:
            self.app.sound.play('deny')
            return
        self._land_all()
        add = self.pending
        self.bet_chips.append(add)
        self.pending += add
        self._stack_fly(add, BAL, (800, self.bet_stack.top_y()), 0.3, then_amount=self.pending)
        self.app.sound.play('chips_stack', 0.8)
        self._update_bet_ui()

    def on_rebet(self):
        if self.phase != 'betting':
            return
        lb = self.app.store.last_bet
        cap = min(self.wallet.balance, self.rules.max_bet)
        self._set_bet(min(lb, cap) // 100 * 100)

    def on_max(self):
        if self.phase != 'betting':
            return
        if self.wallet.balance < self.rules.max_bet:
            self.app.sound.play('deny')
            self.toast('Not enough chips for the table maximum - try ALL IN', 'bad', 1.6)
            return
        self._set_bet(self.rules.max_bet)

    def on_allin(self):
        if self.phase != 'betting':
            return
        bal = self.wallet.balance
        amt = min(bal, self.rules.max_bet) // 100 * 100
        if amt >= self.rules.min_bet and bal > self.rules.max_bet:
            self.toast(f'Table maximum caps your all-in at {fmt_money(self.rules.max_bet)}', 'info', 1.8)
        self._set_bet(amt, big=True)

    def _set_bet(self, amt, big=False):
        """Replace whatever is on the circle with a single bet of `amt`."""
        if amt < self.rules.min_bet:
            self.app.sound.play('deny')
            return
        self._begin_new_bet()
        self._land_all()
        if self.pending:
            self.bet_stack.set_amount(0)
        self.pending = amt
        self.bet_chips = [amt]
        self._stack_fly(amt, BAL, (800, BET_Y), 0.32, then_amount=amt)
        self.app.sound.play('chips_stack', 1.0 if big else 0.8)
        self._update_bet_ui()

    def _stack_fly(self, amount, start, end, dur, then_amount=None, layer='fly'):
        spr = ChipStack(self, layer, start[0], start[1], amount, d=CHIP_D)
        tw = self.move(spr, end[0], end[1], dur, ease_out_cubic, clock='ui')
        stack = self.bet_stack

        def land(_):
            spr.destroy()
            if then_amount is not None and stack.alive and stack is self.bet_stack:
                stack.set_amount(then_amount)
        tw.then(land)
        if then_amount is not None:
            self.inflight.append((spr, tw))
        return tw

    def on_deal(self):
        if self.phase != 'betting':
            return
        r = self.rules
        if self.pending == 0 and self.app.store.last_bet:
            self.on_rebet()
        if self.pending < r.min_bet:
            self.app.sound.play('deny')
            self.toast(f'Minimum bet is {fmt_money(r.min_bet)}', 'bad', 1.6)
            return
        if self.pending > self.wallet.balance:
            self.app.sound.play('deny')
            return
        self._land_all()
        bet = self.pending
        self.pending = 0
        self.bet_chips = []
        self.app.store.last_bet = bet
        self.set_phase('busy')
        self.round_task = self.run(self._play_round(bet), on_error=self._round_error)

    # ================================================================ round driver
    def _play_round(self, bet):
        if self.sweep_future is not None:
            yield self.sweep_future
        if self.leftovers or self.dealer_cards or self.hands:
            self._sweep()
            yield self.sweep_future
        yield from self._maybe_shuffle()
        rnd = Round(self.rules, self.shoe, self.wallet, bet)
        yield from self._round_flow(rnd)

    def _round_error(self, e):
        """Something went wrong inside the round coroutine - keep money safe."""
        self.app.report_error(e)
        try:
            if self.engine_gen is not None and self.round and not self.round.finished:
                self._finish_headless()
            elif self.round and not self.round.finished:
                self.wallet.balance = self.round.balance_before
        except Exception:
            if self.round:
                self.wallet.balance = self.round.balance_before
        self.engine_gen = None
        self.pending_ask = None
        self._after_round_bookkeeping(self.round)
        self.set_phase('betting')
        self.bal.set(self.wallet.balance, 0.3)

    def _round_flow(self, rnd):
        self.round = rnd
        self.decisions = [0, 0]
        self.action_count = 0
        self.hands = [HandView(800)]
        hv = self.hands[0]
        # the pending bet stack becomes hand 0's stack
        hv.stack = self.bet_stack
        hv.stack.label = False
        hv.stack.set_amount(rnd.initial_bet)
        hv.stack.remount()
        self.bet_stack = ChipStack(self, 'chips', 800, BET_Y, 0, label=True)
        self.bet_text.set_text(fmt_money(rnd.initial_bet))
        self.bal.set(self.wallet.balance - rnd.initial_bet, 0.3)
        self.set_status('')
        gen = rnd.play()
        self.engine_gen = gen
        send = None
        while True:
            try:
                item = gen.send(send)
            except StopIteration:
                break
            send = None
            if item.is_ask:
                self.pending_ask = item
                send = yield from self._ask(item)
                self.pending_ask = None
            else:
                yield from self._event(item)
        self.engine_gen = None
        yield from self._after_round(rnd)

    # ---------------------------------------------------------------- events
    def _event(self, ev):
        k = ev.kind
        if k == 'bet':
            return
        if k == 'deal':
            yield from self._anim_deal(ev)
        elif k == 'dealt':
            self._update_badges()
            up = self.round.dealer[0]
            h = self.round.hands[0]
            if not h.is_blackjack:
                self.set_status(f'You have {total_text(h.cards)} · dealer shows {up.rank}')
        elif k == 'shuffle':
            self.toast('The shoe ran out - shuffling the discards', 'info', 2.0)
            self.app.sound.play('shuffle')
            self.rc = 0
            self._update_count()
            yield 1.0
        elif k == 'peek':
            yield from self._anim_peek(ev.dealer_blackjack)
        elif k == 'reveal':
            yield from self._anim_reveal()
        elif k == 'dealer_blackjack':
            self._update_badges()
            self.app.sound.play('lose')
            yield banner(self, 'Dealer Blackjack', '#ff8a7a', 54, y=455, hold=0.8)
        elif k == 'insurance':
            yield from self._anim_insurance(ev.amount)
        elif k == 'insurance_lost':
            yield from self._anim_insurance_lost()
        elif k == 'even_money':
            self.app.sound.play('win')
            self._set_result(0, 'even_money', ev.payout - self.round.hands[0].bet)
            yield 0.4
        elif k == 'blackjack':
            self.app.sound.play('blackjack')
            Confetti(self, 70, burst=(800, 520))
            self._set_result(0, 'blackjack', ev.payout - self.round.hands[0].bet)
            yield banner(self, 'BLACKJACK!', '#ffd25a', 70, y=455, hold=0.7,
                         sub=f'pays {self.rules.bj_num} to {self.rules.bj_den}')
        elif k == 'blackjack_pending':
            self.toast('Blackjack! Waiting for the dealer\'s second card...', 'gold', 2.2)
            yield 0.5
        elif k == 'turn':
            self._set_active(ev.hand)
            yield 0.05
        elif k == 'hit':
            pass
        elif k == 'stand':
            if ev.auto and ev.reason == '21':
                self._pulse_badge(ev.hand)
                yield 0.25
            elif ev.auto and ev.reason == 'split_aces':
                self.set_status('Split Aces get one card each')
                yield 0.3
        elif k == 'double':
            yield from self._anim_double(ev.hand, ev.amount)
        elif k == 'split':
            yield from self._anim_split(ev)
        elif k == 'surrender':
            self._set_result(ev.hand, 'surrender', -self.round.hands[ev.hand].bet // 2)
            self.app.sound.play('push')
            yield 0.3
        elif k == 'bust':
            yield from self._anim_bust(ev.hand)
        elif k == 'dealer_turn':
            self._set_active(None)
            self.set_status("Dealer's turn")
            yield 0.15
        elif k == 'dealer_done':
            self._update_badges()
            if ev.bust:
                self.app.sound.play('bust', 0.7)
                yield banner(self, 'Dealer busts!', '#7fe39a', 52, y=360, hold=0.6)
            yield 0.2
        elif k == 'settle':
            yield from self._anim_settle(ev)

    def _cards_txt(self, cards):
        return ' + '.join(c.rank for c in cards)

    def _card_word(self, c):
        return 'an Ace' if c.is_ace else ('an 8' if c.rank == '8' else f'a {c.rank}')

    # ---------------------------------------------------------------- layout
    def _dealer_positions(self, n):
        step = CARD_W * 0.62
        if n > 1:
            step = min(step, 520 / (n - 1))
        x0 = 800 - step * (n - 1) / 2
        return [(x0 + i * step, DEALER_Y) for i in range(n)]

    def _hand_positions(self, hv, nh=None):
        nh = nh or len(self.hands)
        n = len(hv.cards)
        if n == 0:
            return []
        max_w = {1: 560, 2: 390, 3: 320, 4: 292}[nh]
        widths = [CARD_H if c.rotated else CARD_W for c in hv.cards]
        step = CARD_W * 0.37
        if n > 1:
            need = sum((widths[i] + widths[i - 1]) / 2 - CARD_W for i in range(1, n))
            avail = max_w - widths[0] / 2 - widths[-1] / 2 - need
            step = max(14, min(step, avail / (n - 1)))
        xs = [0.0]
        for i in range(1, n):
            xs.append(xs[-1] + step + (widths[i] + widths[i - 1]) / 2 - CARD_W)
        left = xs[0] - widths[0] / 2
        right = xs[-1] + widths[-1] / 2
        shift = hv.cx - (left + right) / 2
        out = []
        for i in range(n):
            y = PLAYER_Y - i * RISE
            if widths[i] != CARD_W:
                y += 8
            out.append((xs[i] + shift, y))
        return out

    def _relayout(self, dur=0.32):
        anims = []
        centers = hand_centers(len(self.hands))
        for hv, cx in zip(self.hands, centers):
            hv.cx = cx
            for c, (x, y) in zip(hv.cards, self._hand_positions(hv)):
                if abs(c.x - x) > 0.5 or abs(c.y - y) > 0.5:
                    anims.append(self.move(c, x, y, dur, ease_in_out_cubic))
            if hv.stack is not None:
                anims.append(self.move(hv.stack, cx, BET_Y, dur, ease_in_out_cubic))
        self._update_badges()
        return anims

    # ---------------------------------------------------------------- dealing
    def _anim_deal(self, ev):
        card = ev.card
        if ev.to == 'dealer':
            spr = CardSprite(self, 'fly', SHOE[0], SHOE[1], card, face_up=False)
            self.dealer_cards.append(spr)
            pos = self._dealer_positions(len(self.dealer_cards))
            anims = [self.move(c, x, y, 0.25) for c, (x, y) in zip(self.dealer_cards[:-1], pos[:-1])
                     if abs(c.x - x) > 0.5]
            tx, ty = pos[-1]
        else:
            hv = self.hands[ev.hand]
            spr = CardSprite(self, 'fly', SHOE[0], SHOE[1], card, face_up=False, rotated=ev.rotated)
            hv.cards.append(spr)
            pos = self._hand_positions(hv)
            anims = [self.move(c, x, y, 0.25) for c, (x, y) in zip(hv.cards[:-1], pos[:-1])
                     if abs(c.x - x) > 0.5 or abs(c.y - y) > 0.5]
            tx, ty = pos[-1]
        self.app.sound.play('card_deal')
        anims.append(self.move(spr, tx, ty, 0.36, ease_out_cubic))
        if ev.face_up:
            anims.append(spr.flip_to(True, 0.24, delay=0.1, sound=False))
        yield anims
        spr.set_layer('cards')
        if ev.face_up:
            self._seen(card)
        self._update_badges()
        yield 0.07

    def _anim_peek(self, has_bj):
        hole = self.dealer_cards[1] if len(self.dealer_cards) > 1 else None
        self.set_status('Dealer checks for Blackjack...')
        if hole is not None:
            y0 = hole.y
            yield self.move(hole, hole.x - 4, y0 - 12, 0.18)
            yield 0.4
            yield self.move(hole, hole.x + 4, y0, 0.16)
        if not has_bj:
            self.set_status('No dealer Blackjack')
            yield 0.3

    def _anim_reveal(self):
        if len(self.dealer_cards) > 1:
            hole = self.dealer_cards[1]
            yield hole.flip_to(True, 0.3)
            self._seen(hole.card)
        self._update_badges()
        yield 0.25

    def _seen(self, card):
        self.rc += card.hilo
        self._update_count()

    def _update_count(self):
        if self.app.store.settings.get('show_count'):
            dl = self.shoe.decks_remaining
            tc = self.rc / dl if dl > 0 else 0
            self.count_text.set_text(f'Running count {self.rc:+d}   True count {tc:+.1f}\n'
                                     f'{dl:.1f} decks left in the shoe')
        else:
            self.count_text.set_text('')
        self.app.session['rc'] = self.rc

    # ---------------------------------------------------------------- badges & results
    def _badge(self, key, x, y, text, color=(18, 18, 22, 225), text_color='#f6ecd2', border=(233, 196, 106, 150)):
        """Creates/updates a pill-shaped label. key is a tuple identifying it."""
        f = self.app.font(16, 'bold', 'num')
        tw = max(46, f.measure(text) / self.app.S + 26)
        S = self.app.liveS
        holder = self._badges if hasattr(self, '_badges') else {}
        self._badges = holder
        old = holder.get(key)
        if old:
            bg, tx, w0, col0 = old
            if abs(w0 - tw) < 0.5 and col0 == (color, border):
                bg.move_to(x, y)
                tx.move_to(x, y)
                tx.set_text(text)
                tx.set_color(text_color)
                return
            bg.destroy()
            tx.destroy()
        bg = ImageSprite(self, 'mid', x, y, ('badge', round(tw), color, border), lambda: art.render_pill(
            round(tw * S), round(30 * S), color, border))
        tx = TextSprite(self, 'mid', x, y, text, size=16, weight='bold', family='num', color=text_color, shadow=None)
        holder[key] = (bg, tx, tw, (color, border))

    def _drop_badge(self, key):
        holder = getattr(self, '_badges', {})
        old = holder.pop(key, None)
        if old:
            old[0].destroy()
            old[1].destroy()

    def _update_badges(self):
        if not self.app.store.settings.get('show_totals', True):
            return
        rnd = self.round
        if rnd is None:
            return
        # dealer
        vis = [c.card for c in self.dealer_cards if c.face_up and c.card is not None]
        if vis:
            t, _ = hand_total(vis)
            if len(vis) == 2 and t == 21 and len(self.dealer_cards) == 2 and rnd.dealer_blackjack:
                self._badge('dealer', 800, DEALER_Y + CARD_H / 2 + 24, 'BLACKJACK', (60, 40, 8, 235),
                            '#ffd25a', (255, 210, 90, 220))
            elif t > 21:
                self._badge('dealer', 800, DEALER_Y + CARD_H / 2 + 24, f'BUST {t}', (90, 20, 16, 235), '#ffd8d0',
                            (240, 120, 100, 200))
            else:
                self._badge('dealer', 800, DEALER_Y + CARD_H / 2 + 24, total_text(vis))
        # player hands
        for i, hv in enumerate(self.hands):
            cs = [c.card for c in hv.cards if c.card is not None]
            if not cs or i >= len(rnd.hands):
                self._drop_badge(('hand', i))
                continue
            pos = self._hand_positions(hv)
            top = min(y for _, y in pos) - CARD_H / 2 - 20
            h = rnd.hands[i]
            t = h.total
            if h.is_blackjack:
                self._badge(('hand', i), hv.cx, top, 'BLACKJACK', (60, 40, 8, 235), '#ffd25a', (255, 210, 90, 220))
            elif t > 21:
                self._badge(('hand', i), hv.cx, top, f'BUST {t}', (90, 20, 16, 235), '#ffd8d0', (240, 120, 100, 200))
            elif i == self.active_hand:
                self._badge(('hand', i), hv.cx, top, total_text(cs), (60, 46, 12, 240), '#ffe9a8', (255, 214, 102, 255))
            else:
                self._badge(('hand', i), hv.cx, top, total_text(cs))
        for key in list(getattr(self, '_badges', {}).keys()):
            if isinstance(key, tuple) and key[0] == 'hand' and key[1] >= len(self.hands):
                self._drop_badge(key)
        self._place_arrow()

    def _pulse_badge(self, i):
        self.app.sound.play('pop', 0.5)

    def _set_active(self, i):
        self.active_hand = i
        self._update_badges()
        if len(self.hands) > 1 and i is not None:
            self.set_status(f'Playing hand {i + 1} of {len(self.hands)}')

    def _place_arrow(self):
        i = self.active_hand
        if i is None or len(self.hands) < 2 or i >= len(self.hands):
            if self.arrow:
                self.arrow.destroy()
                self.arrow = None
            return
        hv = self.hands[i]
        pos = self._hand_positions(hv)
        if not pos:
            return
        top = min(y for _, y in pos) - CARD_H / 2 - 48
        if self.arrow is None:
            S = self.app.liveS
            self.arrow = TextSprite(self, 'mid', hv.cx, top, '▼', size=22, color='#ffd25a', shadow='#000000')
            self._bob_arrow()
        self.arrow.base_y = top
        self.arrow.move_to(hv.cx, top)

    def _bob_arrow(self):
        def loop():
            k = 0.0
            while self.arrow is not None and self.arrow.alive:
                k += 1

                def f(t):
                    if self.arrow is not None and self.arrow.alive:
                        self.arrow.move_to(self.arrow.x, self.arrow.base_y + 5 * math.sin(t * math.pi))
                yield self.ui_tween(0.7, f, linear)
        self.run(loop())

    def _set_result(self, i, result, net):
        if i >= len(self.hands):
            return
        hv = self.hands[i]
        label, col = RESULT_STYLE[result]
        if result in ('win', 'blackjack', 'even_money'):
            text = f'{label}  {fmt_money(net, plus=True)}'
        elif result in ('lose', 'bust', 'surrender'):
            text = f'{label}  {fmt_money(net)}'
        else:
            text = label
        if hv.result:
            for s in hv.result:
                s.destroy()
        f = self.app.font(17, 'bold', 'num')
        tw = f.measure(text) / self.app.S + 34
        S = self.app.liveS
        y = PLAYER_Y + 28
        fill = tuple(int(c * 0.22) for c in col) + (238,)
        bg = ImageSprite(self, 'fx', hv.cx, y, ('result', round(tw), result), lambda: art.render_pill(
            round(tw * S), round(36 * S), fill, col + (230,)))
        tx = TextSprite(self, 'fx', hv.cx, y, text, size=17, weight='bold', family='num', color=art.hexcolor(col),
                        shadow='#000000')
        hv.result = (bg, tx)

        def pop(t):
            if tx.alive:
                tx.set_size(17 * (0.6 + 0.4 * t))
        self.ui_tween(0.3, pop, ease_out_back)

    # ---------------------------------------------------------------- player actions (animations)
    def _anim_double(self, i, amount):
        hv = self.hands[i]
        self.bal.set(self.wallet.balance, 0.3)
        self.app.sound.play('chips_stack', 0.8)
        yield self._stack_to(amount, BAL, (hv.cx + 8, hv.stack.top_y() - 4), 0.32)
        hv.stack.set_amount(self.round.hands[i].bet)
        self.bet_text.set_text(fmt_money(sum(h.bet for h in self.round.hands)))

    def _stack_to(self, amount, start, end, dur, ease=ease_out_cubic):
        spr = ChipStack(self, 'fly', start[0], start[1], amount, d=CHIP_D)
        tw = self.move(spr, end[0], end[1], dur, ease)
        tw.then(lambda _: spr.destroy())
        return tw

    def _anim_split(self, ev):
        i, j = ev.hand, ev.new_hand
        hv = self.hands[i]
        moved = hv.cards.pop()
        nhv = HandView(hv.cx)
        nhv.cards.append(moved)
        self.hands.insert(j, nhv)
        # shift badge keys for hands after j
        holder = getattr(self, '_badges', {})
        for k in sorted([k for k in holder if isinstance(k, tuple) and k[0] == 'hand'], key=lambda k: -k[1]):
            if k[1] >= j:
                holder[('hand', k[1] + 1)] = holder.pop(k)
        self.bal.set(self.wallet.balance, 0.3)
        self.app.sound.play('chips_stack', 0.8)
        nhv.stack = ChipStack(self, 'chips', BAL[0], BAL[1], ev.amount, d=CHIP_D)
        anims = self._relayout(0.36)
        yield anims
        self.bet_text.set_text(fmt_money(sum(h.bet for h in self.round.hands)))
        yield 0.1

    def _anim_bust(self, i):
        hv = self.hands[i]
        self._update_badges()
        self.app.sound.play('bust')
        x0 = hv.cx

        def shake(t):
            dx = math.sin(t * math.pi * 6) * 8 * (1 - t)
            for c, (x, y) in zip(hv.cards, self._hand_positions(hv)):
                c.move_to(x + dx, y)
        yield self.tween(0.4, shake, linear)
        self._set_result(i, 'bust', -self.round.hands[i].bet)
        # dealer collects busted bets right away
        if hv.stack is not None and hv.stack.amount:
            st = hv.stack
            hv.collected = True
            self.app.sound.play('chips_stack', 0.6)
            tw = self.move(st, TRAY[0], TRAY[1], 0.45, ease_in_cubic)
            tw.then(lambda _: st.destroy())
            hv.stack = None
        yield 0.35

    def _anim_insurance(self, amount):
        self.bal.set(self.wallet.balance, 0.3)
        self.app.sound.play('chips_stack', 0.8)
        self.ins_stack = ChipStack(self, 'chips', BAL[0], BAL[1], amount, d=CHIP_D * 0.9)
        yield self.move(self.ins_stack, INS[0], INS[1], 0.4)
        yield 0.1

    def _anim_insurance_lost(self):
        self.toast('No dealer Blackjack - insurance lost', 'bad', 1.8)
        if self.ins_stack is not None:
            st = self.ins_stack
            self.ins_stack = None
            self.app.sound.play('chips_stack', 0.6)
            yield self.move(st, TRAY[0], TRAY[1], 0.45, ease_in_cubic)
            st.destroy()

    # ---------------------------------------------------------------- settlement
    def _anim_settle(self, ev):
        rnd = self.round
        self._set_active(None)
        self.set_status('')
        best = None
        order = ['blackjack', 'win', 'even_money', 'push', 'surrender', 'lose', 'bust']
        movers = []
        for i, h in enumerate(rnd.hands):
            hv = self.hands[i]
            net = h.payout - h.bet
            if h.result in ('bust',):
                continue
            if h.result not in ('blackjack', 'even_money') or hv.result is None:
                self._set_result(i, h.result, net)
            if best is None or order.index(h.result) < order.index(best):
                best = h.result
            if h.result in ('win', 'blackjack', 'even_money') and hv.stack is not None:
                win_amt = h.payout - h.bet
                ws = ChipStack(self, 'fly', TRAY[0], TRAY[1], win_amt, d=CHIP_D)
                movers.append(self.move(ws, hv.cx + 64, BET_Y, 0.45, ease_out_cubic, delay=0.1 * i))
                hv.win_stack = ws
            elif h.result == 'lose' and hv.stack is not None:
                st = hv.stack
                hv.stack = None
                t = self.move(st, TRAY[0], TRAY[1], 0.45, ease_in_cubic, delay=0.1 * i)
                t.then(lambda _, st=st: st.destroy())
                movers.append(t)
            elif h.result == 'surrender' and hv.stack is not None:
                half = h.bet - h.payout
                hv.stack.set_amount(h.payout)
                movers.append(self._stack_to(half, (hv.cx, BET_Y), TRAY, 0.45, ease_in_cubic))
        if any(h.result == 'bust' for h in rnd.hands) and best is None:
            best = 'bust'
        if rnd.insurance:
            if rnd.insurance_payout and self.ins_stack is not None:
                ws = ChipStack(self, 'fly', TRAY[0], TRAY[1], rnd.insurance * 2, d=CHIP_D * 0.9)
                movers.append(self.move(ws, INS[0] + 60, INS[1], 0.45))
                self.extras.append(ws)
                self.toast('Insurance pays 2 to 1', 'good', 1.8)
            elif self.ins_stack is not None:
                st = self.ins_stack
                self.ins_stack = None
                t = self.move(st, TRAY[0], TRAY[1], 0.45, ease_in_cubic)
                t.then(lambda _, st=st: st.destroy())
                movers.append(t)
        snd = {'blackjack': None, 'win': 'win', 'even_money': 'win', 'push': 'push', 'surrender': 'lose',
               'lose': 'lose', 'bust': None}.get(best)
        net = rnd.net
        if snd and not (best == 'win' and net <= 0 and len(rnd.hands) > 1):
            self.app.sound.play(snd)
        elif best == 'win':
            self.app.sound.play('push')
        if any(h.result in ('win', 'blackjack', 'even_money') for h in rnd.hands) or rnd.insurance_payout:
            self.app.sound.play('chips_payout', 0.8)
        yield movers
        yield 0.35
        # everything still on the table goes to the player
        back = []
        for hv in self.hands:
            for st in (hv.stack, hv.win_stack):
                if st is not None and st.alive:
                    t = self.move(st, BAL[0], BAL[1], 0.5, ease_in_cubic)
                    t.then(lambda _, st=st: st.destroy())
                    back.append(t)
            hv.stack = None
            hv.win_stack = None
        for st in [self.ins_stack] + self.extras:
            if st is not None and st.alive:
                t = self.move(st, BAL[0], BAL[1], 0.5, ease_in_cubic)
                t.then(lambda _, st=st: st.destroy())
                back.append(t)
        self.ins_stack = None
        self.extras = []
        if back:
            self.app.sound.play('chips_stack', 0.7)
        yield back
        self.bal.set(self.wallet.balance, 0.6)
        self.bet_text.set_text('$0')
        # summary
        if net > 0:
            yield banner(self, f'You win {fmt_money(net)}', '#8ff0a8', 46, y=455, hold=0.7)
        elif net < 0:
            yield banner(self, f'You lose {fmt_money(-net)}', '#ff9c8c', 40, y=455, hold=0.55)
        else:
            yield banner(self, 'Push', '#a8c8ff', 44, y=455, hold=0.5)

    # ---------------------------------------------------------------- after round
    def _after_round(self, rnd):
        self._after_round_bookkeeping(rnd)
        self.leftovers = True
        self.set_phase('betting')
        if self.wallet.balance < self.rules.min_bet:
            yield 0.3
            yield from self._broke_flow()
        elif self.shoe.needs_shuffle:
            self.toast('Cut card reached - the shoe will be shuffled before the next hand', 'info', 2.4)
        return

    def _after_round_bookkeeping(self, rnd):
        if rnd is None:
            return
        if getattr(rnd, '_recorded', False) is False and rnd.finished:
            st = self.app.store
            st.bankroll = self.wallet.balance
            st.record_round(rnd, tuple(self.decisions))
            rnd._recorded = True
            st.save()
        else:
            self.app.store.bankroll = self.wallet.balance
            self.app.store.save()

    def _broke_flow(self):
        st = self.app.store
        start = st.settings.get('start_bankroll', 100000)
        m = self.modal('Out of chips!',
                       f'Good thing it\'s all pretend money. Take a fresh {fmt_money(start)} and keep playing?\n'
                       f'(Your stats keep counting how many times you\'ve refilled.)',
                       buttons=(('Refill ' + fmt_money(start), 'gold', 'refill'), ('Main menu', 'dark', 'menu')),
                       icon='chip', default='refill')
        choice = yield m.future
        if choice == 'refill':
            st.reset_bankroll(refill=True)
            self.wallet.balance = st.bankroll
            self.app.sound.play('cash')
            self.bal.set(self.wallet.balance, 0.8)
            self.toast(f'+{fmt_money(start)} in fresh chips', 'gold', 2)
            self._update_bet_ui()
        else:
            self.app.go_menu()

    # ---------------------------------------------------------------- table clean-up
    def _sweep(self):
        """Move all cards of the previous round to the discard tray."""
        cards = list(self.dealer_cards)
        for hv in self.hands:
            cards.extend(hv.cards)
        holder = getattr(self, '_badges', {})
        for key in list(holder):
            self._drop_badge(key)
        for hv in self.hands:
            if hv.result:
                for s in hv.result:
                    s.destroy()
            for st in (hv.stack, hv.win_stack):
                if st is not None:
                    st.destroy()
        if self.arrow:
            self.arrow.destroy()
            self.arrow = None
        self.dealer_cards = []
        self.hands = []
        self.leftovers = False
        self.coach.hide()
        anims = []
        n = len(cards)
        for k, c in enumerate(cards):
            c.set_layer('fly')
            tw = self.move(c, DISCARD[0] + random.uniform(-3, 3), DISCARD[1] + random.uniform(-3, 3), 0.38,
                           ease_in_out_cubic, clock='ui', delay=0.02 * k)
            if c.face_up:
                c.flip_to(False, 0.2, delay=0.02 * k, sound=False)
            tw.then(lambda _, c=c: c.destroy())
            anims.append(tw)
        if n:
            self.app.sound.play('card_place', 0.6)
        self.discards += n
        self.app.session['discards'] = self.discards
        f = Future()
        self.sweep_future = f

        def done(_):
            self._rebuild_discard()
            self.sweep_future = None
            f.resolve()
        from ..ui import all_of
        all_of(anims).then(done)
        return f

    def _rebuild_discard(self):
        for s in self.discard_sprites:
            s.destroy()
        self.discard_sprites = []
        layers = min(14, (self.discards + 5) // 6)
        a = self.app
        back, _ = (a.store.settings.get('card_back', 'red'), None)
        for k in range(layers):
            s = ImageSprite(self, 'table', DISCARD[0] + (k % 2) * 0.6, DISCARD[1] - k * 1.3,
                            ('discard', back), lambda: _discard_card(a, back))
            self.discard_sprites.append(s)

    def _maybe_shuffle(self):
        fresh = self.app.session.pop('fresh_shoe', False)
        if not (self.shoe.needs_shuffle or fresh):
            return
        self.set_status('Shuffling the shoe...')
        self.app.sound.play('shuffle')
        # discard pile flies back into the shoe
        anims = []
        for k, s in enumerate(self.discard_sprites):
            anims.append(self.move(s, SHOE[0], SHOE[1], 0.5, ease_in_out_cubic, delay=0.03 * k))
        riffle = []
        for k in range(8):
            side = -1 if k % 2 == 0 else 1
            c = CardSprite(self, 'fly', 800 + side * 90, 420, None, face_up=False)
            riffle.append(c)
        yield anims
        for s in self.discard_sprites:
            s.destroy()
        self.discard_sprites = []
        self.discards = 0
        # little riffle animation in the middle of the table
        for rep in range(2):
            moves = [self.move(c, 800, 420 - k * 1.5, 0.28, ease_in_out_cubic, delay=0.03 * k)
                     for k, c in enumerate(riffle)]
            yield moves
            moves = [self.move(c, 800 + (-1 if k % 2 == 0 else 1) * 90, 420, 0.22, ease_in_out_cubic)
                     for k, c in enumerate(riffle)]
            if rep == 0:
                yield moves
        yield [self.move(c, SHOE[0], SHOE[1], 0.35, ease_in_cubic, delay=0.02 * k) for k, c in enumerate(riffle)]
        for c in riffle:
            c.destroy()
        self.shoe.shuffle()
        self.rc = 0
        self.app.session['discards'] = 0
        # burn one card
        burn = self.shoe.burn()
        b = CardSprite(self, 'fly', SHOE[0], SHOE[1], burn, face_up=False)
        self.set_status('Burn card')
        self.app.sound.play('card_deal', 0.7)
        yield self.move(b, DISCARD[0], DISCARD[1], 0.4, ease_out_cubic)
        b.destroy()
        self.discards = 1
        self._rebuild_discard()
        self._update_count()
        self.set_status('')
        yield 0.15

    # ================================================================ decisions
    def _ask(self, ask):
        if ask.kind in ('insurance', 'even_money'):
            v = yield from self._ask_insurance(ask)
            return v
        v = yield from self._ask_action(ask)
        return v

    def _ask_insurance(self, ask):
        even = ask.kind == 'even_money'
        h = self.round.hands[0]
        self.app.sound.play('notify')
        if even:
            title = 'Even money?'
            body = (f'You have Blackjack, but the dealer shows an Ace.\n'
                    f'Take a guaranteed {fmt_money(h.bet)} now (1 to 1), or keep playing for '
                    f'{fmt_money(h.bet * self.rules.bj_num // self.rules.bj_den)} ({self.rules.bj_num} to '
                    f'{self.rules.bj_den}) - which becomes a push if the dealer has Blackjack.')
            yes, no = f'Take {fmt_money(h.bet)}', 'Play on'
        else:
            title = 'Insurance?'
            body = (f'The dealer shows an Ace. Insurance costs {fmt_money(ask.cost)} (half your bet) and pays '
                    f'2 to 1 if the dealer has Blackjack.')
            yes, no = f'Insure  {fmt_money(ask.cost)}', 'No thanks'
        can = even or ask.can_afford
        opts = {} if can else {'tooltip': 'Not enough chips'}
        m = self.modal(title, body, buttons=((yes, 'gold', True, opts), (no, 'dark', False)), icon='shield',
                       cancel=False, keys={'y': True, 'n': False} if can else {'n': False}, width=600)
        if not can:
            m.widgets[-2].set_enabled(False, 'Not enough chips')
        v = yield m.future
        self.decisions[0] += 1
        if v and self.app.store.settings.get('hints') == 'coach':
            self.coach.show('Coach', 'Basic strategy says never take insurance or even money - over time it '
                                     'costs you money (unless you are counting cards and the count is high).',
                            kind='bad')
        elif not v:
            self.decisions[1] += 1
        return bool(v)

    def _ask_action(self, ask):
        i = ask.hand
        rnd = self.round
        self.action_count += 1
        advice = self.strategy.advise(rnd, i)
        self.ask_advice = advice
        st = rnd.action_status(i)
        for a, b in self.action_btns.items():
            ok, why = st[a]
            b.set_enabled(ok, why)
            b.set_highlight(False)
            if a == 'double' and ok:
                b.set_label(f'Double')
        self.set_phase('player')
        h = rnd.hands[i]
        up = rnd.dealer[0]
        if len(self.hands) > 1:
            self.set_status(f'Hand {i + 1} of {len(self.hands)}: {total_text(h.cards)} vs dealer {up.rank}')
        else:
            self.set_status(f'Your move: {total_text(h.cards)} vs dealer {up.rank}')
        fut = Future()
        self.ask_future = fut
        action = yield fut
        self.ask_future = None
        self._judge(advice, action, h, up)
        self.set_phase('busy')
        for b in self.action_btns.values():
            b.set_highlight(False)
        return action

    def _ev_lines(self, evs):
        if not evs:
            return None
        parts = sorted(evs.items(), key=lambda kv: -kv[1])
        out = []
        for a, e in parts[:4]:
            out.append(f'{ACTION_INFO[a][0]:<10s} {e * 100:+.1f}¢ per $1')
        return ['Average result:'] + out

    def _judge(self, advice, action, h, up):
        self.decisions[0] += 1
        ok = action == advice['action']
        if ok:
            self.decisions[1] += 1
        hints = self.app.store.settings.get('hints', 'button')
        if hints == 'coach':
            if ok:
                self.coach.hide()
                self.set_status('✔ Basic strategy play')
            else:
                ideal = advice['action']
                self.coach.show(f'Coach: {ACTION_INFO[ideal][0]} was best',
                                explain(h.cards, up, ideal, self.strategy), kind='bad',
                                extra_lines=self._ev_lines(advice['evs']))
        else:
            self.coach.hide()

    def on_action(self, action):
        if self.phase != 'player' or self.ask_future is None or self.ask_future.done:
            return
        ask = self.pending_ask
        if ask is None or action not in ask.legal:
            return
        for b in self.action_btns.values():
            b.set_enabled(False)
        self.ask_future.resolve(action)

    def on_hint(self):
        if self.phase != 'player' or self.ask_advice is None or self.round is None:
            return
        adv = self.ask_advice
        i = self.pending_ask.hand if self.pending_ask is not None else self.round.current
        h = self.round.hands[i]
        up = self.round.dealer[0]
        a = adv['action']
        text = explain(h.cards, up, a, self.strategy)
        if adv['blocked']:
            text = (f'The ideal play is {ACTION_INFO[adv["ideal"]][0].upper()}, but you can\'t do that right now - '
                    f'so {ACTION_INFO[a][0].upper()}. ') + text
        self.coach.show(f'Basic strategy: {ACTION_INFO[a][0]}', text, kind='coach',
                        extra_lines=self._ev_lines(adv['evs']))
        for k, b in self.action_btns.items():
            b.set_highlight(k == a)

    # ================================================================ navigation
    def round_in_progress(self):
        return self.engine_gen is not None and self.round is not None \
            and not self.round.finished

    def _save_pending(self):
        if self.phase == 'betting' and self.bet_chips:
            self.app.session['pending_chips'] = list(self.bet_chips)

    def on_menu(self):
        if self.round_in_progress():
            m = self.modal('Leave the table?', 'A hand is in progress. If you leave now it will be finished '
                                               'automatically using basic strategy, and your balance will be saved.',
                           buttons=(('Stay', 'dark', False), ('Leave', 'red', True)), icon='info', cancel=False)

            def ch(v):
                if v:
                    self.emergency_finish()
                    self.app.go_menu()
            m.future.then(ch)
            return
        self._save_pending()
        self.app.go_menu()

    def on_settings(self):
        if self.phase != 'betting':
            return
        self._save_pending()
        from .settings import SettingsScene
        self.app.set_scene(SettingsScene, back='table')

    def on_stats(self):
        if self.phase != 'betting':
            return
        self._save_pending()
        from .stats import StatsScene
        self.app.set_scene(StatsScene, back='table')

    def before_quit(self):
        if self.round_in_progress():
            m = self.modal('Quit Blackjack?', 'Your current hand will be finished automatically (basic strategy) '
                                              'and your balance saved.',
                           buttons=(('Keep playing', 'dark', False), ('Quit', 'red', True)), icon='quit', cancel=False)
            m.future.then(lambda v: self.app.quit_now() if v else None)
            return False
        self._save_pending()
        return True

    def _finish_headless(self):
        rnd = self.round
        strat = self.strategy

        def decide(ask):
            if ask.kind == 'action':
                return strat.best_action(rnd.hands[ask.hand].cards, rnd.dealer[0], ask.legal)[0]
            return False
        first = decide(self.pending_ask) if self.pending_ask is not None else None
        gen = self.engine_gen
        self.engine_gen = None
        self.pending_ask = None
        run_headless(gen, decide, first_send=first)

    def emergency_finish(self):
        """Called when leaving / quitting in the middle of a hand."""
        if not self.round_in_progress():
            return
        if self.round_task is not None:
            self.round_task.cancel()
        try:
            self._finish_headless()
        except Exception as e:
            self.app.report_error(e)
            self.wallet.balance = self.round.balance_before
        self._after_round_bookkeeping(self.round)

    # ================================================================ keys
    def handle_key(self, key, char, state):
        k = key.lower() if len(key) == 1 else key
        if key == 'Escape':
            if self.coach.visible:
                self.coach.hide()
                return True
            self.on_menu()
            return True
        if key in ('Return', 'KP_Enter') and self.coach.next_btn is not None:
            self.coach.advance()
            return True
        if self.phase == 'betting':
            if k.isdigit() and k != '0':
                i = int(k) - 1
                if i < len(self.rack):
                    if self.rack[i].enabled:
                        self.on_chip(self.rack[i].denom)
                    else:
                        self.app.sound.play('deny')
                return True
            if key in ('space', 'Return', 'KP_Enter'):
                self.on_deal()
                return True
            if key in ('BackSpace', 'u'):
                self.on_undo()
                return True
            if k == 'c':
                self.on_clear()
                return True
            if k == 'r':
                self.on_rebet()
                return True
            if k == 'm':
                self.on_max()
                return True
            if k == 'a':
                self.on_allin()
                return True
            if k == 'x':
                self.on_x2()
                return True
        if self.phase == 'player':
            m = {'h': 'hit', 's': 'stand', 'd': 'double', 'p': 'split', 'r': 'surrender'}
            if k in m:
                b = self.action_btns[m[k]]
                if b.enabled:
                    b.flash(0.12)
                    self.app.sound.play('click')
                    self.on_action(m[k])
                else:
                    self.app.sound.play('deny')
                    if b.disabled_reason:
                        self.toast(b.disabled_reason, 'bad', 1.4)
                return True
            if k == 't' and self.btn_hint.visible:
                self.on_hint()
                return True
        return False

    def on_resized(self):
        self._place_arrow()

