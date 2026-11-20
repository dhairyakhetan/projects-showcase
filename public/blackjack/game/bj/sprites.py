"""Game-specific sprites shared by several screens: cards, chip stacks, chips
in the rack, the coach panel, confetti and big banners."""
from __future__ import annotations

import math
import random

from . import art, gfx
from .engine import default_chip_breakdown, fmt_money
from .ui import (Button, ImageSprite, Sprite, TextSprite, Widget, ease_in_cubic, ease_out_back, ease_out_cubic,
                 Future)

CARD_W, CARD_H = 108, 151
CHIP_D = 60
DENOMS = (500000, 100000, 50000, 10000, 2500, 500, 100, 50)



def card_settings(app):
    s = app.store.settings
    return s.get('card_back', 'red'), bool(s.get('four_color', False))


# ===================================================================== cards
class CardSprite(Sprite):
    """A playing card.  card=None shows a back.  Supports animated flips."""

    def __init__(self, scene, layer, x, y, card=None, face_up=True, rotated=False, scale=1.0, visible=True):
        self.card = card
        self.face_up = face_up and card is not None
        self.rotated = rotated
        self.scale = scale
        self.flip_sx = 1.0
        self.flip_lift = 0.0
        self.showing_face = self.face_up
        self.photo = None
        super().__init__(scene, layer, x, y, visible)

    # image management ---------------------------------------------------
    def _code(self, face):
        return self.card.code if (face and self.card is not None) else 'BACK'

    def _base_key(self, face):
        back, four = card_settings(self.app)
        return ('cardbase', self._code(face), back, four, self.rotated, self.scale)

    def _base_pil(self, face):
        back, four = card_settings(self.app)
        S = self.app.liveS
        code = self._code(face)
        w = round(CARD_W * self.scale * S)
        rot = self.rotated
        return self.app.assets.pil_image(self._base_key(face), lambda: gfx.card(
            code, w, back=back, four_color=four, rotated=rot))

    def _photo(self):
        face = self.showing_face
        sx = self.flip_sx
        if sx >= 0.999 and self.flip_lift <= 0.001:
            key = self._base_key(face)
            return self.app.assets.photo(key, lambda: self._base_pil(face))
        q = max(0.06, round(sx * 12) / 12.0)
        lq = round(0.07 * (1 - q * q) ** 0.5, 3)      # lift follows from the squash
        key = self._base_key(face) + ('flip', q)
        return self.app.assets.photo_lru(key, lambda: gfx.flip_frame(self._base_pil(face), q, lq))

    def _create(self):
        self.photo = self._photo()
        px, py = self.P()
        return [self.c.create_image(px, py, image=self.photo)]

    def refresh(self):
        if self.items:
            self.photo = self._photo()
            self.c.itemconfigure(self.items[0], image=self.photo)

    def sync(self):
        if self.items:
            self.c.coords(self.items[0], *self.P())

    # animation --------------------------------------------------------------
    def flip_to(self, face_up, dur=0.26, delay=0.0, sound=True):
        """Animate turning the card over.  Returns a Future."""
        face_up = face_up and self.card is not None
        if face_up == self.showing_face:
            f = Future()
            f.resolve()
            self.face_up = face_up
            return f
        start_face = self.showing_face
        played = [False]

        def step(t):
            if not self.alive:
                return
            if sound and not played[0] and t > 0.05:
                played[0] = True
                self.app.sound.play('card_flip')
            a = math.pi * t
            self.flip_sx = abs(math.cos(a))
            self.flip_lift = 0.07 * math.sin(a)
            self.showing_face = start_face if t < 0.5 else face_up
            if t >= 1.0:
                self.flip_sx, self.flip_lift = 1.0, 0.0
            self.refresh()
        self.face_up = face_up
        return self.scene.tween(dur, step, lambda t: t, delay=delay)


def warm_cards(scene):
    """Task: scale every card image (and the card-back flip frames) in small
    slices while the player is still betting, so nothing has to be prepared in
    the middle of a deal animation."""
    from .engine import RANKS, SUITS
    app = scene.app
    back, four = card_settings(app)
    w = round(CARD_W * app.liveS)
    codes = ['BACK'] + [r + s for s in SUITS for r in RANKS]
    yield 0.25

    def calm():
        # only work while nothing is moving, so the warm-up never causes a hitch
        return getattr(scene, 'phase', 'betting') == 'betting' and not getattr(scene, 'inflight', None)

    for code in codes:
        while not calm():
            yield 0.1
        key = ('cardbase', code, back, four, False, 1.0)
        pil = app.assets.pil_image(key, lambda code=code: gfx.card(code, w, back=back, four_color=four))
        app.assets.photo(key, lambda pil=pil: pil)
        if code == 'BACK':
            for k in range(0, 13):
                q = max(0.06, k / 12.0)
                lq = round(0.07 * (1 - q * q) ** 0.5, 3)
                app.assets.photo_lru(key + ('flip', q), lambda pil=pil, q=q, lq=lq: gfx.flip_frame(pil, q, lq))
        yield 0.01
    for den in DENOMS:
        for shadow in (True, False):
            while not calm():
                yield 0.1
            chip_photo(app, den, CHIP_D, shadow)
            yield 0.01


