"""
Loads the pre-rendered artwork in assets/img (made by tools/make_images.py)
and scales it to the window.  Nothing here draws - it only crops and resizes.
"""
from __future__ import annotations

import json
import os

from PIL import Image

try:
    LANCZOS = Image.Resampling.LANCZOS
    BILINEAR = Image.Resampling.BILINEAR
    BICUBIC = Image.Resampling.BICUBIC
    ROTATE_90 = Image.Transpose.ROTATE_90
except AttributeError:  # Pillow < 9.1
    LANCZOS, BILINEAR, BICUBIC, ROTATE_90 = Image.LANCZOS, Image.BILINEAR, Image.BICUBIC, Image.ROTATE_90

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img')
CARD_W, CARD_H = 108, 151

_meta = None
_files = {}
_crops = {}


def meta():
    global _meta
    if _meta is None:
        with open(os.path.join(DIR, 'atlas.json')) as f:
            _meta = json.load(f)
    return _meta


def _file(name):
    img = _files.get(name)
    if img is None:
        img = Image.open(os.path.join(DIR, name))
        img = img.convert('RGBA' if name.endswith('.png') else 'RGB')
        _files[name] = img
    return img


def sprite(sheet, key):
    k = (sheet, key)
    img = _crops.get(k)
    if img is None:
        x, y, w, h = meta()['sheets'][sheet][key]
        img = _crops[k] = _file(sheet + '.png').crop((x, y, x + w, y + h))
    return img


def scale(img, f):
    w, h = max(1, round(img.width * f)), max(1, round(img.height * f))
    if (w, h) == img.size:
        return img
    return img.resize((w, h), LANCZOS, reducing_gap=3.0)


def preload(felt='green'):
    """Decode the image files on a background thread while the menu is showing
    (Pillow releases the GIL while decoding, so the UI keeps running)."""
    import threading
    names = ['cards.png', 'chips.png', 'ui.png', f'felt_{felt}.jpg', 'intro.png', 'intro_bg.jpg']

    def work():
        for n in names:
            try:
                _file(n)
            except Exception:
                pass
    threading.Thread(target=work, name='bj-preload', daemon=True).start()


# ----------------------------------------------------------------- cards & chips
def card(code, w_px, back='red', four_color=False, rotated=False):
    """Card image (with its soft shadow) whose card body is w_px wide."""
    m = meta()
    if code == 'BACK':
        key = 'BACK_' + (back if back in m['backs'] else 'red')
    else:
        key = code + '4' if four_color and code[-1] in 'DC' else code
    img = scale(sprite('cards', key), w_px / (CARD_W * m['card_scale']))
    return img.transpose(ROTATE_90) if rotated else img


def chip(denom, d_px, shadow=True):
    img = sprite('chips', f'{denom}_{int(bool(shadow))}')
    return scale(img, d_px / meta()['chip_d'])


def flip_frame(img, sx, lift=0.0):
    """Horizontally squash an image (card flip animation)."""
    w, h = img.size
    return img.resize((max(2, int(w * sx)), int(h * (1 + lift))), BILINEAR)


def logo(height_px):
    return scale(sprite('ui', 'logo'), height_px / (96 * meta()['bg_scale']))


def intro(key, S):
    return scale(sprite('intro', key), S / meta()['char_scale'])


# ----------------------------------------------------------------- full-window backgrounds
def _place(img, W, H, x, y):
    """Put img at (x, y) on a W x H canvas; areas it doesn't reach repeat its edge."""
    out = Image.new('RGB', (W, H))
    iw, ih = img.size
    # stretch edge rows/columns outwards so letterbox areas blend in
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + iw), min(H, y + ih)
    if x0 >= x1 or y0 >= y1:
        return img.resize((W, H))
    core = img.crop((x0 - x, y0 - y, x1 - x, y1 - y))
    if y0 > 0:
        out.paste(core.crop((0, 0, core.width, 1)).resize((core.width, y0)), (x0, 0))
    if y1 < H:
        out.paste(core.crop((0, core.height - 1, core.width, core.height)).resize((core.width, H - y1)), (x0, y1))
    out.paste(core, (x0, y0))
    if x0 > 0:
        out.paste(out.crop((x0, 0, x0 + 1, H)).resize((x0, H)), (0, 0))
    if x1 < W:
        out.paste(out.crop((x1 - 1, 0, x1, H)).resize((W - x1, H)), (x1, 0))
    return out


def background(name, W, H, S, ox, oy, overlays=()):
    """A background jpg scaled so its design area lines up with the window.
    overlays: [(rgba image at bg scale, design_x, design_y)]"""
    m = meta()
    f = S / m['bg_scale']
    mx, my = m['margin']
    img = scale(_file(name), f)
    if overlays:
        img = img.copy()
        for ov, dx, dy in overlays:
            o = scale(ov, f)
            img.paste(o, (round((dx + mx) * S), round((dy + my) * S)), o)
    return _place(img, W, H, round(ox - mx * S), round(oy - my * S))


def felt(scheme, lines, W, H, S, ox, oy):
    m = meta()
    scheme = scheme if scheme in m['felts'] else 'green'
    ovs = [(sprite('ui', 'line:' + t), *m['felt_lines'][t]) for t in lines if 'line:' + t in m['sheets']['ui']]
    return background(f'felt_{scheme}.jpg', W, H, S, ox, oy, ovs)
