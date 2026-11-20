"""Save data: bankroll, settings, statistics.  Stored as JSON next to the game
(or in your user folder if the game folder is read-only)."""
from __future__ import annotations

import json
import os
import shutil
import time

from .engine import Rules

VERSION = 1

PRESETS = {
    'classic': ('Classic Shoe', '6 decks · stands soft 17 · 3:2 · double after split · surrender',
                dict(decks=6, h17=False, bj_num=3, bj_den=2, peek=True, double_on='any', das=True,
                     max_hands=4, resplit_aces=False, hit_split_aces=False, surrender=True)),
    'bigshoe': ('Big Shoe', '8 decks · stands soft 17 · 3:2 · double after split · surrender',
                dict(decks=8, h17=False, bj_num=3, bj_den=2, peek=True, double_on='any', das=True,
                     max_hands=4, resplit_aces=False, hit_split_aces=False, surrender=True)),
    'downtown': ('Double Deck', '2 decks · hits soft 17 · 3:2 · double after split',
                 dict(decks=2, h17=True, bj_num=3, bj_den=2, peek=True, double_on='any', das=True,
                      max_hands=4, resplit_aces=False, hit_split_aces=False, surrender=False)),
    'single': ('Single Deck 6:5', '1 deck · hits soft 17 · blackjack pays only 6:5 · no double after split',
               dict(decks=1, h17=True, bj_num=6, bj_den=5, peek=True, double_on='any', das=False,
                    max_hands=2, resplit_aces=False, hit_split_aces=False, surrender=False)),
    'european': ('European', '6 decks · no hole card · double on 9-11 only · no surrender',
                 dict(decks=6, h17=False, bj_num=3, bj_den=2, peek=False, double_on='9-11', das=True,
                      max_hands=3, resplit_aces=False, hit_split_aces=False, surrender=False)),
}

DEFAULT_SETTINGS = {
    'rules': Rules().to_dict(),
    'preset': 'classic',
    'anim_speed': 'normal',       # relaxed | normal | fast | turbo
    'hints': 'button',            # off | button | coach
    'show_totals': True,
    'show_count': False,
    'intro': 'always',            # always | session | never
    'volume': 0.8,
    'muted': False,
    'felt': 'green',
    'card_back': 'red',
    'four_color': False,
    'fullscreen': False,
    'start_bankroll': 100000,
    'confirm_leave': True,
}

ANIM_MULT = {'relaxed': 0.8, 'normal': 0.5, 'fast': 0.32, 'turbo': 0.15}


def default_stats():
    return {
        'rounds': 0, 'hands': 0, 'wins': 0, 'losses': 0, 'pushes': 0, 'blackjacks': 0,
        'busts': 0, 'surrenders': 0, 'doubles': 0, 'doubles_won': 0, 'splits': 0,
        'insurance_taken': 0, 'insurance_won': 0, 'even_money': 0, 'dealer_busts': 0,
        'dealer_blackjacks': 0, 'wagered': 0, 'net': 0, 'biggest_win': 0, 'biggest_loss': 0,
        'peak_balance': 0, 'refills': 0, 'streak': 0, 'best_streak': 0, 'worst_streak': 0,
        'decisions': 0, 'correct': 0, 'started': time.strftime('%Y-%m-%d'),
    }