# ===================================================================== chips
def chip_photo(app, denom, d, shadow):
    S = app.S
    px = max(6, round(d * S))
    return app.assets.photo(('chip', denom, d, shadow), lambda: gfx.chip(denom, px, shadow))


def chip_thickness(app, d):
    return max(2, int(round(round(d * app.S) * 0.085))) / app.S


class ChipStack(Sprite):
    """A stack (or several columns) of chips representing an amount."""

    def __init__(self, scene, layer, x, y, amount, d=CHIP_D, label=False, max_col=11, visible=True,
                 label_side='right'):
        self.amount = int(amount)
        self.d = d
        self.label = label
        self.max_col = max_col
        self.label_side = label_side
        super().__init__(scene, layer, x, y, visible)

    def chips(self):
        return default_chip_breakdown(self.amount, DENOMS)

    def _columns(self):
        chips = self.chips()
        if not chips:
            return []
        cols = []
        while chips:
            cols.append(chips[:self.max_col])
            chips = chips[self.max_col:]
        return cols

    def _create(self):
        out = []
        cols = self._columns()
        if not cols:
            return out
        t = chip_thickness(self.app, self.d)
        n = len(cols)
        spacing = self.d * 0.92
        self._photos = []
        for ci, col in enumerate(cols):
            cx = self.x + (ci - (n - 1) / 2) * spacing
            for k, den in enumerate(col):
                shadow = k == 0
                ph = chip_photo(self.app, den, self.d, shadow)
                self._photos.append(ph)
                # chip face centre: y - k*t ; image is centred on the whole chip incl. edge
                pad_px = art.chip_pad(round(self.d * self.app.S)) if shadow else 0
                py = self.y - k * t
                cy = py + (t / 2)
                x_px, y_px = self.scene.P(cx, cy)
                if shadow:
                    # shadowed image: chip offset by pad in both directions
                    w, h = ph.size
                    out.append(self.c.create_image(x_px, y_px, image=ph))
                else:
                    out.append(self.c.create_image(x_px, y_px, image=ph))
        if self.label and self.amount > 0:
            top = len(cols[0]) if cols else 0
            lx = self.x + (n - 1) / 2 * spacing + self.d * 0.5 + 6 if self.label_side == 'right' else self.x
            ly = self.y if self.label_side == 'right' else self.y - top * t - self.d * 0.62
            text = fmt_money(self.amount)
            f = self.app.font(14, 'bold', 'num')
            tw = f.measure(text) / self.app.S + 18
            S = self.app.liveS
            ph = self.app.assets.photo(('stacklbl', round(tw)), lambda: art.render_pill(
                round(tw * S), round(24 * S), (12, 12, 14, 225), (233, 196, 106, 160)))
            self._photos.append(ph)
            ax = lx + (tw / 2 if self.label_side == 'right' else 0)
            out.append(self.c.create_image(*self.scene.P(ax, ly), image=ph))
            out.append(self.c.create_text(*self.scene.P(ax, ly), text=text, font=f, fill='#f6e7c1'))
        return out

    def sync(self):
        self.remount()

    def move_to(self, x, y):
        dx, dy = (x - self.x) * self.app.S, (y - self.y) * self.app.S
        self.x, self.y = float(x), float(y)
        for it in self.items:
            self.c.move(it, dx, dy)

    def set_amount(self, amount):
        amount = int(amount)
        if amount == self.amount:
            return
        self.amount = amount
        if self.alive:
            self.remount()
            # keep z-order: remount puts items at top of layer (fine for stacks)

    def top_y(self):
        cols = self._columns()
        n = len(cols[0]) if cols else 0
        return self.y - n * chip_thickness(self.app, self.d)


