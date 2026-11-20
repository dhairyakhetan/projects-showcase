"""Starts the game inside Pyodide. bridge.js has already copied the files to /game."""
import importlib.util
import sys

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

from bj import main as bjmain  # noqa: E402

app = None
_init = bjmain.GameApp.__init__


def _remember(self, *a, **k):
    global app
    _init(self, *a, **k)
    app = self


bjmain.GameApp.__init__ = _remember


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
