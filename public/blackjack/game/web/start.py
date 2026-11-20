"""Starts the game inside Pyodide. bridge.js has already copied the files to /game."""
import importlib.util
import sys

import js

BASE = '/game'
sys.path.insert(0, BASE)             # the bj package
sys.path.insert(0, BASE + '/web')    # stands in for tkinter, and websound

import PIL  # noqa: E402

spec = importlib.util.spec_from_file_location('PIL.ImageTk', BASE + '/web/imagetk.py')
imagetk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imagetk)
sys.modules['PIL.ImageTk'] = imagetk
PIL.ImageTk = imagetk

import bj.sound  # noqa: E402
import websound  # noqa: E402

bj.sound.SoundEngine = websound.WebSoundEngine

import bj.gfx  # noqa: E402
import tkinter  # noqa: E402


def _preload(felt='green'):
    """No threads in the browser: decode the artwork one file at a time between frames."""
    names = ['cards.png', 'chips.png', 'ui.png', f'felt_{felt}.jpg', 'intro.png', 'intro_bg.jpg']

    def step(i=0):
        if i < len(names):
            try:
                bj.gfx._file(names[i])
            except Exception:
                pass
            tkinter._root.after(80, lambda: step(i + 1))
    tkinter._root.after(400, step)


bj.gfx.preload = _preload

TOUCH = bool(js.BJ.touch)
if TOUCH:
    import bj.store
    import bj.ui
    # No hover on a phone, and quicker animations until the player picks their own.
    bj.store.DEFAULT_SETTINGS['anim_speed'] = 'fast'
    bj.ui.Scene._refresh_hover = lambda self: None
    # Fingers are fatter than a mouse pointer: every button reacts a little beyond its edge.
    def _contains(self, x, y, pad=9):
        return (self.x - self.w / 2 - pad <= x <= self.x + self.w / 2 + pad and
                self.y - self.h / 2 - pad <= y <= self.y + self.h / 2 + pad)
    bj.ui.Widget.contains = _contains
    import bj.sprites
    _confetti = bj.sprites.Confetti.__init__
    bj.sprites.Confetti.__init__ = lambda self, scene, n=90, *a, **k: _confetti(self, scene, n // 2, *a, **k)
    _mult = bj.store.Store.anim_mult
    bj.store.Store.anim_mult = lambda self: _mult(self) * 0.7

from bj import main as bjmain  # noqa: E402

app = None
_init = bjmain.GameApp.__init__


def _remember(self, *a, **k):
    global app
    _init(self, *a, **k)
    app = self


bjmain.GameApp.__init__ = _remember
bjmain.GameApp.uk = 1.5 if TOUCH else 1.0        # bigger buttons and text on a phone
bjmain.GameApp.show_keycaps = not TOUCH     # key hints under buttons only where there is a keyboard


def run():
    bjmain.main(BASE)


def on_leave():
    """The tab is closing: finish an unfinished hand the way Quit does, and save."""
    if app is None:
        return
    try:
        sc = app.scene
        if sc is not None and hasattr(sc, 'emergency_finish'):
            sc.emergency_finish()
    except Exception:
        pass
    try:
        app.store.save()
    except Exception:
        pass
