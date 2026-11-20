"""
Sound playback with graceful fallbacks.

Backends, best first:
  1. pygame.mixer    - many sounds at once
  2. Windows MCI     - built into Windows (ctypes), also mixes sounds
  3. winsound        - built into Python on Windows, one sound at a time
  4. afplay / paplay / aplay subprocesses (macOS / Linux)
  5. silence
"""
from __future__ import annotations

import os
import random
import sys
import tempfile
import time

VARIANTS = {'chip': ('chip1', 'chip2', 'chip3'), 'step': ('step1', 'step2')}
# Lower number = more important. Used by the single-voice winsound backend so a
# button click never cuts off a "Blackjack!" fanfare.
PRIORITY = {'blackjack': 0, 'win': 1, 'lose': 1, 'push': 1, 'bust': 1, 'cash': 1,
            'shuffle': 2, 'chips_payout': 2, 'notify': 2, 'chair': 2,
            'card_deal': 3, 'card_flip': 3, 'card_place': 3, 'chips_stack': 3,
            'chip1': 4, 'chip2': 4, 'chip3': 4, 'step1': 3, 'step2': 3, 'whoosh': 4,
            'pop': 4, 'deny': 4, 'click': 5, 'hover': 6}
POOL = {'card_deal': 4, 'card_flip': 3, 'card_place': 3, 'chip1': 2, 'chip2': 2, 'chip3': 2,
        'chips_stack': 2, 'click': 2, 'hover': 2, 'step1': 2, 'step2': 2, 'pop': 2}


class _Null:
    name = 'No sound'
    can_mix = False

    def play(self, name, vol):
        pass


    def tick(self):
        pass

    def close(self):
        pass


class _Pygame(_Null):
    name = 'pygame mixer'
    can_mix = True

    def __init__(self, folder, names):
        os.environ.setdefault('PYGAME_HIDE_SUPPORT_PROMPT', '1')
        import pygame  # noqa
        self.pg = pygame
        pygame.mixer.pre_init(44100, -16, 2, 512)
        pygame.mixer.init()
        pygame.mixer.set_num_channels(32)
        self.snd = {}
        for n in names:
            try:
                self.snd[n] = pygame.mixer.Sound(os.path.join(folder, n + '.wav'))
            except Exception:
                pass
        if not self.snd:
            raise RuntimeError('pygame could not load sounds')

    def play(self, name, vol):
        s = self.snd.get(name)
        if s is None:
            return
        ch = s.play()
        if ch is not None:
            ch.set_volume(max(0.0, min(1.0, vol)))

    def close(self):
        try:
            self.pg.mixer.quit()
        except Exception:
            pass


class _Mci(_Null):
    """Windows Media Control Interface via ctypes (no extra installs)."""
    name = 'Windows MCI'
    can_mix = True

    def __init__(self, folder, names):
        if sys.platform != 'win32':
            raise RuntimeError('not windows')
        import ctypes
        from ctypes import wintypes
        self.ct = ctypes
        winmm = ctypes.WinDLL('winmm')
        self.send = winmm.mciSendStringW
        self.send.argtypes = [wintypes.LPCWSTR, wintypes.LPWSTR, wintypes.UINT, wintypes.HANDLE]
        self.send.restype = wintypes.DWORD
        self.folder = folder
        self.names = set(names)
        self.aliases = {}      # name -> [alias, ...]
        self.next = {}
        self.vol = {}
        self.failures = 0
        # self-test: if we cannot open one file, fall back to another backend
        if not self._open('click'):
            raise RuntimeError('MCI open failed')

    def _cmd(self, s):
        buf = self.ct.create_unicode_buffer(256)
        return self.send(s, buf, 255, None), buf.value

    def _open(self, name):
        if name in self.aliases:
            return True
        path = os.path.join(self.folder, name + '.wav')
        if not os.path.exists(path):
            return False
        out = []
        for k in range(POOL.get(name, 1)):
            alias = f'bj_{name}_{k}'
            err, _ = self._cmd(f'open "{path}" type mpegvideo alias {alias}')
            if err:
                err, _ = self._cmd(f'open "{path}" type waveaudio alias {alias}')
            if err:
                break
            out.append(alias)
        if not out:
            return False
        self.aliases[name] = out
        self.next[name] = 0
        return True

    def preload(self, name):
        try:
            self._open(name)
        except Exception:
            pass

    def play(self, name, vol):
        if not self._open(name):
            return
        lst = self.aliases[name]
        k = self.next[name]
        self.next[name] = (k + 1) % len(lst)
        alias = lst[k]
        v = int(max(0.0, min(1.0, vol)) * 1000)
        if self.vol.get(alias) != v:
            self._cmd(f'setaudio {alias} volume to {v}')
            self.vol[alias] = v
        err, _ = self._cmd(f'play {alias} from 0')
        if err:
            self.failures += 1
            if self.failures > 3:
                raise RuntimeError('MCI play failing')


    def close(self):
        for lst in self.aliases.values():
            for a in lst:
                self._cmd(f'close {a}')