class ChipButton(Widget):
    """A clickable chip in the betting rack."""

    def __init__(self, scene, layer, x, y, denom, on_click, d=66, hotkey=None):
        self.denom = denom
        self.callback = on_click
        self.d = d
        self.lift = 0.0
        self.hotkey = hotkey
        super().__init__(scene, layer, x, y, d + 6, d + 14,
                         tooltip=f'Add {fmt_money(denom)}' + (f'   [{hotkey}]' if hotkey else ''))

    def _create(self):
        self._ph = chip_photo(self.app, self.denom, self.d, True)
        self._ph_dis = self.app.assets.photo(('chip_dis', self.denom, self.d), lambda: _grey(
            gfx.chip(self.denom, max(6, round(self.d * self.app.S)), True)))
        out = [self.c.create_image(*self.scene.P(self.x, self.y - self.lift),
                                   image=self._ph if self.enabled else self._ph_dis)]
        if self.hotkey:
            f = self.app.font(10.5, 'bold')
            out.append(self.c.create_text(*self.scene.P(self.x, self.y + self.d / 2 + 9), text=self.hotkey,
                                          font=f, fill='#9c927c'))
        return out

    def _apply_state(self):
        if not self.items:
            return
        self.c.itemconfigure(self.items[0], image=self._ph if self.enabled else self._ph_dis)
        target = 7.0 if (self.hovered and self.enabled) else 0.0
        if self.pressed:
            target = 3.0
        start = self.lift

        def f(t):
            self.lift = start + (target - start) * t
            if self.items:
                self.c.coords(self.items[0], *self.scene.P(self.x, self.y - self.lift))
        self.scene.ui_tween(0.12, f)

    def sync(self):
        if self.items:
            self.c.coords(self.items[0], *self.scene.P(self.x, self.y - self.lift))

    def on_click(self):
        if self.callback:
            self.callback(self.denom)


def _grey(img):
    g = img.convert('LA').convert('RGBA')
    g.putalpha(img.split()[3].point(lambda v: int(v * 0.45)))
    return g


# ===================================================================== coach panel
class CoachPanel:
    """Left-side panel used for hints and coaching."""

    def __init__(self, scene, x=200, y=318, w=356, h=262, layer='hud2'):
        self.scene = scene
        self.x, self.y, self.w, self.h = x, y, w, h
        self.layer = layer
        self.parts = []
        self.visible = False
        self.next_btn = None
        self.future = None

    def show(self, title, text, next_label=None, kind='coach', extra_lines=None):
        """Show the panel. If next_label is given, returns a Future resolved when
        the button is clicked (or when .advance() is called)."""
        self.hide(keep_future=True)
        sc = self.scene
        S = sc.app.liveS
        x, y, w, h = self.x, self.y, self.w, self.h
        border = {'coach': (233, 196, 106, 180), 'good': (110, 210, 130, 200), 'bad': (240, 120, 100, 200)}.get(kind, (233, 196, 106, 180))
        panel = ImageSprite(sc, self.layer, x, y, ('coachp', w, h, border), lambda: art.render_panel(
            round(w * S), round(h * S), radius=16 * S, fill=(10, 12, 16, 228), border=border, border_w=1.6 * S))
        icon = {'coach': 'hint', 'good': 'check', 'bad': 'cross'}.get(kind, 'hint')
        ic = ImageSprite(sc, self.layer, x - w / 2 + 26, y - h / 2 + 28, ('coachi', icon, border),
                         lambda: art.render_icon(icon, round(22 * S), border[:3]))
        t1 = TextSprite(sc, self.layer, x - w / 2 + 46, y - h / 2 + 28, title, size=17, weight='bold',
                        family='display', color=art.hexcolor(border[:3]), anchor='w')
        t2 = TextSprite(sc, self.layer, x - w / 2 + 20, y - h / 2 + 52, text, size=15, color='#ece4d2',
                        anchor='nw', width=w - 40, shadow=None)
        self.parts = [panel, ic, t1, t2]
        if extra_lines:
            yy = y + h / 2 - (54 if next_label else 18) - 18 * (len(extra_lines) - 1)
            for line in extra_lines:
                self.parts.append(TextSprite(sc, self.layer, x - w / 2 + 20, yy, line, size=13,
                                             color='#bfb6a2', anchor='w', shadow=None, family='mono'))
                yy += 18
        if next_label:
            if self.future is None or self.future.done:
                self.future = Future()
            fut = self.future
            self.next_btn = Button(sc, self.layer, x + w / 2 - 74, y + h / 2 - 30, 124, 38, next_label, 'gold',
                                   on_click=self.advance, font_size=15, hotkey='Return')
            self.parts.append(self.next_btn)
        self.visible = True
        return self.future if next_label else None

    def advance(self):
        f = self.future
        self.future = None
        if self.next_btn is not None:
            btn = self.next_btn
            self.next_btn = None
            if btn in self.parts:
                self.parts.remove(btn)
            btn.destroy()
        if f is not None and not f.done:
            f.resolve(True)

    def hide(self, keep_future=False):
        for p in self.parts:
            p.destroy()
        self.parts = []
        self.next_btn = None
        self.visible = False
        if not keep_future and self.future is not None and not self.future.done:
            self.future.resolve(False)
            self.future = None

    def text_height(self):
        return 0


