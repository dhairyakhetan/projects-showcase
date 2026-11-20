"""Settings: table rules (with presets), gameplay, sound, display, data."""
from __future__ import annotations

import sys
import threading

from .. import art
from ..engine import Rules, fmt_money
from ..sprites import CARD_H, CARD_W, CardSprite
from ..engine import Card
from ..store import PRESETS
from ..ui import Button, ImageSprite, Segmented, Slider, TextSprite, Toggle
from .common import PageScene, panel

TABS = [('rules', 'Table Rules', 'cards'), ('game', 'Gameplay', 'play'), ('sound', 'Sound', 'sound'),
        ('display', 'Display', 'eye'), ('data', 'Save Data', 'info')]


class SettingsScene(PageScene):
    name = 'settings'
    title = 'Settings'

    def build_page(self):
        self.tab = self.kw.get('tab') or self.app.session.get('settings_tab', 'rules')
        panel(self, 'low', 940, 470, 1240, 760)
        self.tab_btns = {}
        for i, (key, label, icon) in enumerate(TABS):
            b = Button(self, 'hud', 170, 150 + i * 58, 230, 48, label, 'ghost', icon=icon, icon_size=18,
                       font_size=16, on_click=lambda k=key: self.show_tab(k))
            self.tab_btns[key] = b
        self.items = []
        self.show_tab(self.tab)

    def show_tab(self, key):
        self.tab = key
        self.app.session['settings_tab'] = key
        for k, b in self.tab_btns.items():
            b.set_style('gold' if k == key else 'ghost')
        for s in self.items:
            s.destroy()
        self.items = []
        getattr(self, '_tab_' + key)()

    def on_resized(self):
        self.show_tab(self.tab)

    def add(self, s):
        self.items.append(s)
        return s

    # --------------------------------------------------------------- row helpers
    def row(self, col, y, label, desc=None):
        x = 350 if col == 0 else 950
        self.add(TextSprite(self, 'mid', x, y - (9 if desc else 0), label, size=17, weight='bold', color='#f3e8cc',
                            anchor='w', shadow=None))
        if desc:
            self.add(TextSprite(self, 'mid', x, y + 13, desc, size=12.5, color='#a99f88', anchor='w', shadow=None))
        return x

    def seg(self, col, y, label, desc, options, value, cb, seg_w=78, right=None):
        self.row(col, y, label, desc)
        n = len(options)
        w = seg_w * n
        right = right or (900 if col == 0 else 1530)
        return self.add(Segmented(self, 'hud', right - w / 2, y, options, value, on_change=cb, seg_w=seg_w, h=36,
                                  font_size=14))

    def toggle(self, col, y, label, desc, value, cb, right=None):
        self.row(col, y, label, desc)
        right = right or (900 if col == 0 else 1530)
        return self.add(Toggle(self, 'hud', right - 32, y, value, on_change=cb))

    def heading(self, x, y, text):
        self.add(TextSprite(self, 'mid', x, y, text, size=13, color='#c9a85a', weight='bold', anchor='w',
                            family='num', shadow=None))

    # --------------------------------------------------------------- rules tab
    def _tab_rules(self):
        st = self.app.store
        r = st.rules()
        preset = st.settings.get('preset', 'custom')
        self.heading(350, 118, 'PRESET TABLES')
        keys = list(PRESETS.keys())
        bw = 222
        for i, k in enumerate(keys):
            name, desc, _ = PRESETS[k]
            x = 350 + bw / 2 + i * (bw + 10)
            b = self.add(Button(self, 'hud', x, 158, bw, 44, name, 'gold' if k == preset else 'dark',
                                font_size=15, on_click=lambda k=k: self.apply_preset(k), tooltip=desc))
        pdesc = PRESETS[preset][1] if preset in PRESETS else 'Custom rules'
        self.add(TextSprite(self, 'mid', 350, 198, ('Current: ' + pdesc) if preset in PRESETS else
                            'Custom rules (you changed something below)', size=13.5, color='#d9cfb4', anchor='w',
                            shadow=None))
        self.heading(350, 238, 'THE GAME')
        self.heading(950, 238, 'THE DEALER & YOUR OPTIONS')
        y0, dy = 284, 66
        self.seg(0, y0, 'Decks in the shoe', 'More decks = slightly better for the house',
                 [(1, '1'), (2, '2'), (4, '4'), (6, '6'), (8, '8')], r.decks, lambda v: self.set_rule(decks=v), 52)
        self.seg(0, y0 + dy, 'Blackjack pays', '6:5 tables cost you far more than any other rule',
                 [((3, 2), '3 : 2'), ((6, 5), '6 : 5')], (r.bj_num, r.bj_den),
                 lambda v: self.set_rule(bj_num=v[0], bj_den=v[1]), 90)
        self.seg(0, y0 + dy * 2, 'Shuffle when', 'Share of the shoe dealt first',
                 [(0.5, '50%'), (0.65, '65%'), (0.75, '75%'), (0.85, '85%')], round(r.penetration, 2),
                 lambda v: self.set_rule(penetration=v), 62)
        self.seg(0, y0 + dy * 3, 'Minimum bet', None,
                 [(500, '$5'), (1000, '$10'), (2500, '$25'), (10000, '$100')], r.min_bet,
                 lambda v: self.set_rule(min_bet=v, max_bet=max(v * 10, r.max_bet)), 70)
        self.seg(0, y0 + dy * 4, 'Maximum bet', None,
                 [(50000, '$500'), (100000, '$1K'), (500000, '$5K'), (1000000, '$10K')], r.max_bet,
                 lambda v: self.set_rule(max_bet=max(v, r.min_bet * 2)), 70)
        self.toggle(0, y0 + dy * 5, 'Insurance offered', 'Side bet when the dealer shows an Ace', r.insurance,
                    lambda v: self.set_rule(insurance=v))
        self.toggle(0, y0 + dy * 6, '10-value cards split', 'Allow splitting K + Q, J + 10, ...', r.split_by_value,
                    lambda v: self.set_rule(split_by_value=v))
        self.seg(1, y0, 'Soft 17', 'Ace + 6: does the dealer hit it?', [(False, 'Stands'), (True, 'Hits')],
                 r.h17, lambda v: self.set_rule(h17=v), 92)
        self.seg(1, y0 + dy, 'Hole card', 'European dealers take no hole card',
                 [(True, 'US (peek)'), (False, 'European')], r.peek, lambda v: self.set_rule(peek=v), 112)
        self.seg(1, y0 + dy * 2, 'Double down on', None, [('any', 'Any 2'), ('9-11', '9 – 11'),
                                                         ('10-11', '10 – 11')], r.double_on,
                 lambda v: self.set_rule(double_on=v), 86)
        self.toggle(1, y0 + dy * 3, 'Double after split', 'Allowed to double a hand created by a split', r.das,
                    lambda v: self.set_rule(das=v))
        self.seg(1, y0 + dy * 4, 'Split up to', None, [(2, '2 hands'), (3, '3 hands'), (4, '4 hands')],
                 r.max_hands, lambda v: self.set_rule(max_hands=v), 92)
        t = self.toggle(1, y0 + dy * 5, 'Late surrender', 'Give up half your bet' +
                        ('' if r.peek else ' (needs US hole card)'), r.surrender, lambda v: self.set_rule(surrender=v))
        if not r.peek:
            t.set_enabled(False, 'Surrender needs the dealer to peek (US hole card)')
        self.toggle(1, y0 + dy * 6, 'Re-split Aces', None, r.resplit_aces, lambda v: self.set_rule(resplit_aces=v))
        self.toggle(1, y0 + dy * 6.75 + 8, 'Hit split Aces', None, r.hit_split_aces,
                    lambda v: self.set_rule(hit_split_aces=v))
        self.add(TextSprite(self, 'mid', 940, 838, 'Rule changes take effect from your next hand.  ' + r.short(),
                            size=13, color='#bdb39b', shadow=None, family='num'))

    def set_rule(self, **kw):
        st = self.app.store
        r = st.rules().copy(**kw)
        name = 'custom'
        for k, (_, _, d) in PRESETS.items():
            if all(getattr(r, f) == v for f, v in d.items()):
                name = k
                break
        st.set_rules(r, name)
        st.save()
        self.show_tab('rules')

    def apply_preset(self, key):
        st = self.app.store
        _, _, d = PRESETS[key]
        r = st.rules().copy(**d)
        st.set_rules(r, key)
        st.save()
        self.app.sound.play('chips_stack', 0.6)
        self.show_tab('rules')

    # --------------------------------------------------------------- gameplay
    def _tab_game(self):
        s = self.app.store.settings
        self.heading(350, 118, 'GAMEPLAY')
        y0, dy = 170, 76

        def set_(k):
            def f(v):
                s[k] = v
                self.app.store.save()
            return f
        self.seg(0, y0, 'Animation speed', 'How fast cards and chips move',
                 [('relaxed', 'Relaxed'), ('normal', 'Normal'), ('fast', 'Fast'), ('turbo', 'Turbo')],
                 s.get('anim_speed', 'normal'), set_('anim_speed'), 100, right=1530)
        self.seg(0, y0 + dy, 'Strategy help', 'Hint button, or a coach that flags every mistake',
                 [('off', 'Off'), ('button', 'Hint button'), ('coach', 'Coach')], s.get('hints', 'button'),
                 set_('hints'), 116, right=1530)
        self.seg(0, y0 + dy * 2, 'Walk-in intro', 'The animation when you press Play',
                 [('always', 'Every time'), ('session', 'Once per launch'), ('never', 'Never')],
                 s.get('intro', 'always'), set_('intro'), 130, right=1530)
        self.seg(0, y0 + dy * 3, 'Fresh bankroll', 'Amount you get when you refill or reset',
                 [(50000, '$500'), (100000, '$1,000'), (500000, '$5,000'), (1000000, '$10,000')],
                 s.get('start_bankroll', 100000), set_('start_bankroll'), 92, right=1530)
        self.toggle(0, y0 + dy * 4, 'Show hand totals', 'Badges with the total of each hand',
                    s.get('show_totals', True), set_('show_totals'), right=1530)
        self.toggle(0, y0 + dy * 5, 'Show card count', 'Hi-Lo running & true count for counting practice',
                    s.get('show_count', False), set_('show_count'), right=1530)

    # --------------------------------------------------------------- sound
    def _tab_sound(self):
        a = self.app
        s = a.store.settings
        snd = a.sound
        self.heading(350, 118, 'SOUND')
        y0, dy = 176, 80
        self.row(0, y0, 'Master volume', 'All sound effects')
        self.vol_label = self.add(TextSprite(self, 'mid', 1300, y0, f'{int(s.get("volume", 0.8) * 100)}%', size=16,
                                             color='#f3e8cc', anchor='w', family='num', shadow=None))

        def vol(v):
            s['volume'] = round(v, 2)
            self.vol_label.set_text(f'{int(v * 100)}%')
            a.apply_audio_settings()

        def vol_done(v):
            a.store.save()
            a.sound.play('chip')
        self.add(Slider(self, 'hud', 1040, y0, 420, s.get('volume', 0.8), on_change=vol, on_release=vol_done))

        def mute(v):
            s['muted'] = v
            a.apply_audio_settings()
            a.store.save()
        self.row(0, y0 + dy, 'Mute everything', 'Shortcut: M')
        self.add(Toggle(self, 'hud', 1218, y0 + dy, s.get('muted', False), on_change=mute))
        self.add(Button(self, 'hud', 450, y0 + dy * 2, 200, 44, 'Test sound', 'dark', icon='sound', icon_size=18,
                        font_size=15, on_click=lambda: a.sound.play('blackjack')))
        self.heading(350, y0 + dy * 3 - 10, 'SOUND ENGINE')
        info = f'Playing sound with: {snd.backend_name}.'
        if snd.backend_name not in ('pygame mixer', 'Web Audio'):
            info += '  Installing pygame gives the smoothest, layered sound.'
        self.add(TextSprite(self, 'mid', 350, y0 + dy * 3 + 24, info, size=15, color='#e3dac4', anchor='w',
                            shadow=None))
        if snd.backend_name not in ('pygame mixer', 'Web Audio'):
            self.pip_btn = self.add(Button(self, 'hud', 480, y0 + dy * 4 + 10, 260, 46, 'Install pygame', 'blue',
                                           icon='sound', icon_size=18, font_size=15, on_click=self.install_pygame,
                                           tooltip='Runs: python -m pip install pygame'))

    def install_pygame(self):
        from ..boot import _pip_install
        self.pip_btn.set_enabled(False, 'Installing...')
        self.pip_btn.set_label('Installing...')
        res = {}

        def work():
            res['r'] = _pip_install(['pygame'])

        def check():
            if 'r' not in res:
                self.app.root.after(300, check)
                return
            ok, out = res['r']
            if not self.alive:
                return
            if ok:
                self.modal('pygame installed', 'Restart the game to switch to the better sound engine.',
                           buttons=(('OK', 'gold', True),), icon='check', cancel=True, default=True)
                if self.pip_btn.alive:
                    self.pip_btn.set_label('Installed')
            else:
                self.modal('Could not install pygame', 'You can install it yourself from a terminal:\n'
                                                      'py -m pip install pygame', buttons=(('OK', 'gold', True),),
                           icon='info', cancel=True, default=True)
                if self.pip_btn.alive:
                    self.pip_btn.set_label('Install pygame')
                    self.pip_btn.set_enabled(True)
        threading.Thread(target=work, daemon=True).start()
        self.app.root.after(300, check)

    # --------------------------------------------------------------- display
    def _tab_display(self):
        a = self.app
        s = a.store.settings
        self.heading(350, 118, 'DISPLAY')
        y0, dy = 176, 84

        def set_(k, reset_assets=False):
            def f(v):
                s[k] = v
                a.store.save()
                a.assets.clear()
                self.show_tab('display')
            return f
        felt = s.get('felt', 'green')
        self.row(0, y0, 'Table felt', 'Colour of the table cloth')
        for i, (k, (c1, c2)) in enumerate(art.FELTS.items()):
            x = 930 + i * 92
            S = a.liveS
            self.add(Button(self, 'hud', x, y0, 80, 44, k.title(), 'gold' if k == felt else 'dark', font_size=13.5,
                            on_click=lambda k=k: set_('felt')(k)))
        back = s.get('card_back', 'red')
        self.row(0, y0 + dy, 'Card back', 'Pattern on the back of the cards')
        for i, k in enumerate(art.BACKS):
            x = 930 + i * 92
            self.add(Button(self, 'hud', x, y0 + dy, 80, 44, k.title(), 'gold' if k == back else 'dark',
                            font_size=13.5, on_click=lambda k=k: set_('card_back')(k)))
        self.row(0, y0 + dy * 2, 'Four-colour deck', 'Diamonds blue, clubs green - easier to read')
        self.add(Toggle(self, 'hud', 1218, y0 + dy * 2, s.get('four_color', False),
                        on_change=set_('four_color')))
        self.row(0, y0 + dy * 3, 'Fullscreen', 'Shortcut: F11')
        self.add(Toggle(self, 'hud', 1218, y0 + dy * 3, a.is_fullscreen(),
                        on_change=lambda v: a.toggle_fullscreen(v)))
        # preview
        self.heading(350, y0 + dy * 4 - 6, 'PREVIEW')
        for i, code in enumerate(['AS', 'KH', '10D', '7C', 'BACK']):
            card = None if code == 'BACK' else Card.parse(code)
            self.add(CardSprite(self, 'cards', 420 + i * 120, y0 + dy * 4 + 96, card, face_up=card is not None,
                                scale=0.95))
        S = a.liveS
        c1, c2 = art.FELTS.get(felt, art.FELTS['green'])
        self.add(ImageSprite(self, 'low', 1270, y0 + dy * 4 + 96, ('feltprev', felt), lambda: art.render_panel(
            round(440 * S), round(190 * S), radius=20 * S, fill=c1 + (255,), border=(110, 72, 40, 255),
            border_w=8 * S)))
        self.add(TextSprite(self, 'mid', 1270, y0 + dy * 4 + 96, 'BLACKJACK PAYS 3 TO 2', size=20,
                            family='display', weight='bold', color='#e2c27a', shadow=None))

    # --------------------------------------------------------------- data
    def _tab_data(self):
        a = self.app
        st = a.store
        self.heading(350, 118, 'SAVE DATA')
        self.add(TextSprite(self, 'mid', 350, 166, f'Balance: {fmt_money(st.bankroll)}     '
                                                  f'Hands played: {st.stats["hands"]}     '
                                                  f'Refills: {st.stats["refills"]}', size=17, color='#f3e8cc',
                            anchor='w', shadow=None, family='num'))
        self.add(TextSprite(self, 'mid', 350, 200, 'Saved in: ' + st.path, size=13, color='#a99f88', anchor='w',
                            shadow=None, family='mono'))
        y = 270
        for label, desc, cb, style in (
                ('Reset balance', f'Back to {fmt_money(st.settings.get("start_bankroll", 100000))}. Stats are kept.',
                 self.reset_balance, 'dark'),
                ('Reset statistics', 'Clears all stats and the bankroll history. Balance is kept.',
                 self.reset_stats, 'dark'),
                ('Reset everything', 'Balance, statistics and all settings back to default.', self.reset_all, 'red')):
            self.add(Button(self, 'hud', 470, y, 230, 48, label, style, font_size=16, on_click=cb))
            self.add(TextSprite(self, 'mid', 610, y, desc, size=15, color='#d9cfb4', anchor='w', shadow=None))
            y += 80

    def _confirm(self, title, body, cb):
        m = self.modal(title, body, buttons=(('Cancel', 'dark', False), ('Yes, reset', 'red', True)), icon='info',
                       cancel=False)
        m.future.then(lambda v: (cb(), self.show_tab('data')) if v else None)

    def reset_balance(self):
        def do():
            self.app.store.reset_bankroll(refill=False)
            self.app.sound.play('cash')
            self.toast('Balance reset', 'good', 1.5)
        self._confirm('Reset balance?', 'Your balance goes back to the starting amount.', do)

    def reset_stats(self):
        def do():
            self.app.store.reset_stats()
            self.toast('Statistics cleared', 'good', 1.5)
        self._confirm('Reset statistics?', 'All statistics and the bankroll history will be erased.', do)

    def reset_all(self):
        def do():
            self.app.store.reset_all()
            self.app.store.save()
            self.app.session.clear()
            self.app.apply_audio_settings()
            self.app.assets.clear()
            self.toast('Everything reset', 'good', 1.5)
        self._confirm('Reset everything?', 'Balance, statistics and settings all go back to how they were on the '
                                           'first launch.', do)
