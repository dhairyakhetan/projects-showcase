"""
A small retained-mode UI toolkit on top of one tkinter Canvas.

* Everything is laid out on a virtual 1600 x 900 "design" canvas and scaled to
  the real window (letter-boxed, the felt fills the rest).  On resize every
  sprite is re-created at the new scale, so the game stays crisp.
* Animator runs tweens and generator-based coroutines ("tasks"), which keeps
  long animated sequences readable:

      def deal(self):
          yield self.move(card, x, y, 0.3)     # wait for the tween
          yield 0.2                           # wait 0.2 s
          choice = yield self.ask_user()      # wait for a click
"""
from __future__ import annotations

import math
import time
import tkinter as tk
import tkinter.font as tkfont
import traceback

from PIL import Image, ImageTk

from . import art

DW, DH = 1600, 900
LAYERS = ('bg', 'table', 'low', 'cards', 'chips', 'mid', 'hud', 'hud2', 'fly', 'fx', 'overlay', 'modal',
          'modal2', 'toast', 'tooltip', 'top')


# ============================================================== easing
def linear(t):
    return t


def ease_out_cubic(t):
    return 1 - (1 - t) ** 3


def ease_in_cubic(t):
    return t ** 3


def ease_in_out_cubic(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def ease_out_back(t, s=1.70158):
    t -= 1
    return t * t * ((s + 1) * t + s) + 1


def ease_out_quad(t):
    return 1 - (1 - t) * (1 - t)


def ease_in_out_sine(t):
    return -(math.cos(math.pi * t) - 1) / 2


def ease_out_elastic(t):
    if t in (0, 1):
        return t
    return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi) / 3) + 1


# ============================================================== futures / tasks
class Future:
    def __init__(self):
        self.done = False
        self.value = None
        self._cbs = []

    def resolve(self, value=None):
        if self.done:
            return
        self.done = True
        self.value = value
        cbs, self._cbs = self._cbs, []
        for cb in cbs:
            cb(value)

    def then(self, cb):
        if self.done:
            cb(self.value)
        else:
            self._cbs.append(cb)
        return self


def all_of(items):
    f = Future()
    items = [i for i in items if i is not None]
    if not items:
        f.resolve([])
        return f
    left = [len(items)]

    def one(_):
        left[0] -= 1
        if left[0] == 0:
            f.resolve(None)
    for i in items:
        i.then(one)
    return f


class Tween(Future):
    def __init__(self, anim, dur, fn, ease, clock, owner, delay=0.0):
        super().__init__()
        self.anim = anim
        self.dur = max(0.0, dur)
        self.fn = fn
        self.ease = ease or linear
        self.clock = clock
        self.owner = owner
        self.start = anim.now(clock) + delay
        self.cancelled = False

    def step(self, now):
        if now < self.start:
            return False
        t = 1.0 if self.dur <= 0 else min(1.0, (now - self.start) / self.dur)
        try:
            self.fn(self.ease(t))
        except tk.TclError:
            t = 1.0
        return t >= 1.0

    def cancel(self, finish=False):
        if self.done:
            return
        self.cancelled = True
        if finish:
            try:
                self.fn(1.0)
            except Exception:
                pass
        self.anim._remove(self)
        self.resolve(None)


class Task(Future):
    def __init__(self, anim, gen, owner, on_error=None):
        super().__init__()
        self.anim = anim
        self.gen = gen
        self.owner = owner
        self.on_error = on_error
        self.cancelled = False
        self._pending = []
        self._running = False

    def start(self):
        self._resume(None)
        return self

    def _resume(self, value):
        if self.cancelled or self.done:
            return
        self._pending.append(value)
        if self._running:
            return
        self._running = True
        try:
            while self._pending and not self.cancelled and not self.done:
                self._advance(self._pending.pop(0))
        finally:
            self._running = False

    def _advance(self, value):
        try:
            y = self.gen.send(value)
        except StopIteration as e:
            self.anim._tasks.discard(self)
            self.resolve(getattr(e, 'value', None))
            return
        except Exception as e:  # a bug inside a coroutine
            self.anim._tasks.discard(self)
            traceback.print_exc()
            if self.on_error:
                try:
                    self.on_error(e)
                except Exception:
                    traceback.print_exc()
            self.resolve(None)
            return
        self._wait(y)

    def _wait(self, y):
        if y is None:
            self.anim.next_frame(lambda: self._resume(None))
        elif isinstance(y, (int, float)):
            self.anim.wait(y, owner=self.owner).then(self._resume)
        elif isinstance(y, Future):
            y.then(self._resume)
        elif isinstance(y, (list, tuple)):
            all_of(list(y)).then(self._resume)
        else:
            self.anim.next_frame(lambda: self._resume(y))

    def cancel(self):
        if self.done:
            return
        self.cancelled = True
        try:
            self.gen.close()
        except Exception:
            pass
        self.anim._tasks.discard(self)
        self.done = True


FRAME_DT = 1.0 / 60.0


class Animator:
    def __init__(self, root):
        self.root = root
        self._tweens = []
        self._tasks = set()
        self._frame_cbs = []
        self._timers = []
        self._clocks = {'ui': 0.0, 'game': 0.0}
        self.speed = 1.0          # game clock multiplier (demo fast-forward)
        self.paused = False       # game clock frozen (demo pause)
        self.ui_speed = 1.0       # only changed by automated tests
        self._last = time.perf_counter()
        self._next = 0.0
        self._running = False
        self.frame_hooks = []     # called every frame (e.g. particles)
        self.error_hook = None

    def now(self, clock='game'):
        return self._clocks[clock]

    def _ensure(self):
        if not self._running:
            self._running = True
            self._last = time.perf_counter()
            self._next = self._last
            self.root.after(1, self._tick)

    def tween(self, dur, fn, ease=ease_out_cubic, clock='game', owner=None, delay=0.0):
        tw = Tween(self, dur, fn, ease, clock, owner, delay)
        self._tweens.append(tw)
        self._ensure()
        if tw.dur <= 0 and delay <= 0:
            # instant: apply now so state is consistent immediately
            try:
                fn(tw.ease(1.0))
            except Exception:
                pass
            self._remove(tw)
            tw.resolve(None)
        return tw

    def wait(self, seconds, clock='game', owner=None):
        return self.tween(seconds, lambda t: None, linear, clock, owner)

    def next_frame(self, cb):
        self._frame_cbs.append(cb)
        self._ensure()

    def run(self, gen, owner=None, on_error=None):
        t = Task(self, gen, owner, on_error)
        self._tasks.add(t)
        t.start()
        return t

    def _remove(self, tw):
        try:
            self._tweens.remove(tw)
        except ValueError:
            pass

    def cancel_owner(self, owner):
        for tw in list(self._tweens):
            if tw.owner is owner:
                tw.cancel()
        for t in list(self._tasks):
            if t.owner is owner:
                t.cancel()

    def busy(self, owner=None, clock='game'):
        return any(tw.owner is owner and tw.clock == clock for tw in self._tweens)

    def _tick(self):
        now = time.perf_counter()
        dt = min(0.1, now - self._last)
        self._last = now
        self._clocks['ui'] += dt * self.ui_speed
        if not self.paused:
            self._clocks['game'] += dt * self.speed
        try:
            for tw in list(self._tweens):
                if tw.cancelled or tw.done:
                    self._remove(tw)
                    continue
                if tw.step(self._clocks[tw.clock]):
                    self._remove(tw)
                    tw.resolve(None)
            cbs, self._frame_cbs = self._frame_cbs, []
            for cb in cbs:
                cb()
            for h in list(self.frame_hooks):
                h(dt)
        except Exception as e:
            traceback.print_exc()
            if self.error_hook:
                self.error_hook(e)
        if self._tweens or self._frame_cbs or self.frame_hooks:
            # Draw this frame now, so the time Tk spends painting counts towards
            # the frame budget instead of piling up behind the next timer.
            try:
                self.root.update_idletasks()
            except Exception:
                pass
            # Fixed 60 fps cadence (absolute schedule, no drift); if a frame ran
            # long, carry on from now rather than rushing to catch up.
            t = time.perf_counter()
            self._next += FRAME_DT
            if self._next < t:
                self._next = t
            self.root.after(max(1, round((self._next - t) * 1000)), self._tick)
        else:
            self._running = False