# ===================================================================== effects
class Confetti:
    COLORS = ('#f2c94c', '#eb5757', '#56ccf2', '#6fcf97', '#bb6bd9', '#ffffff', '#f2994a')

    def __init__(self, scene, n=90, x0=0, x1=1600, y=-20, burst=None):
        self.scene = scene
        self.c = scene.c
        self.parts = []
        rnd = random.Random()
        for i in range(n):
            if burst:
                bx, by = burst
                ang = rnd.uniform(-math.pi * 0.95, -math.pi * 0.05)
                sp = rnd.uniform(250, 720)
                p = [bx, by, math.cos(ang) * sp, math.sin(ang) * sp]
            else:
                p = [rnd.uniform(x0, x1), y - rnd.uniform(0, 300), rnd.uniform(-60, 60), rnd.uniform(60, 240)]
            p += [rnd.uniform(0, 6.28), rnd.uniform(-9, 9), rnd.uniform(6, 13), rnd.uniform(3, 6),
                  rnd.choice(self.COLORS), rnd.uniform(2.4, 3.6)]
            item = self.c.create_polygon(0, 0, 0, 0, 0, 0, fill=p[8], outline='')
            self.c.tag_lower(item, scene.sentinel['fx'])
            self.parts.append([item] + p)
        self.age = 0.0
        scene.app.anim.frame_hooks.append(self.step)

    def step(self, dt):
        if not self.scene.alive:
            self.stop()
            return
        self.age += dt
        S = self.scene.app.liveS
        alive = 0
        for p in self.parts:
            item, x, y, vx, vy, a, va, w, h, col, life = p
            if self.age > life:
                if item:
                    self.c.delete(item)
                    p[0] = None
                continue
            alive += 1
            vy += 420 * dt
            vx *= (1 - 0.9 * dt)
            vy = min(vy, 420)
            x += vx * dt
            y += vy * dt
            a += va * dt
            p[1:7] = [x, y, vx, vy, a, va]
            sx = abs(math.cos(a * 1.3))
            cw, ch = w * 0.5 * max(0.15, sx), h * 0.5
            ca, sa = math.cos(a), math.sin(a)
            pts = []
            for dx, dy in ((-cw, -ch), (cw, -ch), (cw, ch), (-cw, ch)):
                X = x + dx * ca - dy * sa
                Y = y + dx * sa + dy * ca
                pts.extend(self.scene.P(X, Y))
            try:
                self.c.coords(item, *pts)
            except Exception:
                pass
        if alive == 0:
            self.stop()

    def stop(self):
        if self.step in self.scene.app.anim.frame_hooks:
            self.scene.app.anim.frame_hooks.remove(self.step)
        for p in self.parts:
            if p[0]:
                try:
                    self.c.delete(p[0])
                except Exception:
                    pass
                p[0] = None


def banner(scene, text, color='#f2d07a', size=58, y=455, hold=0.9, sub=None, sub_color='#f4ecd8'):
    """Big animated text in the middle of the table. Returns the Future of the whole animation."""
    t = TextSprite(scene, 'fx', 800, y, text, size=size * 0.5, weight='bold', family='display', color=color,
                   shadow='#000000', shadow_off=3)
    s2 = None
    if sub:
        s2 = TextSprite(scene, 'fx', 800, y + size * 0.72, sub, size=size * 0.36, weight='bold', family='num',
                        color=sub_color, shadow='#000000', shadow_off=2)
        s2.set_visible(False)

    def grow(k):
        if t.alive:
            t.set_size(size * (0.5 + 0.5 * k))

    def run():
        yield scene.ui_tween(0.32, grow, ease_out_back)
        if s2:
            s2.set_visible(True)
        yield scene.app.anim.wait(hold, 'ui', owner=scene)

        def out(k):
            if t.alive:
                t.move_to(800, y - 30 * k)
                t.set_size(size * (1 - 0.35 * k))
            if s2 and s2.alive:
                s2.move_to(800, y + size * 0.72 - 30 * k)
        yield scene.ui_tween(0.25, out, ease_in_cubic)
        t.destroy()
        if s2:
            s2.destroy()
    return scene.run(run())


class CountingText:
    """Animates a money value counting up/down in a TextSprite."""

    def __init__(self, scene, sprite, value, fmt=fmt_money):
        self.scene = scene
        self.sprite = sprite
        self.value = value
        self.fmt = fmt
        self._tw = None
        sprite.set_text(fmt(value))

    def set(self, value, dur=0.6):
        start = self.value
        self.value = value
        if self._tw is not None:
            self._tw.cancel()
        if dur <= 0 or start == value:
            self.sprite.set_text(self.fmt(value))
            return

        def f(t):
            if self.sprite.alive:
                self.sprite.set_text(self.fmt(int(round(start + (value - start) * t))))
        self._tw = self.scene.ui_tween(dur, f, ease_out_cubic)
