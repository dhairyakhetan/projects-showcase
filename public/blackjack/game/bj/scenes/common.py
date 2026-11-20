"""Shared bits for the full-screen pages (settings, stats)."""
from __future__ import annotations

from .. import art, gfx
from ..ui import Button, ImageSprite, Scene, TextSprite
from .table import ViewImage


class PageScene(Scene):
    title = ''
    back_label = 'Back'

    def build(self):
        a = self.app
        ViewImage(self, 'bg', lambda: ('bg', a.W, a.H), lambda: gfx.background('bg.jpg', a.W, a.H, a.S, a.ox, a.oy))
        self.back_btn = Button(self, 'hud', 86, 44, 132, 44, self.back_label, 'ghost', icon='back', icon_size=18,
                               font_size=16, on_click=self.go_back, tooltip='Back  [Esc]')
        self.title_sprite = TextSprite(self, 'hud', 800, 46, self.title, size=32, weight='bold', family='display',
                                       color='#f2d07a')
        self.build_page()

    def build_page(self):
        pass

    def go_back(self):
        back = self.kw.get('back', 'menu')
        if back == 'table':
            from .table import TableScene
            self.app.set_scene(TableScene)
        else:
            self.app.go_menu()

    def handle_key(self, key, char, state):
        if key in ('Escape', 'BackSpace'):
            self.go_back()
            return True
        return self.page_key(key, char, state)

    def page_key(self, key, char, state):
        return False


def panel(scene, layer, x, y, w, h, fill=(10, 12, 16, 205), border=(233, 196, 106, 110), radius=18, shadow=True):
    S = scene.app.liveS
    return ImageSprite(scene, layer, x, y, ('panel', round(w), round(h), fill, border, radius, shadow),
                       lambda: art.render_panel(round(w * S), round(h * S), radius=radius * S, fill=fill,
                                                border=border, border_w=1.4 * S, shadow=shadow))