# ============================================================== asset cache
class Assets:
    def __init__(self, app):
        self.app = app
        self.cache = {}
        self.pil = {}
        self._lru = []

    def photo(self, key, maker):
        full = (key, round(self.app.S, 5))
        p = self.cache.get(full)
        if p is None:
            img = maker()
            p = ImageTk.PhotoImage(img)
            p.size = img.size
            self.cache[full] = p
        return p

    def photo_lru(self, key, maker, limit=360):
        """Like photo(), but only keeps the most recent `limit` images of this
        kind (used for card-flip frames so memory stays small)."""
        full = (key, round(self.app.S, 5))
        p = self.cache.get(full)
        if p is None:
            img = maker()
            p = ImageTk.PhotoImage(img)
            p.size = img.size
            self.cache[full] = p
            self._lru.append(full)
            if len(self._lru) > limit:
                old = self._lru.pop(0)
                self.cache.pop(old, None)
        return p

    def pil_image(self, key, maker):
        full = (key, round(self.app.S, 5))
        p = self.pil.get(full)
        if p is None:
            p = maker()
            self.pil[full] = p
        return p

    def clear(self):
        self.cache.clear()
        self.pil.clear()
        self._lru = []


# ============================================================== sprites
class Sprite:
    interactive = False

    def __init__(self, scene, layer='mid', x=0.0, y=0.0, visible=True):
        self.scene = scene
        self.app = scene.app
        self.c = scene.c
        self.layer = layer
        self.x, self.y = float(x), float(y)
        self.visible = visible
        self.items = []
        self.alive = True
        scene._add_sprite(self)
        self.mount()

    # subclasses implement _create() returning a list of canvas item ids
    def _create(self):
        return []

    def mount(self):
        self.items = list(self._create())
        st = 'normal' if self.visible else 'hidden'
        for it in self.items:
            self.c.itemconfigure(it, state=st)
            self.c.tag_lower(it, self.scene.sentinel[self.layer])
        self._apply_state()

    def _apply_state(self):
        pass

    def unmount(self):
        for it in self.items:
            self.c.delete(it)
        self.items = []

    def remount(self):
        self.unmount()
        self.mount()

    def destroy(self):
        if not self.alive:
            return
        self.alive = False
        self.unmount()
        self.scene._remove_sprite(self)

    def P(self, x=None, y=None):
        return self.scene.P(self.x if x is None else x, self.y if y is None else y)

    def move_to(self, x, y):
        self.x, self.y = float(x), float(y)
        self.sync()

    def sync(self):
        pass

    def set_visible(self, v):
        if self.visible == v:
            return
        self.visible = v
        st = 'normal' if v else 'hidden'
        for it in self.items:
            self.c.itemconfigure(it, state=st)
        self._apply_state()

    def raise_top(self):
        if not self.alive:
            return
        lst = self.scene.layers[self.layer]
        if self in lst:
            lst.remove(self)
            lst.append(self)
        for it in self.items:
            self.c.tag_lower(it, self.scene.sentinel[self.layer])

    def set_layer(self, layer):
        if layer == self.layer:
            self.raise_top()
            return
        self.scene.layers[self.layer].remove(self)
        self.layer = layer
        self.scene.layers[layer].append(self)
        for it in self.items:
            self.c.tag_lower(it, self.scene.sentinel[layer])


class ImageSprite(Sprite):
    def __init__(self, scene, layer, x, y, key, maker, anchor='center', visible=True):
        self.key = key
        self.maker = maker
        self.anchor = anchor
        self.photo = None
        super().__init__(scene, layer, x, y, visible)

    def _create(self):
        self.photo = self.app.assets.photo(self.key, self.maker)
        px, py = self.P()
        return [self.c.create_image(px, py, image=self.photo, anchor=self.anchor)]

    def sync(self):
        if self.items:
            px, py = self.P()
            self.c.coords(self.items[0], px, py)

    def set_image(self, key, maker):
        self.key, self.maker = key, maker
        if self.items:
            self.photo = self.app.assets.photo(key, maker)
            self.c.itemconfigure(self.items[0], image=self.photo)


class RawImageSprite(Sprite):
    """Shows a PIL image that is NOT cached (e.g. full-window overlays)."""

    def __init__(self, scene, layer, x, y, make, anchor='nw', visible=True):
        self.make = make
        self.anchor = anchor
        self.photo = None
        super().__init__(scene, layer, x, y, visible)

    def _create(self):
        img = self.make()
        self.photo = ImageTk.PhotoImage(img)
        px, py = self.P()
        return [self.c.create_image(px, py, image=self.photo, anchor=self.anchor)]

    def sync(self):
        if self.items:
            px, py = self.P()
            self.c.coords(self.items[0], px, py)


