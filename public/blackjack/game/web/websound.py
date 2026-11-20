"""Sound for the browser: the game's SoundEngine, played by Web Audio in bridge.js."""
import random
import time

import js

from bj.sound import VARIANTS

BJ = js.BJ


class _WebBackend:
    name = 'Web Audio'
    can_mix = True

    def preload(self, name):
        pass          # bridge.js fetches every sound up front

    def close(self):
        pass


class WebSoundEngine:
    def __init__(self, folder, force_backend=None):
        self.folder = folder
        self.names = list(BJ.soundNames.to_py())
        self.volume = 0.8
        self.sfx_on = True
        self.backend = _WebBackend()
        self._last = {}

    @property
    def backend_name(self):
        return self.backend.name

    def preload(self, names=None):
        pass

    def play(self, name, vol=1.0, min_gap=0.0):
        if not self.sfx_on or self.volume <= 0:
            return
        name = random.choice(VARIANTS[name]) if name in VARIANTS else name
        if min_gap:
            now = time.time()
            if now - self._last.get(name, 0) < min_gap:
                return
            self._last[name] = now
        BJ.playSound(name, vol * self.volume)

    def close(self):
        pass
