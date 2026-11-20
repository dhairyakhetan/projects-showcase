"""PIL.ImageTk for the browser: a PhotoImage is a pixel buffer held by bridge.js."""
import itertools

import js
from pyodide.ffi import to_js

BJ = js.BJ
_ids = itertools.count(1)


class PhotoImage:
    def __init__(self, image=None, **kw):
        self._id = None
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        self._w, self._h = image.size
        self._id = next(_ids)
        BJ.setImage(self._id, self._w, self._h, to_js(image.tobytes()))

    def width(self):
        return self._w

    def height(self):
        return self._h

    def __del__(self):
        if self._id is not None:
            try:
                BJ.freeImage(self._id)
            except Exception:
                pass
