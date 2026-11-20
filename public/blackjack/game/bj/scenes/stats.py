"""Statistics screen."""
from __future__ import annotations

from .. import art
from ..engine import fmt_money
from ..ui import Button, ImageSprite, TextSprite
from .common import PageScene, panel


class StatsScene(PageScene):
    name = 'stats'
    title = 'Statistics'

    def build_page(self):
        st = self.app.store
        s = st.stats
        hands = s['hands']
        decided = s['wins'] + s['losses']
        win_rate = (100.0 * s['wins'] / hands) if hands else 0.0
        acc = (100.0 * s['correct'] / s['decisions']) if s['decisions'] else None
        ret = (100.0 * (s['wagered'] + s['net']) / s['wagered']) if s['wagered'] else None
        tiles = [
            ('Balance', fmt_money(st.bankroll), f'peak {fmt_money(max(s["peak_balance"], st.bankroll))}'),
            ('Net result', fmt_money(s['net'], plus=True), f'on {fmt_money(s["wagered"])} wagered'),
            ('Hands played', f'{hands:,}', f'{s["rounds"]:,} rounds'),
            ('Win rate', f'{win_rate:.1f}%' if hands else '-', f'{s["wins"]} won · {s["losses"]} lost · {s["pushes"]} pushed'),
            ('Blackjacks', f'{s["blackjacks"]}', f'dealer had {s["dealer_blackjacks"]}'),
            ('Biggest win', fmt_money(s['biggest_win'], plus=True), 'in one round'),
            ('Biggest loss', fmt_money(s['biggest_loss']), 'in one round'),
            ('Best streak', f'{s["best_streak"]} wins', f'worst: {abs(s["worst_streak"])} losses'),
            ('Strategy accuracy', '-' if acc is None else f'{acc:.0f}%',
             f'{s["correct"]} of {s["decisions"]} decisions'),
            ('Doubles', f'{s["doubles"]}', f'{s["doubles_won"]} won'),
            ('Splits', f'{s["splits"]}', f'{s["busts"]} busts · {s["surrenders"]} surrenders'),
            ('Refills', f'{s["refills"]}', 'times you ran out of chips'),
        ]
        cols, tw, th = 4, 330, 104
        x0 = 800 - (cols * tw + (cols - 1) * 16) / 2 + tw / 2
        for i, (label, value, sub) in enumerate(tiles):
            r, c = divmod(i, cols)
            x, y = x0 + c * (tw + 16), 150 + r * (th + 14)
            panel(self, 'low', x, y, tw, th, fill=(10, 12, 16, 210), border=(233, 196, 106, 90), radius=14)
            TextSprite(self, 'mid', x - tw / 2 + 20, y - 30, label.upper(), size=12, color='#c9a85a',
                       weight='bold', anchor='w', family='num', shadow=None)
            col = '#f6ecd2'
            if label == 'Net result' and s['net']:
                col = '#8ff0a8' if s['net'] > 0 else '#ff9c8c'
            TextSprite(self, 'mid', x - tw / 2 + 20, y + 2, value, size=27, color=col, weight='bold',
                       anchor='w', family='num', shadow=None)
            TextSprite(self, 'mid', x - tw / 2 + 20, y + 33, sub, size=12.5, color='#a99f88', anchor='w',
                       shadow=None)
        # bankroll history
        hist = list(st.history[-300:])
        if not hist or hist[-1] != st.bankroll:
            hist.append(st.bankroll)
        cy = 668
        panel(self, 'low', 800, cy, 1388, 300, fill=(10, 12, 16, 210), border=(233, 196, 106, 90), radius=16)
        TextSprite(self, 'mid', 128, cy - 128, ('BALANCE OVER YOUR LAST ' + str(len(hist) - 1) + ' ROUNDS')
                   if len(hist) > 2 else 'BALANCE HISTORY', size=12,
                   color='#c9a85a', weight='bold', anchor='w', family='num', shadow=None)
        S = self.app.liveS
        start = st.settings.get('start_bankroll', 100000)
        if len(hist) >= 2:
            ImageSprite(self, 'mid', 800, cy + 14, ('histchart', tuple(hist)), lambda: art.render_line_chart(
                round(1340 * S), round(236 * S), hist, S, baseline=start))
        else:
            TextSprite(self, 'mid', 800, cy + 10, 'Play a few hands and your balance history will appear here.',
                       size=17, color='#bdb39b', shadow=None)
        TextSprite(self, 'mid', 128, 852, f'Playing since {s.get("started", "")}', size=14,
                   color='#bdb39b', anchor='w', shadow='#000000')
        Button(self, 'hud', 1400, 852, 210, 44, 'Reset statistics', 'dark', icon='trash', icon_size=16,
               font_size=14.5, on_click=self.reset)

    def reset(self):
        m = self.modal('Reset statistics?', 'All statistics and the balance history will be erased. Your balance '
                                            'stays the same.', buttons=(('Cancel', 'dark', False),
                                                                       ('Reset', 'red', True)),
                       icon='info', cancel=False)

        def done(v):
            if v:
                self.app.store.reset_stats()
                self.app.set_scene(StatsScene, fade=False, back=self.kw.get('back', 'menu'))
        m.future.then(done)
