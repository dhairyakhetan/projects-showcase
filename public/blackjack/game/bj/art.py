"""
Small interface graphics (buttons, panels, pills, icons, the stats chart),
drawn with Pillow at the exact pixel size needed and cached.  Cards, chips,
the table and backgrounds are pre-rendered images - see gfx.py.
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

try:
    LANCZOS = Image.Resampling.LANCZOS
    BICUBIC = Image.Resampling.BICUBIC
    BILINEAR = Image.Resampling.BILINEAR
except AttributeError:  # Pillow < 9.1
    LANCZOS = Image.LANCZOS
    BICUBIC = Image.BICUBIC
    BILINEAR = Image.BILINEAR


HERE = os.path.dirname(os.path.abspath(__file__))

GOLD = (233, 196, 106)

GOLD_DARK = (176, 132, 48)

CREAM = (248, 244, 232)

INK = (24, 24, 28)

FELTS = {
    'green': ((30, 128, 74), (8, 58, 32)),
    'blue': ((30, 96, 158), (8, 32, 70)),
    'red': ((150, 32, 44), (62, 8, 16)),
    'purple': ((96, 52, 140), (36, 14, 62)),
    'black': ((62, 66, 72), (16, 17, 20)),
}

BACKS = {
    'red': ((168, 26, 34), (120, 14, 22)),
    'blue': ((32, 72, 160), (18, 40, 104)),
    'black': ((44, 44, 52), (18, 18, 22)),
    'green': ((22, 110, 64), (10, 66, 36)),
    'purple': ((104, 48, 150), (62, 22, 96)),
}


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(round(lerp(a, b, t))) for a, b in zip(c1, c2))


def lighten(c, t):
    return mix(c[:3], (255, 255, 255), t) + tuple(c[3:])


def darken(c, t):
    return mix(c[:3], (0, 0, 0), t) + tuple(c[3:])


def rgba(c, a=255):
    return tuple(c[:3]) + (int(a),)


def hexcolor(c):
    return '#%02x%02x%02x' % tuple(int(x) for x in c[:3])

_FONT_FILES = {
    'serif_bold': ['georgiab.ttf', 'DejaVuSerif-Bold.ttf', 'LiberationSerif-Bold.ttf', 'timesbd.ttf',
                   'Georgia Bold.ttf', 'Times New Roman Bold.ttf'],
    'serif_bold_italic': ['georgiaz.ttf', 'DejaVuSerif-BoldItalic.ttf', 'LiberationSerif-BoldItalic.ttf',
                          'timesbi.ttf', 'Georgia Bold Italic.ttf'],
    'serif': ['georgia.ttf', 'DejaVuSerif.ttf', 'LiberationSerif-Regular.ttf', 'times.ttf', 'Georgia.ttf'],
    'sans_bold': ['segoeuib.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Bold.ttf',
                  'Arial Bold.ttf', 'Helvetica.ttc'],
    'sans_black': ['seguibl.ttf', 'ariblk.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Bold.ttf',
                   'Arial Black.ttf'],
    'sans': ['segoeui.ttf', 'arial.ttf', 'DejaVuSans.ttf', 'LiberationSans-Regular.ttf', 'Arial.ttf'],
}

_FONT_DIRS = [os.path.join(os.environ.get('WINDIR', r'C:\Windows'), 'Fonts'),
              os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'Windows', 'Fonts'),
              '/usr/share/fonts', '/usr/local/share/fonts', os.path.expanduser('~/.fonts'),
              '/Library/Fonts', '/System/Library/Fonts', '/System/Library/Fonts/Supplemental',
              os.path.join(HERE, '..', 'assets', 'fonts')]

_font_path_cache = {}

_font_cache = {}


def _find_font_file(name):
    if name in _font_path_cache:
        return _font_path_cache[name]
    found = None
    for d in _FONT_DIRS:
        if not d or not os.path.isdir(d):
            continue
        p = os.path.join(d, name)
        if os.path.exists(p):
            found = p
            break
    if found is None:
        low = name.lower()
        for d in _FONT_DIRS[2:6]:
            if not os.path.isdir(d):
                continue
            for root, _dirs, files in os.walk(d):
                for f in files:
                    if f.lower() == low:
                        found = os.path.join(root, f)
                        break
                if found:
                    break
            if found:
                break
    _font_path_cache[name] = found
    return found


def font(role, px):
    px = max(4, int(round(px)))
    key = (role, px)
    f = _font_cache.get(key)
    if f is not None:
        return f
    for name in _FONT_FILES.get(role, _FONT_FILES['sans']):
        path = _find_font_file(name)
        if path:
            try:
                f = ImageFont.truetype(path, px)
                break
            except Exception:
                continue
    if f is None:
        try:
            f = ImageFont.load_default(px)
        except TypeError:
            f = ImageFont.load_default()
    _font_cache[key] = f
    return f


def text_size(fnt, text):
    x0, y0, x1, y1 = ImageDraw.Draw(Image.new('L', (1, 1))).textbbox((0, 0), text, font=fnt)
    return x1 - x0, y1 - y0


def shadowed(img, blur, offset=(0, 0), opacity=0.5, pad=None, color=(0, 0, 0)):
    """Return img placed on a bigger canvas with a soft drop shadow.
    The blur runs on a 1/4-size copy (a big soft blur looks the same, ~10x faster)."""
    if pad is None:
        pad = int(blur * 2 + max(abs(offset[0]), abs(offset[1])))
    w, h = img.size
    size = (w + 2 * pad, h + 2 * pad)
    sh = Image.new('L', size, 0)
    sh.paste(img.getchannel('A'), (pad + int(offset[0]), pad + int(offset[1])))
    if blur > 0:
        k = 4 if blur >= 6 else 1
        small = sh.resize((max(1, size[0] // k), max(1, size[1] // k)), BILINEAR) if k > 1 else sh
        small = small.filter(ImageFilter.GaussianBlur(blur / k))
        sh = small.resize(size, BILINEAR) if k > 1 else small
    sh = sh.point(lambda v: int(v * opacity))
    out = Image.new('RGBA', size, rgba(color, 0))
    out.putalpha(sh)
    out.alpha_composite(img, (pad, pad))
    return out


def vgradient(w, h, top, bottom):
    g = Image.linear_gradient('L').resize((max(1, w), max(1, h)), BILINEAR)
    a = Image.new('RGBA', (w, h), rgba(top))
    b = Image.new('RGBA', (w, h), rgba(bottom))
    return Image.composite(b, a, g)


def radial_mask(w, h, cx=0.5, cy=0.5, rx=0.5, ry=0.5):
    """L image: 0 at centre -> 255 at the ellipse edge (and beyond)."""
    # Pillow's gradient reaches 255 at the corners (radius ~181); rescale so 255 is at radius 128
    g = Image.radial_gradient('L').point(lambda v: min(255, int(v * 181.02 / 128.0)))
    # scale the 256 gradient so its radius (128px) maps to rx*w / ry*h
    sx = (rx * w) / 128.0
    sy = (ry * h) / 128.0
    gw, gh = max(2, int(256 * sx)), max(2, int(256 * sy))
    g = g.resize((gw, gh), BILINEAR)
    out = Image.new('L', (w, h), 255)
    out.paste(g, (int(cx * w - gw / 2), int(cy * h - gh / 2)))
    return out


def rounded_mask(w, h, r, ss=1):
    m = Image.new('L', (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * ss - 1, h * ss - 1], r * ss, fill=255)
    if ss > 1:
        m = m.resize((w, h), LANCZOS)
    return m


def card_pad(w):
    return int(w * 0.09 + 2)


def chip_pad(d):
    return int(d * 0.14 + 2)

BUTTON_STYLES = {
    'gold': ((250, 214, 112), (205, 148, 40), (122, 82, 14), (40, 26, 4)),
    'green': ((80, 186, 96), (32, 124, 52), (14, 70, 26), (255, 255, 255)),
    'red': ((234, 92, 80), (170, 38, 34), (92, 16, 14), (255, 255, 255)),
    'blue': ((88, 150, 236), (38, 92, 186), (16, 46, 104), (255, 255, 255)),
    'amber': ((255, 186, 84), (218, 124, 22), (112, 58, 6), (40, 22, 4)),
    'purple': ((166, 116, 230), (108, 60, 178), (58, 26, 104), (255, 255, 255)),
    'slate': ((134, 144, 160), (80, 88, 104), (38, 42, 52), (255, 255, 255)),
    'dark': ((62, 66, 76), (30, 32, 38), (12, 12, 16), (240, 232, 214)),
    'felt': ((40, 120, 80), (18, 74, 44), (8, 40, 22), (255, 255, 255)),
}


def button_text_color(style):
    if style == 'ghost':
        return GOLD
    return BUTTON_STYLES.get(style, BUTTON_STYLES['dark'])[3]


def render_button(w, h, style='dark', state='normal', radius=None, ss=3):
    w, h = int(w), int(h)
    r = (h * 0.5 if radius is None else radius)
    W, H = w * ss, h * ss
    R = int(r * ss)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], R, fill=255)
    if style == 'ghost':
        fill_top, fill_bot, border = (40, 36, 30), (18, 16, 14), GOLD
        alpha = 150
    elif style == 'glass':
        fill_top, fill_bot, border = (60, 60, 66), (26, 26, 30), (120, 110, 90)
        alpha = 200
    else:
        fill_top, fill_bot, border, _ = BUTTON_STYLES.get(style, BUTTON_STYLES['dark'])
        alpha = 255
    if state == 'hover':
        fill_top, fill_bot = lighten(fill_top, 0.14), lighten(fill_bot, 0.12)
        if style in ('ghost', 'glass'):
            alpha = 220
    elif state == 'pressed':
        fill_top, fill_bot = darken(fill_top, 0.12), darken(fill_bot, 0.06)
    grad = vgradient(W, H, fill_top, fill_bot)
    grad.putalpha(mask.point(lambda v: int(v * alpha / 255)))
    img = grad
    d = ImageDraw.Draw(img)
    bw = max(1, int(ss * 1.4))
    if state != 'pressed' and style not in ('ghost',):
        # soft gloss on the upper half
        gl = Image.linear_gradient('L').resize((W, H), BILINEAR).point(
            lambda v: int(max(0, 70 - v * 0.55)) if v < 128 else 0)
        gloss = Image.new('RGBA', (W, H), (255, 255, 255, 0))
        gloss.putalpha(ImageChops.multiply(gl, mask))
        img = Image.alpha_composite(img, gloss)
        d = ImageDraw.Draw(img)
        # 1px light line just inside the top edge
        d.arc([bw, bw, W - 1 - bw, H * 2 - bw], 200, 340, fill=(255, 255, 255, 60), width=bw) if False else None
    d.rounded_rectangle([0, 0, W - 1, H - 1], R, outline=rgba(border, 255 if style != 'ghost' else 200),
                        width=bw if style != 'ghost' else int(bw * 1.2))
    out = img.resize((w, h), LANCZOS)
    if state == 'disabled':
        gray = out.convert('LA').convert('RGBA')
        a = out.split()[3].point(lambda v: int(v * 0.42))
        gray.putalpha(a)
        out = gray
    pad = max(2, int(h * 0.18))
    return shadowed(out, h * 0.07, (0, h * 0.06), 0.45 if state != 'disabled' else 0.15, pad=pad)


def button_pad(h):
    return max(2, int(h * 0.18))


def render_panel(w, h, radius=14, fill=(14, 16, 20, 220), border=(233, 196, 106, 120), border_w=1.5,
                 shadow=True, ss=2, gradient=True):
    """Rounded panel.  Only the masks (single channel) are supersampled, so even
    window-sized panels are quick to make."""
    w, h = max(2, int(w)), max(2, int(h))
    W, H = w * ss, h * ss
    R = int(radius * ss)
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, W - 1, H - 1], R, fill=255)
    mask = m.resize((w, h), BILINEAR)
    if gradient:
        out = vgradient(w, h, lighten(fill[:3], 0.07), fill[:3])
    else:
        out = Image.new('RGBA', (w, h), rgba(fill))
    out.putalpha(mask.point(lambda v: int(v * fill[3] / 255)))
    if border and border_w > 0:
        bm = Image.new('L', (W, H), 0)
        ImageDraw.Draw(bm).rounded_rectangle([0, 0, W - 1, H - 1], R, outline=255, width=max(1, int(border_w * ss)))
        bm = bm.resize((w, h), BILINEAR).point(lambda v: int(v * (border[3] if len(border) > 3 else 255) / 255))
        layer = Image.new('RGBA', (w, h), rgba(border[:3], 0))
        layer.putalpha(bm)
        out = Image.alpha_composite(out, layer)
    if shadow:
        out = shadowed(out, max(2, min(w, h) * 0.04), (0, max(2, h * 0.02)), 0.5, pad=int(max(6, min(w, h) * 0.1)))
    return out


def panel_pad(w, h):
    return int(max(6, min(int(w), int(h)) * 0.1))


def render_pill(w, h, fill, border=None, ss=3):
    w, h = max(2, int(w)), max(2, int(h))
    W, H = w * ss, h * ss
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, W - 1, H - 1], H // 2, fill=rgba(fill, fill[3] if len(fill) > 3 else 255),
                        outline=border, width=max(1, int(ss * 1.2)) if border else 0)
    out = img.resize((w, h), LANCZOS)
    return shadowed(out, max(1, h * 0.12), (0, h * 0.08), 0.5, pad=max(2, int(h * 0.3)))


def pill_pad(h):
    return max(2, int(h * 0.3))


def render_glow(w, h, color=GOLD, strength=0.7):
    w, h = int(w), int(h)
    img = Image.new('RGBA', (w, h), rgba(color, 0))
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).ellipse([w * 0.18, h * 0.22, w * 0.82, h * 0.78], fill=int(255 * strength))
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) * 0.12))
    img.putalpha(m)
    return img


def render_ring(d, color=GOLD, width=3, ss=4):
    D = int(d * ss)
    img = Image.new('RGBA', (D, D), (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse([width * ss, width * ss, D - 1 - width * ss, D - 1 - width * ss],
                                outline=rgba(color), width=int(width * ss))
    return img.resize((int(d), int(d)), LANCZOS)


def render_overlay(w, h, alpha=150, color=(0, 0, 0)):
    return Image.new('RGBA', (max(1, int(w)), max(1, int(h))), rgba(color, alpha))


def render_hgradient_bar(w, h, color=(0, 0, 0), a_top=0, a_bot=220):
    g = Image.linear_gradient('L').resize((max(1, int(w)), max(1, int(h))), BILINEAR)
    g = g.point(lambda v: int(a_top + (a_bot - a_top) * v / 255))
    img = Image.new('RGBA', (max(1, int(w)), max(1, int(h))), rgba(color))
    img.putalpha(g)
    return img


def render_icon(name, size, color=(240, 232, 214), ss=4):
    S = int(size * ss)
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = rgba(color)
    w = max(2, int(S * 0.11))
    m = S * 0.18

    def L(*pts, width=w):
        d.line([(x * S, y * S) for x, y in pts], fill=c, width=width, joint='curve')
        for x, y in (pts[0], pts[-1]):
            r = width / 2
            d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=c)

    if name == 'plus':
        L((.2, .5), (.8, .5)); L((.5, .2), (.5, .8))
    elif name == 'stand':
        # flat hand: a rounded palm with fingers
        d.rounded_rectangle([S * .26, S * .44, S * .74, S * .86], int(S * .12), fill=c)
        for i, x in enumerate((.29, .41, .53, .65)):
            top = (.2, .14, .16, .24)[i]
            d.rounded_rectangle([S * x, S * top, S * (x + .09), S * .6], int(S * .045), fill=c)
        d.rounded_rectangle([S * .08, S * .48, S * .32, S * .58], int(S * .045), fill=c)
    elif name == 'double':
        f = font('sans_black', S * .5)
        d.text((S * .5, S * .52), '2\u00d7', font=f, fill=c, anchor='mm')
    elif name == 'split':
        L((.5, .85), (.5, .55)); L((.5, .55), (.22, .2)); L((.5, .55), (.78, .2))
        for (x, y, dx) in ((.22, .2, 1), (.78, .2, -1)):
            d.polygon([(x * S, y * S - w), (x * S + dx * S * .18, y * S), (x * S, y * S + S * .14)], fill=c)
    elif name == 'flag':
        L((.28, .9), (.28, .12))
        d.polygon([(.3 * S, .14 * S), (.82 * S, .28 * S), (.3 * S, .48 * S)], fill=c)
    elif name == 'menu':
        for y in (.28, .5, .72):
            L((.2, y), (.8, y))
    elif name == 'gear':
        cx = cy = S / 2
        for k in range(8):
            a = k * math.pi / 4
            d.line([(cx + math.cos(a) * S * .2, cy + math.sin(a) * S * .2),
                    (cx + math.cos(a) * S * .42, cy + math.sin(a) * S * .42)], fill=c, width=int(S * .14))
        d.ellipse([cx - S * .3, cy - S * .3, cx + S * .3, cy + S * .3], fill=c)
        d.ellipse([cx - S * .12, cy - S * .12, cx + S * .12, cy + S * .12], fill=(0, 0, 0, 0))
    elif name in ('sound', 'mute'):
        d.polygon([(.14 * S, .38 * S), (.32 * S, .38 * S), (.54 * S, .18 * S), (.54 * S, .82 * S),
                   (.32 * S, .62 * S), (.14 * S, .62 * S)], fill=c)
        if name == 'sound':
            for r in (.18, .3):
                d.arc([(.5 - r) * S, (.5 - r) * S, (.5 + r) * S + S * .12, (.5 + r) * S], -50, 50, fill=c,
                      width=int(S * .08))
        else:
            L((.66, .36), (.9, .64), width=int(S * .08)); L((.9, .36), (.66, .64), width=int(S * .08))
    elif name == 'info':
        d.ellipse([S * .08, S * .08, S * .92, S * .92], outline=c, width=int(S * .08))
        f = font('serif_bold', S * .56)
        d.text((S * .5, S * .54), 'i', font=f, fill=c, anchor='mm')
    elif name == 'stats':
        for i, hgt in enumerate((.35, .6, .45, .8)):
            x = .16 + i * .19
            d.rounded_rectangle([x * S, (.9 - hgt) * S, (x + .13) * S, .9 * S], int(S * .03), fill=c)
    elif name == 'back':
        L((.75, .5), (.25, .5)); L((.25, .5), (.48, .26)); L((.25, .5), (.48, .74))
    elif name == 'close':
        L((.25, .25), (.75, .75)); L((.75, .25), (.25, .75))
    elif name == 'play':
        d.polygon([(.3 * S, .18 * S), (.82 * S, .5 * S), (.3 * S, .82 * S)], fill=c)
    elif name == 'step':
        d.polygon([(.2 * S, .2 * S), (.64 * S, .5 * S), (.2 * S, .8 * S)], fill=c)
        d.rounded_rectangle([.68 * S, .2 * S, .82 * S, .8 * S], int(S * .03), fill=c)
    elif name == 'hint':
        d.ellipse([.24 * S, .08 * S, .76 * S, .6 * S], fill=c)
        d.rectangle([.38 * S, .5 * S, .62 * S, .72 * S], fill=c)
        d.rounded_rectangle([.36 * S, .76 * S, .64 * S, .9 * S], int(S * .04), fill=c)
    elif name == 'undo':
        d.arc([.18 * S, .22 * S, .82 * S, .86 * S], 200, 360 + 90, fill=c, width=w)
        d.polygon([(.08 * S, .44 * S), (.36 * S, .4 * S), (.2 * S, .66 * S)], fill=c)
    elif name == 'rebet':
        d.arc([.16 * S, .16 * S, .84 * S, .84 * S], 40, 330, fill=c, width=w)
        d.polygon([(.86 * S, .2 * S), (.9 * S, .5 * S), (.62 * S, .38 * S)], fill=c)
    elif name == 'trash':
        d.rounded_rectangle([.26 * S, .32 * S, .74 * S, .9 * S], int(S * .06), outline=c, width=w)
        L((.16, .24), (.84, .24))
        L((.4, .12), (.6, .12))
    elif name == 'x2':
        f = font('sans_black', S * .48)
        d.text((S * .5, S * .52), '\u00d72', font=f, fill=c, anchor='mm')
    elif name == 'check':
        L((.2, .52), (.42, .74)); L((.42, .74), (.82, .28))
    elif name == 'cross':
        L((.25, .25), (.75, .75)); L((.75, .25), (.25, .75))
    elif name == 'eye':
        d.ellipse([.06 * S, .26 * S, .94 * S, .74 * S], outline=c, width=w)
        d.ellipse([.36 * S, .36 * S, .64 * S, .64 * S], fill=c)
    elif name == 'cards':
        d.rounded_rectangle([.12 * S, .2 * S, .58 * S, .86 * S], int(S * .06), outline=c, width=int(S * .08))
        d.rounded_rectangle([.42 * S, .12 * S, .88 * S, .78 * S], int(S * .06), fill=c)
    elif name == 'fullscreen':
        for (x, y, dx, dy) in ((.18, .18, 1, 1), (.82, .18, -1, 1), (.18, .82, 1, -1), (.82, .82, -1, -1)):
            L((x, y), (x + dx * .22, y)); L((x, y), (x, y + dy * .22))
    elif name == 'chip':
        d.ellipse([.1 * S, .1 * S, .9 * S, .9 * S], outline=c, width=int(S * .1))
        d.ellipse([.32 * S, .32 * S, .68 * S, .68 * S], fill=c)
    elif name == 'shield':
        d.polygon([(.18 * S, .14 * S), (.82 * S, .14 * S), (.82 * S, .5 * S), (.5 * S, .9 * S),
                   (.18 * S, .5 * S)], fill=c)
    elif name == 'quit':
        d.arc([.18 * S, .2 * S, .82 * S, .84 * S], -60, 240, fill=c, width=w)
        L((.5, .1), (.5, .48))
    return img.resize((int(size), int(size)), LANCZOS)


def render_line_chart(w, h, values, S=1.0, color=GOLD, baseline=None):
    """Smooth anti-aliased line chart (used for bankroll history)."""
    ss = 2
    W, H = int(w * ss), int(h * ss)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad_l, pad_r, pad_t, pad_b = 70 * S * ss, 16 * S * ss, 16 * S * ss, 30 * S * ss
    if len(values) < 2:
        values = list(values) + list(values) if values else [0, 0]
    lo, hi = min(values), max(values)
    if baseline is not None:
        lo, hi = min(lo, baseline), max(hi, baseline)
    if hi - lo < 1:
        hi += 100
        lo -= 100
    span = hi - lo
    lo -= span * 0.08
    hi += span * 0.08

    def X(i):
        return pad_l + (W - pad_l - pad_r) * i / (len(values) - 1)

    def Y(v):
        return pad_t + (H - pad_t - pad_b) * (1 - (v - lo) / (hi - lo))
    f = font('sans', 12 * S * ss)
    for k in range(5):
        v = lo + (hi - lo) * k / 4
        y = Y(v)
        d.line([(pad_l, y), (W - pad_r, y)], fill=(255, 255, 255, 28), width=max(1, ss))
        label = f'${v / 100:,.0f}'
        d.text((pad_l - 8 * S * ss, y), label, font=f, fill=(200, 190, 170, 200), anchor='rm')
    if baseline is not None:
        y = Y(baseline)
        for xx in range(int(pad_l), int(W - pad_r), int(14 * ss)):
            d.line([(xx, y), (xx + 7 * ss, y)], fill=(255, 255, 255, 90), width=max(1, ss))
    pts = [(X(i), Y(v)) for i, v in enumerate(values)]
    poly = pts + [(pts[-1][0], H - pad_b), (pts[0][0], H - pad_b)]
    fill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(fill).polygon(poly, fill=rgba(color, 46))
    img = Image.alpha_composite(img, fill)
    d = ImageDraw.Draw(img)
    d.line(pts, fill=rgba(color), width=max(2, int(3 * S * ss)), joint='curve')
    x, y = pts[-1]
    r = 5 * S * ss
    d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(color))
    d.text((pad_l, H - pad_b + 8 * S * ss), 'older', font=f, fill=(170, 160, 140, 180), anchor='lt')
    d.text((W - pad_r, H - pad_b + 8 * S * ss), 'now', font=f, fill=(170, 160, 140, 180), anchor='rt')
    return img.resize((int(w), int(h)), LANCZOS)
