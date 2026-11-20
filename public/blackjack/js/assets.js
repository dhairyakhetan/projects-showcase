// Artwork: the pre-rendered table, cards, chips and intro scene, plus the icon
// sheet. Loaded in priority order so the menu can open while the rest arrives.
const BASE = "/blackjack/";
const IMG = BASE + "assets/img/";

// [name, url, approx KB, needed before the menu opens]
const FILES = [
  ["atlas", IMG + "atlas.json", 9, true],
  ["icons", BASE + "js/icons.png", 47, true],
  ["bg", IMG + "bg.jpg", 41, true],
  ["ui", IMG + "ui.png", 149, true],
  ["chips", IMG + "chips.png", 338, true],
  ["cards", IMG + "cards.png", 1386, true],
  ["felt_green", IMG + "felt_green.jpg", 127, false],
  ["intro", IMG + "intro.png", 689, false],
  ["intro_bg", IMG + "intro_bg.jpg", 103, false],
  ["felt_blue", IMG + "felt_blue.jpg", 129, false], ["felt_red", IMG + "felt_red.jpg", 123, false],
  ["felt_purple", IMG + "felt_purple.jpg", 125, false], ["felt_black", IMG + "felt_black.jpg", 123, false],
];

const CHIP_D = 112;

export class Assets {
  constructor(feltFirst = "green") {
    this.img = {};
    this.meta = null; this.iconMeta = null;
    this.pending = new Map();
    this.tinted = new Map();
    this.order = FILES.map((f) => f.slice());
    // the player's own felt colour goes first
    const i = this.order.findIndex((f) => f[0] === "felt_" + feltFirst);
    if (i > 1) this.order.splice(7, 0, ...this.order.splice(i, 1));
  }