class ViewOverlay(Sprite):
    """Semi-transparent black layer covering the whole window."""

    def __init__(self, scene, layer, alpha=150):
        self.alpha = alpha
        super().__init__(scene, layer, 0, 0)

    def _create(self):
        a = self.app
        img = art.render_overlay(max(1, a.W // 4), max(1, a.H // 4), self.alpha).resize((a.W, a.H))
        self.photo = ImageTk.PhotoImage(img)
        return [self.c.create_image(0, 0, image=self.photo, anchor='nw')]


class TextSprite(Sprite):
    def __init__(self, scene, layer, x, y, text='', size=18, color='#f4ecd8', weight='normal',
                 family='ui', anchor='center', shadow='#000000', width=None, justify='left', slant='roman',
                 visible=True, angle=0, shadow_off=1.6):
        self.text = text
        self.size = size
        self.color = color
        self.weight = weight
        self.family = family
        self.anchor = anchor
        self.shadow = shadow
        self.width = width
        self.justify = justify
        self.slant = slant
        self.angle = angle
        self.shadow_off = shadow_off
        super().__init__(scene, layer, x, y, visible)

    def _font(self):
        return self.app.font(self.size, self.weight, self.family, self.slant)

    def _create(self):
        px, py = self.P()
        f = self._font()
        kw = dict(text=self.text, font=f, anchor=self.anchor, justify=self.justify)
        if self.width:
            kw['width'] = max(10, int(self.width * self.app.S))
        if self.angle:
            kw['angle'] = self.angle
        out = []
        if self.shadow:
            off = max(1, round(self.shadow_off * self.app.S))
            out.append(self.c.create_text(px + off, py + off, fill=self.shadow, **kw))
        out.append(self.c.create_text(px, py, fill=self.color, **kw))
        return out

    def sync(self):
        if not self.items:
            return
        px, py = self.P()
        if self.shadow and len(self.items) == 2:
            off = max(1, round(self.shadow_off * self.app.S))
            self.c.coords(self.items[0], px + off, py + off)
        self.c.coords(self.items[-1], px, py)

    def set_text(self, text):
        text = str(text)
        if text == self.text:
            return
        self.text = text
        for it in self.items:
            self.c.itemconfigure(it, text=text)

    def set_color(self, color):
        self.color = color
        if self.items:
            self.c.itemconfigure(self.items[-1], fill=color)

    def set_size(self, size):
        self.size = size
        f = self._font()
        for it in self.items:
            self.c.itemconfigure(it, font=f)

    def bbox(self):
        """Bounding box in design units."""
        if not self.items:
            return (self.x, self.y, self.x, self.y)
        b = self.c.bbox(self.items[-1])
        if not b:
            return (self.x, self.y, self.x, self.y)
        S = self.app.liveS
        return ((b[0] - self.scene.ox) / S, (b[1] - self.scene.oy) / S,
                (b[2] - self.scene.ox) / S, (b[3] - self.scene.oy) / S)

    def measure_height(self):
        b = self.bbox()
        return b[3] - b[1]


class RectSprite(Sprite):
    """Plain canvas rectangle (used for simple bars, chart cells)."""

    def __init__(self, scene, layer, x, y, w, h, fill='#000', outline='', width=0, visible=True):
        self.w, self.h = w, h
        self.fill, self.outline, self.lw = fill, outline, width
        super().__init__(scene, layer, x, y, visible)

    def _create(self):
        x0, y0 = self.P()
        x1, y1 = self.P(self.x + self.w, self.y + self.h)
        return [self.c.create_rectangle(x0, y0, x1, y1, fill=self.fill, outline=self.outline,
                                        width=max(0, self.lw * self.app.S) if self.lw else 0)]

    def sync(self):
        if self.items:
            x0, y0 = self.P()
            x1, y1 = self.P(self.x + self.w, self.y + self.h)
            self.c.coords(self.items[0], x0, y0, x1, y1)

    def set_size(self, w, h):
        self.w, self.h = w, h
        self.sync()

    def set_fill(self, fill):
        self.fill = fill
        if self.items:
            self.c.itemconfigure(self.items[0], fill=fill)


class LineSprite(Sprite):
    def __init__(self, scene, layer, pts, fill='#fff', width=2, smooth=False, visible=True, dash=None):
        self.pts = pts
        self.fill = fill
        self.lw = width
        self.smooth = smooth
        self.dash = dash
        super().__init__(scene, layer, 0, 0, visible)

    def _create(self):
        flat = []
        for x, y in self.pts:
            flat.extend(self.scene.P(x, y))
        if len(flat) < 4:
            flat = flat + flat
        kw = {}
        if self.dash:
            kw['dash'] = self.dash
        return [self.c.create_line(*flat, fill=self.fill, width=max(1, self.lw * self.app.S),
                                   smooth=self.smooth, capstyle='round', joinstyle='round', **kw)]


class Group:
    """Holds several sprites that move together (relative offsets)."""

    def __init__(self, *sprites):
        self.parts = []
        for s in sprites:
            self.add(s)

    def add(self, s, dx=None, dy=None):
        self.parts.append([s, s.x if dx is None else dx, s.y if dy is None else dy])

    def move_to(self, x, y):
        for s, dx, dy in self.parts:
            s.move_to(x + dx, y + dy)

    def destroy(self):
        for s, _, _ in self.parts:
            s.destroy()
        self.parts = []

    def set_visible(self, v):
        for s, _, _ in self.parts:
            s.set_visible(v)


# ============================================================== widgets
class Widget(Sprite):
    interactive = True
    clickable = True

    def __init__(self, scene, layer, x, y, w, h, tooltip=None, visible=True, modal=None):
        self.w, self.h = w, h
        self.tooltip = tooltip
        self.enabled = True
        self.disabled_reason = None
        self.hovered = False
        self.pressed = False
        self.modal = modal          # Modal this widget belongs to (input routing)
        super().__init__(scene, layer, x, y, visible)
        scene.widgets.append(self)

    def contains(self, x, y):
        return (self.x - self.w / 2 <= x <= self.x + self.w / 2 and
                self.y - self.h / 2 <= y <= self.y + self.h / 2)

    def destroy(self):
        if self in self.scene.widgets:
            self.scene.widgets.remove(self)
        if self.scene.hover is self:
            self.scene.hover = None
        super().destroy()

    def set_enabled(self, en, reason=None):
        en = bool(en)
        self.disabled_reason = None if en else reason
        if en == self.enabled:
            return
        self.enabled = en
        if not en:
            self.pressed = False
        self._apply_state()

    def on_enter(self):
        self.hovered = True
        self._apply_state()

    def on_leave(self):
        self.hovered = False
        self.pressed = False
        self._apply_state()

    def on_press(self, x, y):
        self.pressed = True
        self._apply_state()

    def on_release(self, x, y, inside):
        was = self.pressed
        self.pressed = False
        self._apply_state()
        if inside and was and self.enabled:
            self.on_click()

    def on_drag(self, x, y):
        pass

    def on_click(self):
        pass

    def on_wheel(self, delta):
        return False


class Button(Widget):
    def __init__(self, scene, layer, x, y, w, h, label='', style='dark', on_click=None, icon=None,
                 icon_size=None, font_size=None, hotkey=None, tooltip=None, radius=None, text_color=None,
                 sound='click', weight='bold', family='ui', visible=True, modal=None, sub=None,
                 icon_only=False, label_dx=0, keycap=None, keycap_side='below'):
        self.keycap = keycap
        self.keycap_side = keycap_side
        self.label = label
        self.style = style
        self.callback = on_click
        self.icon = icon
        self.icon_size = icon_size or h * 0.48
        self.font_size = font_size or max(11, h * 0.34)
        self.hotkey = hotkey
        self.radius = radius
        self.text_color = text_color or art.hexcolor(art.button_text_color(style))
        self.sound = sound
        self.weight = weight
        self.family = family
        self.sub = sub
        self.icon_only = icon_only
        self.label_dx = label_dx
        self.highlight = False
        super().__init__(scene, layer, x, y, w, h, tooltip, visible, modal)

    def _state_name(self):
        if not self.enabled:
            return 'disabled'
        if self.pressed:
            return 'pressed'
        if self.hovered or self.highlight:
            return 'hover'
        return 'normal'

    def _bg_photo(self, state):
        S = self.app.liveS
        w, h, style, r = self.w, self.h, self.style, self.radius
        key = ('btn', w, h, style, state, r)
        return self.app.assets.photo(key, lambda: art.render_button(
            round(w * S), round(h * S), style, state, None if r is None else r * S))

    def _layout(self):
        """positions of icon and label (design units)"""
        cx, cy = self.x, self.y
        if self.icon and self.label and not self.icon_only:
            f = self.app.font(self.font_size, self.weight, self.family)
            tw = f.measure(self.label) / self.app.S
            gap = self.h * 0.16
            total = self.icon_size + gap + tw
            ix = cx - total / 2 + self.icon_size / 2
            lx = ix + self.icon_size / 2 + gap + tw / 2
            return (ix, cy), (lx + self.label_dx, cy)
        if self.icon:
            return (cx, cy), None
        return None, (cx + self.label_dx, cy - (self.h * 0.1 if self.sub else 0))

    def _create(self):
        out = []
        self._bg = self._bg_photo(self._state_name())
        px, py = self.P()
        out.append(self.c.create_image(px, py, image=self._bg))
        ipos, lpos = self._layout()
        self._icon_item = None
        self._label_items = []
        if ipos:
            col = self.text_color
            key = ('icon', self.icon, self.icon_size, col)
            ph = self.app.assets.photo(key, lambda: art.render_icon(
                self.icon, max(4, round(self.icon_size * self.app.S)), _hex_to_rgb(col)))
            self._icon_photo = ph
            ix, iy = self.scene.P(*ipos)
            self._icon_item = self.c.create_image(ix, iy, image=ph)
            out.append(self._icon_item)
        if lpos and self.label:
            lx, ly = self.scene.P(*lpos)
            f = self.app.font(self.font_size, self.weight, self.family)
            dark_text = self.text_color.lower() in ('#281a04', '#281604', '#28160a')
            sh = None if dark_text or self.style == 'ghost' else '#000000'
            if sh:
                off = max(1, round(1.2 * self.app.S))
                out.append(self.c.create_text(lx + off, ly + off, text=self.label, font=f, fill=sh))
                self._label_items.append(out[-1])
            out.append(self.c.create_text(lx, ly, text=self.label, font=f, fill=self.text_color))
            self._label_items.append(out[-1])
        if self.keycap and getattr(self.app, 'show_keycaps', False):
            if self.keycap_side == 'right':
                kx, ky = self.scene.P(self.x + self.w / 2 + 8, self.y)
                anc = 'w'
            else:
                kx, ky = self.scene.P(self.x, self.y + self.h / 2 + 9)
                anc = 'center'
            out.append(self.c.create_text(kx, ky, text=self.keycap, anchor=anc, fill='#d2c294',
                                          font=self.app.font(12.5, 'bold', 'num')))
        self._sub_item = None
        if self.sub:
            sx, sy = self.scene.P(self.x, self.y + self.h * 0.22)
            f2 = self.app.font(self.font_size * 0.62, 'normal', self.family)
            self._sub_item = self.c.create_text(sx, sy, text=self.sub, font=f2, fill=self.text_color)
            out.append(self._sub_item)
        return out

    def _apply_state(self):
        if not self.items:
            return
        st = self._state_name()
        self._bg = self._bg_photo(st)
        self.c.itemconfigure(self.items[0], image=self._bg)
        dy = round(1.2 * self.app.S) if st == 'pressed' else 0
        px, py = self.P()
        self.c.coords(self.items[0], px, py + dy)
        alpha_state = 'disabled' if st == 'disabled' else 'normal'
        col = '#8a8a8a' if alpha_state == 'disabled' else self.text_color
        if self._label_items:
            self.c.itemconfigure(self._label_items[-1], fill=col)
            if len(self._label_items) == 2:
                self.c.itemconfigure(self._label_items[0], state='hidden' if alpha_state == 'disabled'
                                     or not self.visible else 'normal')
        if self._sub_item:
            self.c.itemconfigure(self._sub_item, fill=col)
        if self._icon_item is not None:
            if alpha_state == 'disabled':
                key = ('icon', self.icon, self.icon_size, '#8a8a8a')
                ph = self.app.assets.photo(key, lambda: art.render_icon(
                    self.icon, max(4, round(self.icon_size * self.app.S)), (138, 138, 138)))
            else:
                key = ('icon', self.icon, self.icon_size, self.text_color)
                ph = self.app.assets.photo(key, lambda: art.render_icon(
                    self.icon, max(4, round(self.icon_size * self.app.S)), _hex_to_rgb(self.text_color)))
            self._icon_photo = ph
            self.c.itemconfigure(self._icon_item, image=ph)
        # shift content when pressed
        self._sync_content(dy)

    def _sync_content(self, dy=0):
        ipos, lpos = self._layout()
        if self._icon_item is not None and ipos:
            ix, iy = self.scene.P(*ipos)
            self.c.coords(self._icon_item, ix, iy + dy)
        if self._label_items and lpos:
            lx, ly = self.scene.P(*lpos)
            if len(self._label_items) == 2:
                off = max(1, round(1.2 * self.app.S))
                self.c.coords(self._label_items[0], lx + off, ly + off + dy)
            self.c.coords(self._label_items[-1], lx, ly + dy)
        if self._sub_item:
            sx, sy = self.scene.P(self.x, self.y + self.h * 0.22)
            self.c.coords(self._sub_item, sx, sy + dy)

    def sync(self):
        if not self.items:
            return
        px, py = self.P()
        self.c.coords(self.items[0], px, py)
        self._sync_content()

    def set_label(self, label):
        if label == self.label:
            return
        self.label = label
        if self.items:
            self.remount_keep_order()

    def set_style(self, style):
        if style == self.style:
            return
        self.style = style
        self.text_color = art.hexcolor(art.button_text_color(style))
        if self.items:
            self.remount_keep_order()

    def remount_keep_order(self):
        # recreate items in place (keep z position within layer approx.)
        self.unmount()
        self.mount()

    def on_click(self):
        if self.sound:
            self.app.sound.play(self.sound)
        if self.callback:
            self.callback()

    def flash(self, dur=0.18):
        """Visually 'press' the button (used by the demo bot)."""
        self.pressed = True
        self._apply_state()

        def release(_):
            self.pressed = False
            if self.alive:
                self._apply_state()
        self.app.anim.wait(dur, clock='ui').then(release)

    def set_highlight(self, on):
        self.highlight = on
        self._apply_state()


def _hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Toggle(Widget):
    """iOS-style on/off switch."""

    def __init__(self, scene, layer, x, y, value=False, on_change=None, w=64, h=32, modal=None, tooltip=None):
        self.value = value
        self.on_change = on_change
        self.knob_t = 1.0 if value else 0.0
        super().__init__(scene, layer, x, y, w, h, tooltip, True, modal)

    def _photos(self):
        S = self.app.liveS
        w, h = self.w, self.h

        def track(on):
            col = (46, 160, 90) if on else (70, 74, 84)
            return art.render_pill(round(w * S), round(h * S), col + (255,), (233, 196, 106, 120) if on else None)
        on = self.app.assets.photo(('tg_track', w, h, True), lambda: track(True))
        off = self.app.assets.photo(('tg_track', w, h, False), lambda: track(False))
        d = round((h - 6) * S)
        knob = self.app.assets.photo(('tg_knob', h), lambda: _knob(d))
        return on, off, knob

    def _create(self):
        self._on, self._off, self._knob = self._photos()
        px, py = self.P()
        t = self.c.create_image(px, py, image=self._on if self.value else self._off)
        kx = self._knob_x()
        k = self.c.create_image(*self.scene.P(kx, self.y), image=self._knob)
        return [t, k]

    def _knob_x(self):
        r = (self.h - 6) / 2
        return self.x - self.w / 2 + 3 + r + (self.w - 6 - 2 * r) * self.knob_t

    def sync(self):
        if self.items:
            self.c.coords(self.items[0], *self.P())
            self.c.coords(self.items[1], *self.scene.P(self._knob_x(), self.y))

    def set_value(self, v, animate=True, notify=False):
        v = bool(v)
        self.value = v
        if self.items:
            self.c.itemconfigure(self.items[0], image=self._on if v else self._off)
        target = 1.0 if v else 0.0
        start = self.knob_t
        if animate:
            def f(t):
                self.knob_t = start + (target - start) * t
                self.sync()
            self.app.anim.tween(0.16, f, ease_out_cubic, clock='ui')
        else:
            self.knob_t = target
            self.sync()
        if notify and self.on_change:
            self.on_change(v)

    def on_click(self):
        self.app.sound.play('click')
        self.set_value(not self.value, notify=True)


def _knob(d):
    from PIL import ImageDraw
    ss = 4
    img = Image.new('RGBA', (d * ss, d * ss), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    g.ellipse([0, 0, d * ss - 1, d * ss - 1], fill=(250, 248, 242, 255), outline=(180, 176, 166, 255), width=ss)
    img = img.resize((d, d), art.LANCZOS)
    return art.shadowed(img, max(1, d * 0.08), (0, d * 0.06), 0.45, pad=max(2, int(d * 0.2)))


class Segmented(Widget):
    """A row of options, one selected."""

    def __init__(self, scene, layer, x, y, options, value, on_change=None, w=None, h=36, modal=None,
                 tooltip=None, font_size=15, seg_w=None):
        self.options = list(options)      # [(value, label), ...]
        self.value = value
        self.on_change = on_change
        self.font_size = font_size
        self.seg_w = seg_w
        self.hover_idx = -1
        n = len(self.options)
        if w is None:
            w = (seg_w or 86) * n
        super().__init__(scene, layer, x, y, w, h, tooltip, True, modal)

    def _seg_rect(self, i):
        n = len(self.options)
        sw = self.w / n
        x0 = self.x - self.w / 2 + i * sw
        return x0, sw

    def _create(self):
        S = self.app.liveS
        out = []
        w, h = self.w, self.h
        bg = self.app.assets.photo(('seg_bg', w, h), lambda: art.render_panel(
            round(w * S), round(h * S), radius=h * S / 2, fill=(10, 12, 16, 200),
            border=(233, 196, 106, 90), border_w=1.2 * S, shadow=False))
        self._bgp = bg
        out.append(self.c.create_image(*self.P(), image=bg))
        n = len(self.options)
        sw = w / n
        sel = [i for i, (v, _) in enumerate(self.options) if v == self.value]
        self._sel_item = None
        if sel:
            i = sel[0]
            x0, _ = self._seg_rect(i)
            ph = self.app.assets.photo(('seg_sel', sw, h), lambda: art.render_pill(
                round((sw - 6) * S), round((h - 6) * S), (233, 196, 106, 255)))
            self._selp = ph
            out.append(self.c.create_image(*self.scene.P(x0 + sw / 2, self.y), image=ph))
        f = self.app.font(self.font_size, 'bold')
        self._labels = []
        for i, (v, lab) in enumerate(self.options):
            x0, _ = self._seg_rect(i)
            col = '#2a1a04' if v == self.value else ('#ffffff' if i == self.hover_idx else '#d9d2c0')
            it = self.c.create_text(*self.scene.P(x0 + sw / 2, self.y), text=lab, font=f, fill=col)
            self._labels.append(it)
            out.append(it)
        return out

    def _idx(self, x):
        n = len(self.options)
        i = int((x - (self.x - self.w / 2)) / (self.w / n))
        return max(0, min(n - 1, i))

    def on_drag(self, x, y):
        pass

    def set_hover_x(self, x):
        i = self._idx(x)
        if i != self.hover_idx:
            self.hover_idx = i
            self._recolor()

    def on_leave(self):
        super().on_leave()
        self.hover_idx = -1
        self._recolor()

    def _recolor(self):
        if not self.items:
            return
        for i, ((v, _), it) in enumerate(zip(self.options, self._labels)):
            col = '#2a1a04' if v == self.value else ('#ffffff' if i == self.hover_idx else '#d9d2c0')
            self.c.itemconfigure(it, fill=col)

    def on_press(self, x, y):
        self._press_idx = self._idx(x)
        super().on_press(x, y)

    def on_release(self, x, y, inside):
        self.pressed = False
        if inside and self.enabled:
            i = self._idx(x)
            v = self.options[i][0]
            if v != self.value:
                self.app.sound.play('click')
                self.set_value(v, notify=True)

    def set_value(self, v, notify=False):
        self.value = v
        if self.items:
            self.remount()
        if notify and self.on_change:
            self.on_change(v)


class Slider(Widget):
    def __init__(self, scene, layer, x, y, w, value, on_change=None, h=30, modal=None, tooltip=None,
                 on_release=None):
        self.value = max(0.0, min(1.0, value))
        self.on_change = on_change
        self.on_release_cb = on_release
        super().__init__(scene, layer, x, y, w, h, tooltip, True, modal)

    def _create(self):
        S = self.app.liveS
        w = self.w
        tr = self.app.assets.photo(('sl_track', w), lambda: art.render_pill(round(w * S), round(8 * S),
                                                                          (60, 62, 70, 255)))
        self._tr = tr
        out = [self.c.create_image(*self.P(), image=tr)]
        fw = max(8, w * self.value)
        self._fill_w = fw
        fl = self.app.assets.photo(('sl_fill', round(fw)), lambda: art.render_pill(
            round(fw * S), round(8 * S), (233, 196, 106, 255)))
        self._fl = fl
        out.append(self.c.create_image(*self.scene.P(self.x - w / 2 + fw / 2, self.y), image=fl))
        d = round(22 * S)
        kn = self.app.assets.photo(('sl_knob',), lambda: _knob(d))
        self._kn = kn
        out.append(self.c.create_image(*self.scene.P(self.x - w / 2 + w * self.value, self.y), image=kn))
        return out

    def _set_from_x(self, x):
        v = (x - (self.x - self.w / 2)) / self.w
        v = max(0.0, min(1.0, v))
        if abs(v - self.value) > 0.001:
            self.value = v
            self.remount()
            if self.on_change:
                self.on_change(v)

    def on_press(self, x, y):
        super().on_press(x, y)
        self._set_from_x(x)

    def on_drag(self, x, y):
        self._set_from_x(x)

    def on_release(self, x, y, inside):
        self.pressed = False
        if self.on_release_cb:
            self.on_release_cb(self.value)

    def contains(self, x, y):
        return (self.x - self.w / 2 - 12 <= x <= self.x + self.w / 2 + 12 and
                self.y - self.h / 2 <= y <= self.y + self.h / 2)


class HotArea(Widget):
    """Invisible clickable rectangle."""

    def __init__(self, scene, layer, x, y, w, h, on_click=None, tooltip=None, modal=None, cursor=True):
        self.callback = on_click
        self.clickable = cursor
        super().__init__(scene, layer, x, y, w, h, tooltip, True, modal)

    def _create(self):
        x0, y0 = self.scene.P(self.x - self.w / 2, self.y - self.h / 2)
        x1, y1 = self.scene.P(self.x + self.w / 2, self.y + self.h / 2)
        return [self.c.create_rectangle(x0, y0, x1, y1, fill='', outline='')]

    def sync(self):
        if self.items:
            x0, y0 = self.scene.P(self.x - self.w / 2, self.y - self.h / 2)
            x1, y1 = self.scene.P(self.x + self.w / 2, self.y + self.h / 2)
            self.c.coords(self.items[0], x0, y0, x1, y1)

    def on_click(self):
        if self.callback:
            self.callback()


# ============================================================== modal
class Modal:
    def __init__(self, scene):
        self.scene = scene
        self.sprites = []
        self.widgets = []
        self.future = Future()
        self.cancel_value = None
        self.default_value = None
        self.closed = False

    def add(self, s):
        self.sprites.append(s)
        if isinstance(s, Widget):
            s.modal = self
            self.widgets.append(s)
        return s

    def close(self, value=None):
        if self.closed:
            return
        self.closed = True
        for s in self.sprites:
            s.destroy()
        if self in self.scene.modals:
            self.scene.modals.remove(self)
        self.scene._refresh_hover()
        self.future.resolve(value)


# ============================================================== scene
class Scene:
    name = 'scene'
    bg_color = '#06120a'

    def __init__(self, app, **kw):
        self.app = app
        self.c = app.canvas
        self.kw = kw
        self.layers = {name: [] for name in LAYERS}
        self.sentinel = {}
        self.widgets = []
        self.modals = []
        self.hover = None
        self.pressed_widget = None
        self._tooltip = None
        self._tooltip_for = None
        self._tooltip_timer = None
        self.alive = True
        self.ox, self.oy, self.S = app.ox, app.oy, app.S

    # ---------------------------------------------------- coordinate helpers
    def P(self, x, y):
        return self.app.ox + x * self.app.S, self.app.oy + y * self.app.S

    def D(self, px, py):
        return (px - self.app.ox) / self.app.S, (py - self.app.oy) / self.app.S

    @property
    def view(self):
        """Visible area in design units: (x0, y0, x1, y1) - may exceed 0..1600/0..900."""
        a = self.app
        return (-a.ox / a.S, -a.oy / a.S, (a.W - a.ox) / a.S, (a.H - a.oy) / a.S)

    # ---------------------------------------------------- lifecycle
    def _make_sentinels(self):
        self.c.delete('all')
        self.sentinel = {}
        for name in LAYERS:
            self.sentinel[name] = self.c.create_line(0, 0, 0, 0, state='hidden', tags=('sentinel',))

    def start(self):
        self._make_sentinels()
        self.ox, self.oy, self.S = self.app.ox, self.app.oy, self.app.S
        self.build()

    def build(self):
        pass

    def remount_all(self):
        """Window resized: recreate every canvas item at the new scale."""
        self.ox, self.oy, self.S = self.app.ox, self.app.oy, self.app.S
        self._hide_tooltip()
        for name in LAYERS:
            for s in self.layers[name]:
                s.unmount()
        self._make_sentinels()
        for name in LAYERS:
            for s in list(self.layers[name]):
                s.mount()
        self.on_resized()

    def on_resized(self):
        pass

    def destroy(self):
        self.alive = False
        self.app.anim.cancel_owner(self)
        self._hide_tooltip()
        for name in LAYERS:
            for s in list(self.layers[name]):
                s.alive = False
        self.layers = {name: [] for name in LAYERS}
        self.widgets = []
        self.c.delete('all')
        self.on_destroy()

    def on_destroy(self):
        pass

    def _add_sprite(self, s):
        self.layers[s.layer].append(s)

    def _remove_sprite(self, s):
        lst = self.layers.get(s.layer)
        if lst and s in lst:
            lst.remove(s)

    # ---------------------------------------------------- animation sugar
    def tween(self, dur, fn, ease=ease_out_cubic, clock='game', delay=0.0):
        m = self.app.anim_mult if clock == 'game' else 1.0
        return self.app.anim.tween(dur * m, fn, ease, clock, owner=self, delay=delay * m)

    def ui_tween(self, dur, fn, ease=ease_out_cubic, delay=0.0):
        return self.app.anim.tween(dur, fn, ease, 'ui', owner=self, delay=delay)

    def wait(self, sec, clock='game'):
        return self.app.anim.wait(sec * (self.app.anim_mult if clock == 'game' else 1.0), clock, owner=self)

    def run(self, gen, on_error=None):
        return self.app.anim.run(gen, owner=self, on_error=on_error or self.on_task_error)

    def on_task_error(self, e):
        self.app.report_error(e)

    def move(self, sprite, x, y, dur, ease=ease_out_cubic, clock='game', delay=0.0):
        x0, y0 = sprite.x, sprite.y

        def f(t):
            if sprite.alive:
                sprite.move_to(x0 + (x - x0) * t, y0 + (y - y0) * t)
        return self.tween(dur, f, ease, clock, delay)

    # ---------------------------------------------------- input
    def _top_widgets(self):
        if self.modals:
            return self.modals[-1].widgets
        return [w for w in self.widgets if w.modal is None]

    def widget_at(self, x, y):
        cands = [w for w in self._top_widgets() if w.alive and w.visible and w.items]
        best = None
        best_z = -1
        order = {name: i for i, name in enumerate(LAYERS)}
        for w in cands:
            if w.contains(x, y):
                z = order[w.layer] * 100000 + self.layers[w.layer].index(w) if w in self.layers[w.layer] else 0
                if z >= best_z:
                    best, best_z = w, z
        return best

    def _refresh_hover(self):
        x, y = self.app.mouse
        self.on_motion(x, y)

    def on_motion(self, x, y):
        if self.pressed_widget is not None:
            return
        w = self.widget_at(x, y)
        if isinstance(w, Segmented):
            w.set_hover_x(x)
        if w is not self.hover:
            if self.hover is not None and self.hover.alive:
                self.hover.on_leave()
            self.hover = w
            self._hide_tooltip()
            if w is not None:
                w.on_enter()
                if w.enabled and getattr(w, 'clickable', True):
                    self.app.set_cursor('hand2')
                    if isinstance(w, Button) and w.sound:
                        self.app.sound.play('hover', 0.5, min_gap=0.05)
                else:
                    self.app.set_cursor('')
                tip = w.tooltip if w.enabled else (w.disabled_reason or w.tooltip)
                if tip:
                    self._schedule_tooltip(w, tip, 0.45)
            else:
                self.app.set_cursor('')
        if w is not None and hasattr(w, 'on_hover_move'):
            w.on_hover_move(x, y)

    def on_press(self, x, y):
        self._hide_tooltip()
        w = self.widget_at(x, y)
        if w is None:
            self.on_background_click(x, y)
            return
        if not w.enabled:
            self.app.sound.play('deny')
            if w.disabled_reason:
                self._show_tooltip(w, w.disabled_reason)
            return
        self.pressed_widget = w
        w.on_press(x, y)

    def on_drag(self, x, y):
        if self.pressed_widget is not None and self.pressed_widget.alive:
            self.pressed_widget.on_drag(x, y)

    def on_release(self, x, y):
        w = self.pressed_widget
        self.pressed_widget = None
        if w is not None and w.alive:
            w.on_release(x, y, w.contains(x, y))
        self._refresh_hover()

    def on_right_click(self, x, y):
        pass

    def on_background_click(self, x, y):
        pass

    def on_wheel(self, x, y, delta):
        w = self.widget_at(x, y)
        if w is not None and w.on_wheel(delta):
            return
        self.on_scroll(delta)

    def on_scroll(self, delta):
        pass

    def on_key(self, key, char, state):
        if self.modals:
            m = self.modals[-1]
            if key == 'Escape' and m.cancel_value is not None:
                m.close(m.cancel_value)
                return True
            if key in ('Return', 'KP_Enter', 'space') and m.default_value is not None:
                m.close(m.default_value)
                return True
            if hasattr(m, 'keys') and key.lower() in m.keys:
                m.close(m.keys[key.lower()])
                return True
            return True
        return self.handle_key(key, char, state)

    def handle_key(self, key, char, state):
        return False

    # ---------------------------------------------------- tooltips
    def _schedule_tooltip(self, w, text, delay):
        tok = object()
        self._tooltip_timer = tok

        def show(_):
            if self._tooltip_timer is tok and self.hover is w and self.alive:
                self._show_tooltip(w, text)
        self.app.anim.wait(delay, clock='ui', owner=self).then(show)

    def _show_tooltip(self, w, text, family='ui'):
        self._hide_tooltip()
        f = self.app.font(13.5, 'normal', family)
        lines = text.split('\n')
        tw = max(f.measure(l) for l in lines) / self.app.S + 26
        th = 18 * len(lines) + 16
        x = w.x
        y = w.y - w.h / 2 - th / 2 - 8
        vx0, vy0, vx1, vy1 = self.view
        if y - th / 2 < vy0 + 4:
            y = w.y + w.h / 2 + th / 2 + 8
        x = max(vx0 + tw / 2 + 6, min(vx1 - tw / 2 - 6, x))
        S = self.app.liveS
        bg = ImageSprite(self, 'tooltip', x, y, ('tip', round(tw), round(th)), lambda: art.render_panel(
            round(tw * S), round(th * S), radius=8 * S, fill=(12, 12, 14, 238), border=(233, 196, 106, 140),
            border_w=1.2 * S))
        txt = TextSprite(self, 'tooltip', x, y, text, size=13.5, color='#f3ead6',
                         justify='center' if family == 'ui' else 'left', shadow=None, family=family)
        self._tooltip = (bg, txt)
        self._tooltip_for = w

    def _hide_tooltip(self):
        self._tooltip_timer = None
        if self._tooltip:
            for s in self._tooltip:
                s.destroy()
            self._tooltip = None
            self._tooltip_for = None

    # ---------------------------------------------------- common dialogs
    def modal(self, title, body='', buttons=(('OK', 'gold', True),), width=560, icon=None, cancel=None,
              default=None, keys=None, dim=True, extra=None, cy=450):
        """Show a dialog; returns a Future resolved with the chosen value."""
        m = Modal(self)
        m.cancel_value = cancel
        m.default_value = default
        m.keys = keys or {}
        self.modals.append(m)
        vx0, vy0, vx1, vy1 = self.view
        S = self.app.liveS
        if dim:
            m.add(ViewOverlay(self, 'modal', 150))
            # swallow clicks on the backdrop
            m.add(HotArea(self, 'modal', 800, 450, 8000, 6000, cursor=False))
        # measure body height
        f = self.app.font(17, 'normal')
        probe = self.c.create_text(0, 0, text=body, font=f, width=int((width - 70) * S), anchor='nw')
        bb = self.c.bbox(probe)
        self.c.delete(probe)
        body_h = ((bb[3] - bb[1]) / S) if (bb and body) else 0
        extra_h = extra[0] if extra else 0
        h = 70 + (body_h + 18 if body else 0) + extra_h + 86
        cx = 800
        panel = ImageSprite(self, 'modal', cx, cy, ('modal', width, round(h)), lambda: art.render_panel(
            round(width * S), round(h * S), radius=18 * S, fill=(16, 18, 22, 246), border=(233, 196, 106, 170),
            border_w=1.6 * S))
        m.add(panel)
        top = cy - h / 2
        ty = top + 40
        tx = cx
        if icon:
            m.add(ImageSprite(self, 'modal', cx - width / 2 + 42, ty, ('micon', icon), lambda: art.render_icon(
                icon, round(30 * S), art.GOLD)))
        m.add(TextSprite(self, 'modal', tx, ty, title, size=24, weight='bold', family='display', color='#f2d07a'))
        y = top + 70
        if body:
            m.add(TextSprite(self, 'modal', cx, y, body, size=17, color='#ece4d2', anchor='n',
                             width=width - 70, justify='center', shadow=None))
            y += body_h + 18
        if extra:
            extra[1](m, cx, y)
            y += extra_h
        n = len(buttons)
        bw = min(220, (width - 60 - (n - 1) * 16) / n)
        x0 = cx - (n * bw + (n - 1) * 16) / 2 + bw / 2
        by = top + h - 48
        for i, b in enumerate(buttons):
            label, style, value = b[0], b[1], b[2]
            opts = b[3] if len(b) > 3 else {}
            btn = Button(self, 'modal', x0 + i * (bw + 16), by, bw, 50, label, style,
                         on_click=(lambda v=value: m.close(v)), modal=m, font_size=17, **opts)
            if opts.get('disabled'):
                pass
            m.add(btn)
        self._refresh_hover()
        self.app.sound.play('pop', 0.6)
        return m

    def toast(self, text, kind='info', duration=2.2, y=None):
        colors = {'info': (233, 196, 106), 'good': (110, 210, 130), 'bad': (240, 110, 100), 'gold': (255, 210, 90)}
        col = colors.get(kind, colors['info'])
        f = self.app.font(17, 'bold')
        tw = f.measure(text) / self.app.S + 56
        th = 46
        vx0, vy0, vx1, vy1 = self.view
        ty = (y if y is not None else vy0 + 74)
        S = self.app.liveS
        bg = ImageSprite(self, 'toast', 800, ty - 80, ('toast', round(tw), kind), lambda: art.render_panel(
            round(tw * S), round(th * S), radius=th * S / 2, fill=(14, 15, 18, 236), border=col + (200,),
            border_w=1.6 * S))
        txt = TextSprite(self, 'toast', 800, ty - 80, text, size=17, weight='bold', color=art.hexcolor(col))

        def f_in(t):
            yy = ty - 80 + 80 * t
            bg.move_to(800, yy)
            txt.move_to(800, yy)

        def run():
            yield self.ui_tween(0.32, f_in, ease_out_back)
            yield self.app.anim.wait(duration, 'ui', owner=self)

            def f_out(t):
                yy = ty - 80 * t
                bg.move_to(800, yy)
                txt.move_to(800, yy)
            yield self.ui_tween(0.25, f_out, ease_in_cubic)
            bg.destroy()
            txt.destroy()
        self.run(run())


class LiveScale:
    """Behaves like the current UI scale (a float), but always reads the live
    value - so image makers created before a window resize still render at
    the new size when the scene is re-mounted."""
    __slots__ = ('app',)

    def __init__(self, app):
        self.app = app

    def __float__(self):
        return float(self.app.S)

    def __int__(self):
        return int(self.app.S)

    def __round__(self, n=None):
        return round(self.app.S, n) if n is not None else round(self.app.S)

    def __mul__(self, o):
        return self.app.S * o

    __rmul__ = __mul__

    def __truediv__(self, o):
        return self.app.S / o

    def __rtruediv__(self, o):
        return o / self.app.S

    def __add__(self, o):
        return self.app.S + o

    __radd__ = __add__

    def __sub__(self, o):
        return self.app.S - o

    def __rsub__(self, o):
        return o - self.app.S

    def __neg__(self):
        return -self.app.S

    def __lt__(self, o):
        return self.app.S < float(o)

    def __le__(self, o):
        return self.app.S <= float(o)

    def __gt__(self, o):
        return self.app.S > float(o)

    def __ge__(self, o):
        return self.app.S >= float(o)

    def __eq__(self, o):
        try:
            return self.app.S == float(o)
        except Exception:
            return False

    def __hash__(self):
        return hash(self.app.S)

    def __repr__(self):
        return f'LiveScale({self.app.S:.4f})'


# ============================================================== app
class App:
    TITLE = 'Blackjack'

    def __init__(self, root, store, sound, base_dir):
        self.root = root
        self.store = store
        self.sound = sound
        self.base_dir = base_dir
        self.canvas = tk.Canvas(root, bg='#06120a', highlightthickness=0, bd=0)
        self.canvas.pack(fill='both', expand=True)
        self.anim = Animator(root)
        self.assets = Assets(self)
        self._fonts = {}
        self._families = None
        self.scene = None
        self.mouse = (0, 0)
        self._cursor = ''
        self._resize_job = None
        self.session = {}
        self.liveS = LiveScale(self)
        root.update_idletasks()
        self.W = max(200, self.canvas.winfo_width())
        self.H = max(200, self.canvas.winfo_height())
        self._compute_geometry()
        c = self.canvas
        c.bind('<Configure>', self._on_configure)
        c.bind('<Motion>', lambda e: self._mouse('motion', e))
        c.bind('<ButtonPress-1>', lambda e: self._mouse('press', e))
        c.bind('<B1-Motion>', lambda e: self._mouse('drag', e))
        c.bind('<ButtonRelease-1>', lambda e: self._mouse('release', e))
        c.bind('<ButtonPress-3>', lambda e: self._mouse('right', e))
        c.bind('<MouseWheel>', lambda e: self._wheel(e, 1 if e.delta > 0 else -1))
        c.bind('<Button-4>', lambda e: self._wheel(e, 1))
        c.bind('<Button-5>', lambda e: self._wheel(e, -1))
        c.bind('<Leave>', lambda e: self._mouse('leave', e))
        root.bind('<KeyPress>', self._key)

    # ------------------------------------------------------------ geometry / fonts
    @property
    def anim_mult(self):
        return self.store.anim_mult()

    def _compute_geometry(self):
        self.S = min(self.W / DW, self.H / DH)
        self.ox = (self.W - DW * self.S) / 2
        self.oy = (self.H - DH * self.S) / 2

    def _on_configure(self, e):
        if (e.width, e.height) == (self.W, self.H):
            return
        if self._resize_job:
            self.root.after_cancel(self._resize_job)
        self._resize_job = self.root.after(140, lambda: self._apply_resize(e.width, e.height))

    def _apply_resize(self, w, h):
        self._resize_job = None
        w, h = max(200, w), max(200, h)
        if (w, h) == (self.W, self.H):
            return
        self.W, self.H = w, h
        self._compute_geometry()
        self.assets.clear()
        self._fonts.clear()
        if self.scene:
            self.scene.remount_all()

    def families(self):
        if self._families is None:
            self._families = set(tkfont.families(self.root))
        return self._families

    def family(self, role):
        prefs = {
            'ui': ['Segoe UI', 'SF Pro Text', 'Helvetica Neue', 'Ubuntu', 'DejaVu Sans', 'Arial'],
            'display': ['Georgia', 'Palatino Linotype', 'Book Antiqua', 'DejaVu Serif', 'Times New Roman'],
            'num': ['Bahnschrift', 'Segoe UI Semibold', 'Segoe UI', 'DejaVu Sans', 'Arial'],
            'mono': ['Consolas', 'Cascadia Mono', 'DejaVu Sans Mono', 'Courier New'],
        }
        fams = self.families()
        for f in prefs.get(role, prefs['ui']):
            if f in fams:
                return f
        return 'TkDefaultFont'

    def font(self, size, weight='normal', role='ui', slant='roman'):
        px = max(6, int(round(size * self.S)))
        key = (role, px, weight, slant)
        f = self._fonts.get(key)
        if f is None:
            f = tkfont.Font(root=self.root, family=self.family(role), size=-px, weight=weight, slant=slant)
            self._fonts[key] = f
        return f

    # ------------------------------------------------------------ input plumbing
    def _design(self, e):
        return (e.x - self.ox) / self.S, (e.y - self.oy) / self.S

    def _mouse(self, kind, e):
        if not self.scene or not self.scene.alive:
            return
        x, y = self._design(e)
        self.mouse = (x, y)
        try:
            if kind == 'motion':
                self.scene.on_motion(x, y)
            elif kind == 'press':
                self.scene.on_press(x, y)
            elif kind == 'drag':
                self.scene.on_drag(x, y)
            elif kind == 'release':
                self.scene.on_release(x, y)
            elif kind == 'right':
                self.scene.on_right_click(x, y)
            elif kind == 'leave':
                if self.scene.hover is not None and self.scene.pressed_widget is None:
                    self.scene.hover.on_leave()
                    self.scene.hover = None
                    self.scene._hide_tooltip()
        except Exception as ex:
            self.report_error(ex)

    def _wheel(self, e, delta):
        if self.scene:
            x, y = self._design(e)
            try:
                self.scene.on_wheel(x, y, delta)
            except Exception as ex:
                self.report_error(ex)

    def _key(self, e):
        key = e.keysym
        if key == 'F11':
            self.toggle_fullscreen()
            return
        if key == 'Escape' and self.is_fullscreen() and not (self.scene and self.scene.modals):
            pass
        if self.scene:
            try:
                handled = self.scene.on_key(key, e.char, e.state)
            except Exception as ex:
                self.report_error(ex)
                handled = True
            if not handled and key in ('m', 'M'):
                self.toggle_mute()

    def set_cursor(self, cur):
        if cur != self._cursor:
            self._cursor = cur
            try:
                self.canvas.configure(cursor=cur)
            except tk.TclError:
                pass

    # ------------------------------------------------------------ window
    def is_fullscreen(self):
        try:
            return bool(self.root.attributes('-fullscreen'))
        except tk.TclError:
            return False

    def toggle_fullscreen(self, value=None):
        v = (not self.is_fullscreen()) if value is None else value
        try:
            self.root.attributes('-fullscreen', v)
        except tk.TclError:
            pass
        self.store.settings['fullscreen'] = v
        self.store.save()

    def toggle_mute(self):
        s = self.store.settings
        s['muted'] = not s.get('muted', False)
        self.apply_audio_settings()
        self.store.save()
        if self.scene:
            self.scene.toast('Sound off' if s['muted'] else 'Sound on', 'info', 1.0)
            if hasattr(self.scene, 'on_audio_changed'):
                self.scene.on_audio_changed()

    def apply_audio_settings(self):
        s = self.store.settings
        self.sound.volume = 0.0 if s.get('muted') else float(s.get('volume', 0.8))
        self.sound.sfx_on = True

    # ------------------------------------------------------------ scenes
    def set_scene(self, factory, **kw):
        """Switch scene instantly (a full-window fade was the main cause of lag)."""
        kw.pop('fade', None)
        if getattr(self, '_switching', False):
            return
        self._switching = True
        try:
            if self.scene:
                try:
                    self.scene.destroy()
                except Exception:
                    traceback.print_exc()
            self.scene = factory(self, **kw)
            self.scene.start()
            self.mouse_refresh()
        except Exception as e:
            self._switching = False
            self.report_error(e)
            if factory.__name__ != 'MenuScene':
                self.go_menu_safe()
        finally:
            self._switching = False

    def go_menu_safe(self):
        try:
            from .scenes.menu import MenuScene
            self.scene = MenuScene(self)
            self.scene.start()
        except Exception:
            traceback.print_exc()

    def mouse_refresh(self):
        if self.scene:
            x, y = self.mouse
            self.scene.hover = None
            self.scene.on_motion(x, y)

    def report_error(self, e):
        traceback.print_exc()
        try:
            import os
            with open(os.path.join(self.store.folder, 'error_log.txt'), 'a', encoding='utf-8') as f:
                f.write(time.strftime('\n--- %Y-%m-%d %H:%M:%S ---\n'))
                f.write(traceback.format_exc())
        except Exception:
            pass
        try:
            if self.scene and self.scene.alive:
                self.scene.toast('Oops - something went wrong (saved to error_log.txt)', 'bad', 3.0)
        except Exception:
            pass