class Store:
    def __init__(self, base_dir):
        self.folder = self._pick_folder(base_dir)
        self.path = os.path.join(self.folder, 'save_data.json')
        self.load_warning = None
        self.settings = dict(DEFAULT_SETTINGS)
        self.settings['rules'] = dict(DEFAULT_SETTINGS['rules'])
        self.stats = default_stats()
        self.bankroll = self.settings['start_bankroll']
        self.last_bet = 0
        self.history = []
        self.first_run = True
        self.load()

    @staticmethod
    def _pick_folder(base_dir):
        try:
            test = os.path.join(base_dir, '.write_test')
            with open(test, 'w') as f:
                f.write('ok')
            os.remove(test)
            return base_dir
        except Exception:
            alt = os.path.join(os.environ.get('APPDATA') or os.path.expanduser('~'), 'BlackjackGame')
            os.makedirs(alt, exist_ok=True)
            return alt

    # ------------------------------------------------------------ io
    def load(self):
        if not os.path.exists(self.path):
            self.stats['peak_balance'] = self.bankroll
            return
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                d = json.load(f)
            s = d.get('settings', {})
            for k, v in s.items():
                if k in DEFAULT_SETTINGS:
                    self.settings[k] = v
            self.settings['rules'] = Rules.from_dict(s.get('rules', {})).to_dict()
            st = default_stats()
            st.update({k: v for k, v in d.get('stats', {}).items() if k in st})
            self.stats = st
            self.bankroll = max(0, int(d.get('bankroll', self.settings['start_bankroll'])))
            self.last_bet = max(0, int(d.get('last_bet', 0)))
            self.history = [int(x) for x in d.get('history', [])][-400:]
            self.first_run = False
            self._validate()
        except Exception:
            # keep a copy of the damaged file and start fresh
            try:
                shutil.copy(self.path, self.path + '.damaged')
            except Exception:
                pass
            self.load_warning = 'Your save file was damaged, so a fresh one was started.'

    def _validate(self):
        s = self.settings
        if s.get('anim_speed') not in ANIM_MULT:
            s['anim_speed'] = 'normal'
        if s.get('hints') not in ('off', 'button', 'coach'):
            s['hints'] = 'button'
        if s.get('intro') not in ('always', 'session', 'never'):
            s['intro'] = 'always'
        if s.get('preset') not in PRESETS and s.get('preset') != 'custom':
            s['preset'] = 'custom'
        for k in ('volume',):
            try:
                s[k] = max(0.0, min(1.0, float(s[k])))
            except Exception:
                s[k] = DEFAULT_SETTINGS[k]

    def save(self):
        d = {'version': VERSION, 'saved': time.strftime('%Y-%m-%d %H:%M:%S'), 'bankroll': self.bankroll,
             'last_bet': self.last_bet, 'settings': self.settings, 'stats': self.stats,
             'history': self.history[-400:]}
        tmp = self.path + '.tmp'
        try:
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(d, f, indent=1)
            os.replace(tmp, self.path)
        except Exception:
            pass

    # ------------------------------------------------------------ helpers
    def rules(self) -> Rules:
        return Rules.from_dict(self.settings['rules'])

    def set_rules(self, rules: Rules, preset='custom'):
        self.settings['rules'] = rules.to_dict()
        self.settings['preset'] = preset

    def anim_mult(self):
        return ANIM_MULT.get(self.settings.get('anim_speed', 'normal'), 1.0)

    def reset_bankroll(self, refill=True):
        self.bankroll = int(self.settings.get('start_bankroll', 100000))
        if refill:
            self.stats['refills'] += 1
        self.history.append(self.bankroll)
        self.save()

    def reset_stats(self):
        self.stats = default_stats()
        self.stats['peak_balance'] = self.bankroll
        self.history = [self.bankroll]
        self.save()

    def reset_all(self):
        self.settings = dict(DEFAULT_SETTINGS)
        self.settings['rules'] = dict(DEFAULT_SETTINGS['rules'])
        self.bankroll = self.settings['start_bankroll']
        self.last_bet = 0
        self.reset_stats()

    def record_round(self, rnd, decisions=None):
        """Update statistics after a finished engine Round."""
        st = self.stats
        st['rounds'] += 1
        st['wagered'] += rnd.wagered
        net = rnd.net
        st['net'] += net
        st['biggest_win'] = max(st['biggest_win'], net)
        st['biggest_loss'] = min(st['biggest_loss'], net)
        if len(rnd.hands) > 1:
            st['splits'] += len(rnd.hands) - 1
        if rnd.insurance:
            st['insurance_taken'] += 1
            if rnd.insurance_payout:
                st['insurance_won'] += 1
        if rnd.dealer_blackjack:
            st['dealer_blackjacks'] += 1
        if rnd.dealer_total > 21:
            st['dealer_busts'] += 1
        for h in rnd.hands:
            st['hands'] += 1
            r = h.result
            if r in ('win', 'blackjack', 'even_money'):
                st['wins'] += 1
            elif r == 'push':
                st['pushes'] += 1
            else:
                st['losses'] += 1
            if r == 'blackjack':
                st['blackjacks'] += 1
            if r == 'even_money':
                st['even_money'] += 1
            if r == 'bust':
                st['busts'] += 1
            if r == 'surrender':
                st['surrenders'] += 1
            if h.doubled:
                st['doubles'] += 1
                if r == 'win':
                    st['doubles_won'] += 1
        if net > 0:
            st['streak'] = st['streak'] + 1 if st['streak'] > 0 else 1
        elif net < 0:
            st['streak'] = st['streak'] - 1 if st['streak'] < 0 else -1
        st['best_streak'] = max(st['best_streak'], st['streak'])
        st['worst_streak'] = min(st['worst_streak'], st['streak'])
        if decisions:
            st['decisions'] += decisions[0]
            st['correct'] += decisions[1]
        st['peak_balance'] = max(st['peak_balance'], self.bankroll)
        self.history.append(self.bankroll)
        if len(self.history) > 400:
            self.history = self.history[-400:]