  /** Starts every download. Returns {essential, all}; onProgress(0..1) counts bytes by approximate size. */
  load(onProgress) {
    const total = this.order.reduce((a, f) => a + f[2], 0);
    let done = 0;
    const loadOne = async ([name, url, kb]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${name}: ${res.status}`);
        if (name === "atlas") this.meta = await res.json();
        else this.img[name] = await createImageBitmap(await res.blob());
      } catch (e) { console.error(e); }
      done += kb;
      onProgress?.(done / total);
    };
    const essential = Promise.all(this.order.filter((f) => f[3]).map(loadOne)).then(async () => {
      this.iconMeta = await (await fetch(BASE + "js/icons.json")).json();
    });
    const all = Promise.all([essential, ...this.order.filter((f) => !f[3]).map(loadOne)]);
    for (const f of this.order) this.pending.set(f[0], null);
    this._all = all;
    return { essential, all };
  }

  /** Resolves once a named image has arrived (menu can open before the intro art has). */
  async ready(name) {
    while (!this.img[name]) await new Promise((r) => setTimeout(r, 60));
    return this.img[name];
  }

  // ------------------------------------------------------------ icons
  drawIcon(ctx, name, cx, cy, size, color) {
    const sheet = this.img.icons, m = this.iconMeta;
    if (!sheet || !m || !m.icons[name]) return;
    const key = `${name}|${color}`;
    let c = this.tinted.get(key);
    if (!c) {
      c = document.createElement("canvas"); c.width = c.height = m.size;
      const g = c.getContext("2d");
      const [sx, sy] = m.icons[name];
      g.drawImage(sheet, sx, sy, m.size, m.size, 0, 0, m.size, m.size);
      g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, m.size, m.size);
      this.tinted.set(key, c);
    }
    ctx.drawImage(c, cx - size / 2, cy - size / 2, size, size);
  }

  // ------------------------------------------------------------ sprites
  _rect(sheet, key) { return this.meta?.sheets[sheet]?.[key]; }

  /** A card centred on (cx, cy). flip 0..1: 0 = back up, 1 = face up (squashes through the middle). */
  card(ctx, code, cx, cy, o = {}) {
    const m = this.meta, img = this.img.cards;
    if (!m || !img) return;
    const back = o.back && m.backs.includes(o.back) ? o.back : "red";
    const faceKey = o.fourColor && "DC".includes(code.slice(-1)) ? code + "4" : code;
    const flip = o.flip ?? 1, sx = Math.abs(Math.cos((1 - flip) * Math.PI));
    const key = code === "BACK" || flip < 0.5 ? "BACK_" + back : faceKey;
    const r = this._rect("cards", key);
    if (!r) return;
    const s = o.scale ?? 1, w = (r[2] / m.card_scale) * s, h = (r[3] / m.card_scale) * s;
    ctx.save();
    ctx.translate(cx, cy);
    if (o.rot) ctx.rotate(o.rot);
    if (o.rotated) ctx.rotate(Math.PI / 2);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.scale(o.flip === undefined ? 1 : Math.max(0.02, sx), 1);
    ctx.drawImage(img, r[0], r[1], r[2], r[3], -w / 2, -h / 2 - (o.lift || 0), w, h);
    ctx.restore();
  }

  chip(ctx, denom, cx, cy, d, shadow = true) {
    const r = this._rect("chips", `${denom}_${shadow ? 1 : 0}`), img = this.img.chips;
    if (!r || !img) return;
    const f = d / CHIP_D, w = r[2] * f, h = r[3] * f;
    ctx.drawImage(img, r[0], r[1], r[2], r[3], cx - w / 2, cy - h / 2, w, h);
  }

  logo(ctx, cx, cy, height) {
    const r = this._rect("ui", "logo"), img = this.img.ui;
    if (!r || !img) return;
    const f = height / (96 * this.meta.bg_scale), w = r[2] * f, h = r[3] * f;
    ctx.drawImage(img, r[0], r[1], r[2], r[3], cx - w / 2, cy - h / 2, w, h);
  }

  /** A pre-rendered image drawn so its design-space top-left is (x, y). */
  introSprite(ctx, key, x, y, anchorTopLeft = true) {
    const r = this._rect("intro", key), img = this.img.intro;
    if (!r || !img) return;
    const f = 1 / this.meta.char_scale;
    ctx.drawImage(img, r[0], r[1], r[2], r[3], x, y, r[2] * f, r[3] * f);
  }

  /** Full-window background: the jpg sits on the design area (with its margin); edges stretch outward. */
  background(ctx, app, name) {
    const img = this.img[name], m = this.meta;
    if (!img || !m) return;
    const f = 1 / m.bg_scale, [mx, my] = m.margin, x = -mx, y = -my, w = img.width * f, h = img.height * f;
    const [vx0, vy0, vx1, vy1] = app.view;
    ctx.drawImage(img, x, y, w, h);
    if (vx0 < x) ctx.drawImage(img, 0, 0, 1, img.height, vx0 - 2, y, x - vx0 + 3, h);
    if (vx1 > x + w) ctx.drawImage(img, img.width - 1, 0, 1, img.height, x + w - 1, y, vx1 - (x + w) + 3, h);
    if (vy0 < y) ctx.drawImage(img, 0, 0, img.width, 1, vx0 - 2, vy0 - 2, vx1 - vx0 + 4, y - vy0 + 3);
    if (vy1 > y + h) ctx.drawImage(img, 0, img.height - 1, img.width, 1, vx0 - 2, y + h - 1, vx1 - vx0 + 4, vy1 - (y + h) + 3);
  }

  felt(ctx, app, scheme, lines) {
    const name = "felt_" + (this.meta?.felts.includes(scheme) ? scheme : "green");
    this.background(ctx, app, this.img[name] ? name : "felt_green");
    const img = this.img.ui;
    if (!img) return;
    for (const t of lines) {
      const r = this._rect("ui", "line:" + t), p = this.meta.felt_lines[t];
      if (r && p) ctx.drawImage(img, r[0], r[1], r[2], r[3], p[0], p[1], r[2] / this.meta.bg_scale, r[3] / this.meta.bg_scale);
    }
  }
}