class _Winsound(_Null):
    """One sound at a time; volume via pre-scaled temporary copies."""
    name = 'winsound (basic)'

    def __init__(self, folder, names):
        import winsound  # noqa
        self.ws = winsound
        self.folder = folder
        self.tmp = tempfile.mkdtemp(prefix='bj_snd_')
        self.cache = {}
        self.busy_until = 0.0
        self.busy_prio = 99
        self.lengths = {}
        import wave
        for n in names:
            try:
                with wave.open(os.path.join(folder, n + '.wav')) as w:
                    self.lengths[n] = w.getnframes() / float(w.getframerate())
            except Exception:
                pass

    def _scaled(self, name, vol):
        q = max(1, min(10, int(round(vol * 10))))
        src = os.path.join(self.folder, name + '.wav')
        if q >= 10:
            return src
        key = (name, q)
        if key in self.cache:
            return self.cache[key]
        import array
        import wave
        with wave.open(src) as w:
            params = w.getparams()
            frames = w.readframes(w.getnframes())
        a = array.array('h', frames)
        if sys.byteorder == 'big':
            a.byteswap()
        f = q / 10.0
        a = array.array('h', (int(x * f) for x in a))
        if sys.byteorder == 'big':
            a.byteswap()
        dst = os.path.join(self.tmp, f'{name}_{q}.wav')
        with wave.open(dst, 'wb') as w:
            w.setparams(params)
            w.writeframes(a.tobytes())
        self.cache[key] = dst
        return dst

    def play(self, name, vol):
        if name == 'hover':
            return
        now = time.time()
        prio = PRIORITY.get(name, 3)
        if now < self.busy_until and prio > self.busy_prio:
            return   # don't interrupt something more important
        path = self._scaled(name, vol)
        self.ws.PlaySound(path, self.ws.SND_FILENAME | self.ws.SND_ASYNC | self.ws.SND_NODEFAULT)
        self.busy_until = now + min(self.lengths.get(name, 0.3), 1.2)
        self.busy_prio = prio


class _Process(_Null):
    name = 'system player'

    def __init__(self, folder, names):
        import shutil
        import subprocess
        self.sp = subprocess
        self.folder = folder
        self.cmd = None
        if sys.platform == 'darwin' and shutil.which('afplay'):
            self.cmd = 'afplay'
        elif shutil.which('paplay'):
            self.cmd = 'paplay'
        elif shutil.which('aplay'):
            self.cmd = 'aplay'
        if not self.cmd:
            raise RuntimeError('no player')
        self.can_mix = True

    def play(self, name, vol):
        if name == 'hover':
            return
        path = os.path.join(self.folder, name + '.wav')
        if self.cmd == 'afplay':
            args = ['afplay', '-v', f'{vol:.2f}', path]
        elif self.cmd == 'paplay':
            args = ['paplay', f'--volume={int(vol * 65536)}', path]
        else:
            args = ['aplay', '-q', path]
        try:
            self.sp.Popen(args, stdout=self.sp.DEVNULL, stderr=self.sp.DEVNULL)
        except Exception:
            pass


class SoundEngine:
    def __init__(self, folder, force_backend=None):
        self.folder = folder
        self.names = sorted(f[:-4] for f in os.listdir(folder) if f.endswith('.wav')) \
            if os.path.isdir(folder) else []
        self.volume = 0.8
        self.sfx_on = True
        self.backend = _Null()
        self._last = {}
        self._q = None
        self._thread = None
        order = [_Pygame, _Mci, _Winsound, _Process]
        if force_backend == 'none' or not self.names:
            order = []
        for B in order:
            try:
                self.backend = B(folder, self.names)
                break
            except Exception:
                continue
        # Every backend call runs on one worker thread.  Windows MCI calls can
        # block for tens of milliseconds, which used to freeze the animation
        # for a moment every time a card or chip sound played.
        if not isinstance(self.backend, _Null):
            import queue
            import threading
            self._q = queue.Queue()
            self._thread = threading.Thread(target=self._worker, name='bj-sound', daemon=True)
            self._thread.start()

    def _worker(self):
        while True:
            job = self._q.get()
            if job is None:
                return
            fn, args = job
            try:
                fn(*args)
            except Exception:
                pass

    def _submit(self, fn, *args):
        if self._q is None:
            fn(*args)
        elif self._q.qsize() < 40:        # never let a backlog build up
            self._q.put((fn, args))

    @property
    def backend_name(self):
        return self.backend.name

    def preload(self, names=None):
        if hasattr(self.backend, 'preload'):
            for n in names or self.names:
                self._submit(self._do_preload, n)

    def _do_preload(self, n):
        try:
            self.backend.preload(n)
        except Exception:
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
        self._submit(self._do_play, name, vol * self.volume)

    def _do_play(self, name, vol):
        try:
            self.backend.play(name, vol)
        except Exception:
            self._downgrade()

    def _downgrade(self):
        """A backend failed at runtime - fall back to the next simpler one."""
        try:
            self.backend.close()
        except Exception:
            pass
        for B in (_Winsound, _Process, _Null):
            if isinstance(self.backend, B):
                continue
            try:
                self.backend = B(self.folder, self.names)
                return
            except Exception:
                continue

    def close(self):
        if self._q is not None:
            self._q.put((self._do_close, ()))
            self._q.put(None)
            self._thread.join(timeout=1.5)
        else:
            self._do_close()

    def _do_close(self):
        try:
            self.backend.close()
        except Exception:
            pass
