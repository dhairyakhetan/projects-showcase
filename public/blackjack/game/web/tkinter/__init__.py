"""The slice of tkinter the game uses, drawing on an HTML canvas.

Browsers have no tkinter. This keeps the game's own code unchanged: one Canvas
whose items are kept here and handed to bridge.js to paint, Tk-style timers
(`after`), and key/mouse binds fed by the page's events.
"""
import heapq
import itertools
import json
import time
import traceback

import js
from pyodide.ffi import create_proxy

BJ = js.BJ


class TclError(Exception):
    pass


class Event:
    def __init__(self, **kw):
        self.x = self.y = self.width = self.height = self.delta = self.state = 0
        self.keysym = self.char = ''
        self.__dict__.update(kw)


_root = None

# ------------------------------------------------------------------ timers
# One JS timeout is armed for the earliest due entry; entries are
# [due, seq, id, fn] and a cancelled one has fn = None.
_heap = []
_live = {}
_ids = itertools.count(1)
_handle = None
_handle_due = 0.0


def _report(e):
    handler = getattr(_root, 'report_callback_exception', None)
    try:
        if callable(handler):
            handler(type(e), e, e.__traceback__)
            return
    except Exception:
        pass
    traceback.print_exc()


def _arm():
    global _handle, _handle_due
    while _heap and _heap[0][3] is None:
        heapq.heappop(_heap)
    if not _heap:
        return
    due = _heap[0][0]
    if _handle is not None:
        if _handle_due <= due:
            return
        js.clearTimeout(_handle)
    _handle_due = due
    _handle = js.setTimeout(_pump_proxy, max(0.0, (due - time.perf_counter()) * 1000.0))


def _pump():
    global _handle
    _handle = None
    now = time.perf_counter()
    while _heap and _heap[0][0] <= now:
        _due, _seq, tid, fn = heapq.heappop(_heap)
        if fn is None:
            continue
        _live.pop(tid, None)
        try:
            fn()
        except Exception as e:
            _report(e)
    _flush()
    _arm()


_pump_proxy = create_proxy(_pump)
_canvases = []


def _flush():
    for c in _canvases:
        if c._dirty:
            c._render()


# ------------------------------------------------------------------ input
_MOUSE = {'motion': '<Motion>', 'press': '<ButtonPress-1>', 'drag': '<B1-Motion>',
          'release': '<ButtonRelease-1>', 'right': '<ButtonPress-3>', 'wheel': '<MouseWheel>',
          'leave': '<Leave>', 'configure': '<Configure>'}


def _on_event(kind, x, y, a, b, c):
    try:
        if kind == 'key':
            fn = _root._binds.get('<KeyPress>') if _root else None
            if fn:
                fn(Event(keysym=str(a), char=str(b), state=int(c)))
        elif _root and _root._canvas:
            fn = _root._canvas._binds.get(_MOUSE[kind])
            if fn:
                if kind == 'configure':
                    fn(Event(width=int(x), height=int(y)))
                else:
                    fn(Event(x=x, y=y, delta=a))
    except Exception as e:
        _report(e)
    _flush()


BJ.onEvent = create_proxy(_on_event)


# ------------------------------------------------------------------ widgets
class Tk:
    def __init__(self):
        global _root
        _root = self
        self._binds = {}
        self._canvas = None
        self._protocols = {}

    # window chrome: the page owns all of it
    def withdraw(self): pass
    def deiconify(self): pass
    def title(self, *a): pass
    def configure(self, **kw): pass
    config = configure
    def resizable(self, *a): pass
    def minsize(self, *a): pass
    def geometry(self, *a): pass
    def iconphoto(self, *a, **kw): pass
    def mainloop(self): pass            # the browser's event loop is the main loop

    def protocol(self, name, fn=None):
        self._protocols[name] = fn

    def report_callback_exception(self, exc, val, tb):
        traceback.print_exception(exc, val, tb)

    def winfo_screenwidth(self):
        return int(js.screen.width)

    def winfo_screenheight(self):
        return int(js.screen.height)

    def attributes(self, name, value=None):
        if name == '-fullscreen':
            if value is None:
                return bool(BJ.isFullscreen())
            BJ.setFullscreen(bool(value))
        return None

    def bind(self, seq, fn=None):
        self._binds[seq] = fn

    def update_idletasks(self):
        _flush()

    def after(self, ms, func=None, *args):
        tid = next(_ids)
        entry = [time.perf_counter() + max(0, ms) / 1000.0, tid, tid, (lambda: func(*args)) if func else (lambda: None)]
        _live[tid] = entry
        heapq.heappush(_heap, entry)
        _arm()
        return tid

    def after_cancel(self, tid):
        entry = _live.pop(tid, None)
        if entry is not None:
            entry[3] = None

    def destroy(self):
        BJ.quit()


