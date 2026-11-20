"""The 'Play' intro: our guy walks into the casino and sits down at the table."""
from __future__ import annotations


from .. import art, gfx
from ..ui import ImageSprite, Scene, TextSprite, ease_out_back, linear
from .table import TableScene, ViewImage

SPEED = 380.0          # design px / second


class IntroScene(Scene):
    name = 'intro'

    def build(self):
        a = self.app
        a.session['intro_seen'] = True
        m = gfx.meta()['intro']
        self.m = m
        self.nframes = m['frames']
        ViewImage(self, 'bg', lambda: ('intro_bg', a.W, a.H),
                  lambda: gfx.background('intro_bg.jpg', a.W, a.H, a.S, a.ox, a.oy))
        dax, day = m['dealer_anchor']
        self.dealer = ImageSprite(self, 'table', 1330 - dax, m['table_top'] + 2 - day, ('intro', 'dealer'),
                                  lambda: gfx.intro('dealer', a.S), anchor='nw')
        for which in ('table', 'chair'):
            x, y = m['layers'][which]
            ImageSprite(self, 'low', x, y, ('intro', which), lambda w=which: gfx.intro(w, a.S), anchor='nw')
        self.guy_anchor = m['guy_anchor']
        self.floor = m['floor_y']
        self.stop_x = m['stop_x']
        self.stride = m['stride']
        self.x0 = self.stop_x - round((self.stop_x + 80) / (self.stride / 2)) * (self.stride / 2)
        self.shadow = ImageSprite(self, 'low', self.x0, self.floor + 2, ('intro', 'shadow'),
                                  lambda: gfx.intro('shadow', a.S))
        self.guy = ImageSprite(self, 'cards', self.x0 - self.guy_anchor[0], self.floor - self.guy_anchor[1],
                               ('intro', 'walk0'), lambda: gfx.intro('walk0', a.S), anchor='nw')
        self.skip_text = TextSprite(self, 'hud', 800, 878, 'Click or press Space to skip', size=14,
                                    color='#d8c9a6', shadow='#000000')
        self.done = False
        self.run(self._script())

    def set_frame(self, kind, i):
        key = f'{kind}{i}'
        self.guy.set_image(('intro', key), lambda: gfx.intro(key, self.app.S))

    def set_dealer(self, key):
        self.dealer.set_image(('intro', key), lambda: gfx.intro(key, self.app.S))

    def place(self, x):
        self.guy.move_to(x - self.guy_anchor[0], self.floor - self.guy_anchor[1])
        self.shadow.move_to(x, self.floor + 2)

    # script ------------------------------------------------------------------
    def _script(self):
        snd = self.app.sound
        WALK, STOP, SIT = self.nframes['walk'], self.nframes['stop'], self.nframes['sit']
        # scale every frame up front (cheap now that they are images)
        for k in [f'walk{i}' for i in range(WALK)] + [f'stop{i}' for i in range(STOP)] + \
                [f'sit{i}' for i in range(SIT)] + ['dealer_talk', 'dealer_nod']:
            self.app.assets.photo(('intro', k), lambda k=k: gfx.intro(k, self.app.S))
        yield 0.3
        snd.play('whoosh', 0.4)
        dist = self.stop_x - self.x0
        dur = dist / SPEED
        state = {'last_step': -1}

        def walk(t):
            x = self.x0 + dist * t
            ph = ((x - self.x0) / self.stride) % 1.0
            self.place(x)
            self.set_frame('walk', int(round(ph * WALK)) % WALK)
            steps = int(((x - self.x0) / self.stride) * 2 + 0.5)
            if steps != state['last_step']:
                state['last_step'] = steps
                snd.play('step', 0.55)
        yield self.app.anim.tween(dur, walk, linear, 'ui', owner=self)
        for i in range(STOP):
            self.set_frame('stop', i)
            yield self.app.anim.wait(0.05, 'ui', owner=self)
        yield self.app.anim.wait(0.12, 'ui', owner=self)
        for i in range(SIT):
            self.set_frame('sit', i)
            if i == int(SIT * 0.55):
                snd.play('chair', 0.8)
            yield self.app.anim.wait(0.05, 'ui', owner=self)
        yield self.app.anim.wait(0.25, 'ui', owner=self)
        # the dealer greets him
        for k in range(3):
            self.set_dealer('dealer_nod' if k == 0 else 'dealer_talk')
            if k == 0:
                self._bubble('Welcome! Take a seat and place your bets.')
                snd.play('notify', 0.35)
            yield self.app.anim.wait(0.22, 'ui', owner=self)
            self.set_dealer('dealer')
            yield self.app.anim.wait(0.22, 'ui', owner=self)
        yield self.app.anim.wait(0.7, 'ui', owner=self)
        self.finish()

    def _bubble(self, text):
        S = self.app.liveS
        f = self.app.font(18, 'bold')
        tw = f.measure(text) / S + 44
        x, y = 1300 - tw / 2 - 10, 418

        def make():
            from PIL import Image, ImageDraw
            img = art.render_panel(round(tw * S), round(52 * S), radius=24 * S, fill=(250, 246, 236, 250),
                                   border=(120, 90, 40, 200), border_w=1.5 * S, shadow=False, gradient=False)
            w, h = img.size
            out = Image.new('RGBA', (w, h + int(16 * S)), (0, 0, 0, 0))
            out.alpha_composite(img, (0, 0))
            d = ImageDraw.Draw(out)
            d.polygon([(w * 0.78, h - 2), (w * 0.9, h - 2), (w * 0.93, h + 14 * S)], fill=(250, 246, 236, 250))
            return art.shadowed(out, 4 * S, (0, 3 * S), 0.5, pad=int(10 * S))
        b = ImageSprite(self, 'fx', x, y + 8, ('bubble', round(tw)), make)
        t = TextSprite(self, 'fx', x, y, text, size=18, weight='bold', color='#2a1c0c', shadow=None)

        def pop(k):
            if t.alive:
                t.set_size(18 * (0.7 + 0.3 * k))
        self.ui_tween(0.3, pop, ease_out_back)

    def finish(self):
        if self.done:
            return
        self.done = True
        self.app.set_scene(TableScene)

    def on_press(self, x, y):
        self.finish()

    def handle_key(self, key, char, state):
        if key in ('space', 'Return', 'Escape', 'KP_Enter'):
            self.finish()
            return True
        return False
