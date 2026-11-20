"""Main menu."""
from __future__ import annotations

import math

from .. import art, gfx
from ..engine import fmt_money
from ..sprites import CARD_W, ChipStack
from ..ui import Button, ImageSprite, Scene, TextSprite
from .table import ViewImage


class MenuScene(Scene):
    name = 'menu'

    def build(self):
        a = self.app
        st = a.store
        ViewImage(self, 'bg', lambda: ('bg', a.W, a.H), lambda: gfx.background('bg.jpg', a.W, a.H, a.S, a.ox, a.oy))
        self.logo = ImageSprite(self, 'mid', 420, 128, ('logo', 96), lambda: gfx.logo(96 * a.S))
        TextSprite(self, 'mid', 420, 214, 'P L A Y - M O N E Y   C A S I N O', size=14, color='#e8cf8e',
                   weight='bold', shadow='#000000')
        items = [
            ('Play', 'gold', 'play', self.play, 'Sit down at the table', 'P'),
            ('Statistics', 'dark', 'stats', self.stats, 'Your wins, streaks and accuracy', 'S'),
            ('Settings', 'dark', 'gear', self.settings, 'Table rules, sound, speed and looks', 'E'),
            ('Quit', 'dark', 'quit', self.quit, 'Save and exit', 'Q'),
        ]
        self.buttons = []
        k = min(a.uk, 1.35)
        y = 333
        for i, (label, style, icon, cb, tip, cap) in enumerate(items):
            h = (66 if i == 0 else 54) * k
            b = Button(self, 'hud', 420, y + h / 2, 360 * k, h, label, style, icon=icon,
                       icon_size=(26 if i == 0 else 20) * k, font_size=(24 if i == 0 else 18) * k, on_click=cb,
                       tooltip=tip, keycap=cap, keycap_side='right')
            self.buttons.append(b)
            y += h + 18
        self.focus = -1
        # hero cards
        self.cards = []
        for k, (code, ang, dx, dy) in enumerate((('AS', 10, -62, 0), ('KH', -9, 62, -6))):
            spr = ImageSprite(self, 'cards', 1130 + dx, 380 + dy, ('hero', code, ang),
                              lambda code=code, ang=ang: _hero_card(a, code, ang))
            spr.base = (1130 + dx, 380 + dy)
            self.cards.append(spr)
        for k, (amt, x) in enumerate(((150000, 1040), (52500, 1130), (230000, 1222))):
            ChipStack(self, 'chips', x, 610, amt, d=64)
        self.bal_sprite = ImageSprite(self, 'mid', 1130, 702, ('balpill', st.bankroll),
                                      lambda: art.render_pill(round(330 * a.S), round(54 * a.S), (12, 12, 16, 220),
                                                              (233, 196, 106, 200)))
        TextSprite(self, 'mid', 1130, 702, f'Balance  {fmt_money(st.bankroll)}', size=21, weight='bold',
                   family='num', color='#f6e3a8')
        TextSprite(self, 'mid', 1130, 748, 'Blackjack pays 3 to 2  ·  play money only, no real gambling',
                   size=13, color='#c9bda0', shadow='#000000')
        TextSprite(self, 'mid', 1570, 880, 'F11 fullscreen  ·  M mute', size=11.5, color='#8d8470',
                   anchor='e', shadow='#000000')
        self.t = 0.0
        self.app.anim.frame_hooks.append(self._float)
        if st.first_run and not a.session.get('welcomed'):
            a.session['welcomed'] = True
            self.toast('Welcome! You start with ' + fmt_money(st.bankroll) + ' in play money', 'gold', 3.0)

    def _float(self, dt):
        if not self.alive:
            return
        self.t += dt
        for k, spr in enumerate(self.cards):
            bx, by = spr.base
            spr.move_to(bx, by + 7 * math.sin(self.t * 1.6 + k * 1.3))

    def on_destroy(self):
        if self._float in self.app.anim.frame_hooks:
            self.app.anim.frame_hooks.remove(self._float)

    # actions -------------------------------------------------------------
    def play(self):
        self.app.start_play()

    def stats(self):
        from .stats import StatsScene
        self.app.set_scene(StatsScene, back='menu')

    def settings(self):
        from .settings import SettingsScene
        self.app.set_scene(SettingsScene, back='menu')

    def quit(self):
        self.app.request_quit()

    def handle_key(self, key, char, state):
        if key in ('Down', 'Up', 'Tab'):
            n = len(self.buttons)
            if self.focus >= 0:
                self.buttons[self.focus].set_highlight(False)
            step = -1 if key == 'Up' else 1
            self.focus = (self.focus + step) % n if self.focus >= 0 else 0
            self.buttons[self.focus].set_highlight(True)
            self.app.sound.play('hover', 0.6)
            return True
        if key in ('Return', 'KP_Enter', 'space'):
            if self.focus >= 0:
                b = self.buttons[self.focus]
                b.flash()
                b.on_click()
            else:
                self.play()
            return True
        if key == 'Escape':
            self.quit()
            return True
        shortcut = {'p': self.play, 's': self.stats, 'e': self.settings, 'q': self.quit}.get(key.lower())
        if shortcut is not None:
            shortcut()
            return True
        return False


def _hero_card(a, code, ang):
    img = gfx.card(code, round(CARD_W * 1.55 * a.liveS))
    return img.rotate(ang, resample=gfx.BICUBIC, expand=True)