_CURSORS = {'hand2': 'pointer', 'hand1': 'pointer', 'arrow': 'default', 'xterm': 'text', '': 'default',
            'watch': 'wait', 'circle': 'not-allowed'}


class Canvas:
    def __init__(self, master=None, **kw):
        self.master = master
        self._bg = kw.get('bg', '#000000')
        self._items = {}
        self._order = []
        self._ids = itertools.count(1)
        self._dirty = True
        self._binds = {}
        if master is not None:
            master._canvas = self
        _canvases.append(self)

    def pack(self, **kw): pass

    def configure(self, **kw):
        if 'cursor' in kw:
            BJ.setCursor(_CURSORS.get(kw['cursor'], 'default'))
        if 'bg' in kw:
            self._bg = kw['bg']
            self._dirty = True
    config = configure

    def winfo_width(self):
        return int(BJ.width)

    def winfo_height(self):
        return int(BJ.height)

    def bind(self, seq, fn=None):
        self._binds[seq] = fn

    # ------------------------------------------------------------ items
    def _add(self, item):
        iid = next(self._ids)
        item.setdefault('state', 'normal')
        self._items[iid] = item
        self._order.append(iid)
        self._dirty = True
        return iid

    def create_image(self, x, y, image=None, anchor='center', state='normal', **kw):
        return self._add({'t': 'i', 'x': x, 'y': y, 'image': image, 'anchor': anchor, 'state': state})

    def create_text(self, x, y, text='', font=None, fill='#000000', anchor='center', justify='left',
                    width=0, angle=0, state='normal', **kw):
        return self._add({'t': 'x', 'x': x, 'y': y, 'text': str(text), 'font': font, 'fill': fill,
                          'anchor': anchor, 'justify': justify, 'width': width or 0, 'angle': angle,
                          'state': state})

    def create_rectangle(self, x0, y0, x1, y1, fill='', outline='#000000', width=1, state='normal', **kw):
        return self._add({'t': 'r', 'c': [x0, y0, x1, y1], 'fill': fill, 'outline': outline, 'width': width,
                          'state': state})

    def create_line(self, *coords, fill='#000000', width=1, smooth=False, dash=None, capstyle='butt',
                    joinstyle='round', state='normal', **kw):
        return self._add({'t': 'l', 'c': list(coords), 'fill': fill, 'width': width, 'smooth': bool(smooth),
                          'dash': dash, 'cap': capstyle, 'join': joinstyle, 'state': state})

    def create_polygon(self, *coords, fill='#000000', outline='', width=1, state='normal', **kw):
        return self._add({'t': 'p', 'c': list(coords), 'fill': fill, 'outline': outline, 'width': width,
                          'state': state})

    def coords(self, iid, *args):
        it = self._items.get(iid)
        if it is None:
            return []
        if len(args) == 1 and isinstance(args[0], (list, tuple)):
            args = tuple(args[0])
        if not args:
            return [it['x'], it['y']] if 'c' not in it else list(it['c'])
        if 'c' in it:
            it['c'] = list(args)
        else:
            it['x'], it['y'] = args[0], args[1]
        self._dirty = True
        return None

    def move(self, iid, dx, dy):
        it = self._items.get(iid)
        if it is None:
            return
        if 'c' in it:
            it['c'] = [v + (dx if i % 2 == 0 else dy) for i, v in enumerate(it['c'])]
        else:
            it['x'] += dx
            it['y'] += dy
        self._dirty = True

    def itemconfigure(self, iid, **kw):
        it = self._items.get(iid)
        if it is None:
            return
        for k, v in kw.items():
            if k == 'text':
                v = str(v)
            elif k == 'outline' and it['t'] == 'x':
                continue
            if k in ('image', 'text', 'font', 'fill', 'state', 'outline', 'width', 'anchor', 'justify',
                     'angle', 'smooth', 'dash'):
                it[k] = v
        self._dirty = True
    itemconfig = itemconfigure

    def delete(self, *ids):
        if 'all' in ids:
            self._items.clear()
            self._order.clear()
        else:
            for iid in ids:
                if self._items.pop(iid, None) is not None:
                    self._order.remove(iid)
        self._dirty = True

    def tag_lower(self, iid, below=None):
        if iid not in self._items:
            return
        self._order.remove(iid)
        if below is not None and below in self._items:
            self._order.insert(self._order.index(below), iid)
        else:
            self._order.insert(0, iid)
        self._dirty = True

    def tag_raise(self, iid, above=None):
        if iid not in self._items:
            return
        self._order.remove(iid)
        if above is not None and above in self._items:
            self._order.insert(self._order.index(above) + 1, iid)
        else:
            self._order.append(iid)
        self._dirty = True

    def bbox(self, iid):
        it = self._items.get(iid)
        if it is None:
            return None
        t = it['t']
        if t == 'x':
            f = it['font']
            w, h = BJ.textSize(it['text'], f.family, f.px, f.weight, f.slant, it['width']).to_py()
            ax, ay = _ANCHOR.get(it['anchor'], (.5, .5))
            x0, y0 = it['x'] - w * ax, it['y'] - h * ay
            return (int(x0), int(y0), int(x0 + w + .999), int(y0 + h + .999))
        if t == 'i':
            ph = it['image']
            w, h = (ph.width(), ph.height()) if ph else (0, 0)
            ax, ay = _ANCHOR.get(it['anchor'], (.5, .5))
            x0, y0 = it['x'] - w * ax, it['y'] - h * ay
            return (int(x0), int(y0), int(x0 + w), int(y0 + h))
        c = it['c']
        xs, ys = c[0::2], c[1::2]
        return (int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys)))

    # ------------------------------------------------------------ paint
    def _render(self):
        self._dirty = False
        out = []
        items = self._items
        for iid in self._order:
            it = items[iid]
            if it['state'] == 'hidden':
                continue
            t = it['t']
            if t == 'i':
                ph = it['image']
                if ph is not None and ph._id is not None:
                    out.append([0, ph._id, it['x'], it['y'], it['anchor']])
            elif t == 'x':
                f = it['font']
                if f is not None and it['text']:
                    out.append([1, it['text'], f.family, f.px, f.weight, f.slant, it['fill'], it['anchor'],
                                it['justify'], it['width'], it['angle'], it['x'], it['y']])
            elif t == 'r':
                out.append([2, it['c'], it['fill'], it['outline'], it['width']])
            elif t == 'l':
                dash = it['dash']
                if isinstance(dash, str):
                    dash = [float(d) for d in dash.replace(',', ' ').split()]
                out.append([3, it['c'], it['fill'], it['width'], it['smooth'], list(dash) if dash else None,
                            it['cap']])
            elif t == 'p':
                out.append([4, it['c'], it['fill'], it['outline'], it['width']])
        BJ.render(self._bg, json.dumps(out))


_ANCHOR = {'center': (.5, .5), 'n': (.5, 0), 's': (.5, 1), 'e': (1, .5), 'w': (0, .5),
           'nw': (0, 0), 'ne': (1, 0), 'sw': (0, 1), 'se': (1, 1)}
