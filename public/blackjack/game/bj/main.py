"""Creates the window and starts the game."""
from __future__ import annotations

import os
import sys
import tkinter as tk

from PIL import ImageTk

from . import gfx
from .sound import SoundEngine
from .store import Store
from .ui import App


def _windows_setup():
    if sys.platform != 'win32':
        return
    import ctypes
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)      # crisp on high-DPI screens
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass
    try:
        # Windows timers tick every ~15.6 ms by default, which makes Tk's after()
        # (and so every animation frame) uneven.  Ask for 1 ms precision.
        import atexit
        ctypes.windll.winmm.timeBeginPeriod(1)
        atexit.register(lambda: ctypes.windll.winmm.timeEndPeriod(1))
    except Exception:
        pass
    try:
        # own taskbar icon instead of Python's
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('Dip.Blackjack.Game')
    except Exception:
        pass


class GameApp(App):
    def request_quit(self):
        sc = self.scene
        if sc is not None and hasattr(sc, 'before_quit'):
            try:
                if sc.before_quit() is False:
                    return          # scene shows its own confirmation
            except Exception as e:
                self.report_error(e)
        self.quit_now()

    def go_menu(self):
        from .scenes.menu import MenuScene
        self.set_scene(MenuScene)

    def start_play(self):
        """Play button: walk-in intro (depending on settings), then the table."""
        from .scenes.table import TableScene
        intro = self.store.settings.get('intro', 'always')
        if intro == 'never' or (intro == 'session' and self.session.get('intro_seen')):
            self.set_scene(TableScene)
        else:
            from .scenes.intro import IntroScene
            self.set_scene(IntroScene)

    def quit_now(self):
        try:
            if self.scene and hasattr(self.scene, 'emergency_finish'):
                self.scene.emergency_finish()
        except Exception:
            pass
        try:
            self.store.save()
        except Exception:
            pass
        try:
            self.sound.close()
        except Exception:
            pass
        self.root.destroy()


def main(base_dir):
    _windows_setup()
    root = tk.Tk()
    root.withdraw()
    root.title('Blackjack')
    root.configure(bg='#06120a')
    sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
    # largest 16:9 window that fits ~88% of the screen
    w = int(min(sw * 0.88, sh * 0.82 * 16 / 9))
    h = int(w * 9 / 16)
    w, h = max(960, w), max(540, h)
    w, h = min(w, sw), min(h, sh)
    x = max(0, (sw - w) // 2)
    y = max(0, (sh - h) // 2 - int(sh * 0.03))
    root.geometry(f'{w}x{h}+{x}+{y}')
    root.minsize(min(960, sw), min(540, sh))

    store = Store(base_dir)
    sound = SoundEngine(os.path.join(base_dir, 'assets', 'sounds'))
    root.deiconify()
    app = GameApp(root, store, sound, base_dir)
    try:
        icon = gfx.card('AS', 48)
        icon.thumbnail((64, 64))
        from PIL import Image
        sq = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        sq.alpha_composite(icon, ((64 - icon.width) // 2, (64 - icon.height) // 2))
        app._icon = ImageTk.PhotoImage(sq)
        root.iconphoto(True, app._icon)
    except Exception:
        pass
    app.apply_audio_settings()
    if store.settings.get('fullscreen'):
        app.toggle_fullscreen(True)
    root.protocol('WM_DELETE_WINDOW', app.request_quit)
    root.report_callback_exception = lambda *a: app.report_error(a[1])

    from .scenes.menu import MenuScene
    app.set_scene(MenuScene)
    gfx.preload(store.settings.get('felt', 'green'))
    if hasattr(sound.backend, 'preload'):
        # open the most common sounds in the background, a few at a time
        names = ['card_deal', 'card_flip', 'chip1', 'chip2', 'chip3', 'click', 'hover', 'chips_stack',
                 'win', 'lose', 'push', 'bust', 'blackjack', 'card_place', 'shuffle', 'pop', 'deny']

        def pre(i=0):
            if i < len(names):
                sound.preload([names[i]])
                root.after(40, lambda: pre(i + 1))
        root.after(600, pre)
    root.mainloop()
