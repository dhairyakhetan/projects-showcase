import js

BJ = js.BJ

# Names the game's font picker looks for. bridge.js turns each into a CSS font
# stack, so the page uses whatever the visitor's system has.
_FAMILIES = ('Segoe UI', 'Georgia', 'Bahnschrift', 'Consolas', 'Arial')


def families(root=None):
    return _FAMILIES


class Font:
    def __init__(self, root=None, family='Segoe UI', size=12, weight='normal', slant='roman', **kw):
        self.family = family
        self.px = -size if size < 0 else max(1, round(size * 96 / 72))
        self.weight = weight
        self.slant = slant

    def measure(self, text):
        return int(round(BJ.measureText(str(text), self.family, self.px, self.weight, self.slant)))

    def metrics(self, option=None):
        asc, desc = BJ.fontMetrics(self.family, self.px, self.weight, self.slant).to_py()
        m = {'ascent': asc, 'descent': desc, 'linespace': asc + desc, 'fixed': 0}
        return m if option is None else m[option]

    def cget(self, key):
        return {'family': self.family, 'size': -self.px, 'weight': self.weight, 'slant': self.slant}[key]
