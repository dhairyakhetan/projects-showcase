// Runs the Python Blackjack game in the browser.
//
// Pyodide (CPython in WebAssembly, with Pillow) runs the game unchanged. The
// game draws through a tkinter stand-in (game/web/tkinter) that hands its item
// list to BJ.render below, which paints it on one <canvas>. This file also
// feeds mouse/keyboard events back to Python, plays sound with Web Audio, and
// keeps the save file in localStorage.

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/";
const GAME = "/blackjack/game/";
const SAVE_KEY = "bj-save";

const SOUNDS = ["blackjack", "bust", "card_deal", "card_flip", "card_place", "cash", "chair", "chip1", "chip2",
  "chip3", "chips_payout", "chips_stack", "click", "deny", "hover", "lose", "notify", "pop", "push", "shuffle",
  "step1", "step2", "whoosh", "win"];

const FILES = [
  "bj/__init__.py", "bj/art.py", "bj/boot.py", "bj/engine.py", "bj/gfx.py", "bj/main.py", "bj/sound.py",
  "bj/sprites.py", "bj/store.py", "bj/strategy.py", "bj/ui.py",
  "bj/scenes/__init__.py", "bj/scenes/common.py", "bj/scenes/intro.py", "bj/scenes/menu.py",
  "bj/scenes/settings.py", "bj/scenes/stats.py", "bj/scenes/table.py",
  "web/start.py", "web/imagetk.py", "web/websound.py", "web/tkinter/__init__.py", "web/tkinter/font.py",
  "assets/img/atlas.json", "assets/img/bg.jpg", "assets/img/cards.png", "assets/img/chips.png",
  "assets/img/felt_black.jpg", "assets/img/felt_blue.jpg", "assets/img/felt_green.jpg",
  "assets/img/felt_purple.jpg", "assets/img/felt_red.jpg", "assets/img/intro.png", "assets/img/intro_bg.jpg",
  "assets/img/ui.png",
  "assets/fonts/DejaVuSans.ttf", "assets/fonts/DejaVuSans-Bold.ttf", "assets/fonts/DejaVuSerif.ttf",
  "assets/fonts/DejaVuSerif-Bold.ttf",
];

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const canvas = $("game");
const ctx = canvas.getContext("2d");

// ------------------------------------------------------------------ canvas size
// Python sees the canvas in backing pixels. Retina screens get up to 1.5x, but
// the area is capped because every resize re-scales the artwork in Python.
const BJ = (window.BJ = {
  width: 800, height: 450, soundNames: SOUNDS, onEvent: null,
});
let cssW = 800, cssH = 450;

function measureSize() {
  cssW = Math.max(1, stage.clientWidth);
  cssH = Math.max(1, stage.clientHeight);
  let k = Math.min(window.devicePixelRatio || 1, 1.5);
  k = Math.min(k, Math.sqrt(2.6e6 / (cssW * cssH)));
  BJ.width = Math.max(1, Math.round(cssW * k));
  BJ.height = Math.max(1, Math.round(cssH * k));
}

function applySize() {
  measureSize();
  if (canvas.width !== BJ.width || canvas.height !== BJ.height) {
    canvas.width = BJ.width;
    canvas.height = BJ.height;
    paint();
    send("configure", BJ.width, BJ.height);
  }
}

// ------------------------------------------------------------------ images
const images = new Map();

BJ.setImage = (id, w, h, bytes) => {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const data = new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  cv.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
  images.set(id, cv);
};
BJ.freeImage = (id) => {
  const cv = images.get(id);
  if (cv) { cv.width = cv.height = 0; images.delete(id); }
};

// ------------------------------------------------------------------ text
const STACKS = {
  "Segoe UI": '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, "DejaVu Sans", Arial, sans-serif',
  "Georgia": 'Georgia, "Palatino Linotype", "Times New Roman", "DejaVu Serif", serif',
  "Bahnschrift": 'Bahnschrift, "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, "DejaVu Sans", sans-serif',
  "Consolas": 'Consolas, "Cascadia Mono", "SF Mono", Menlo, "DejaVu Sans Mono", "Courier New", monospace',
  "Arial": "Arial, Helvetica, sans-serif",
};
const cssFont = (fam, px, weight, slant) =>
  `${slant === "italic" ? "italic " : ""}${weight === "bold" ? "bold " : ""}${px}px ${STACKS[fam] || STACKS["Segoe UI"]}`;

const metricsCache = new Map();
function metricsFor(font) {
  let m = metricsCache.get(font);
  if (!m) {
    ctx.font = font;
    const t = ctx.measureText("Mgjy");
    const asc = t.fontBoundingBoxAscent ?? t.actualBoundingBoxAscent;
    const desc = t.fontBoundingBoxDescent ?? t.actualBoundingBoxDescent;
    m = { asc: Math.ceil(asc), desc: Math.ceil(desc) };
    metricsCache.set(font, m);
  }
  return m;
}

const widthOf = (font, s) => { ctx.font = font; return ctx.measureText(s).width; };

// Breaks text the way Tk does: at newlines, then at spaces once a line passes
// `limit`; a single word wider than the limit is split between characters.
function wrap(text, font, limit) {
  const out = [];
  for (const para of text.split("\n")) {
    if (!limit || widthOf(font, para) <= limit) { out.push(para); continue; }
    let cur = "";
    for (const word of para.split(" ")) {
      const test = cur ? cur + " " + word : word;
      if (!cur || widthOf(font, test) <= limit) { cur = test; continue; }
      out.push(cur);
      cur = word;
    }
    while (widthOf(font, cur) > limit && cur.length > 1) {
      let n = cur.length - 1;
      while (n > 1 && widthOf(font, cur.slice(0, n)) > limit) n--;
      out.push(cur.slice(0, n));
      cur = cur.slice(n);
    }
    out.push(cur);
  }
  return out;
}

const layoutCache = new Map();
function layout(text, font, limit) {
  const key = font + "|" + limit + "|" + text;
  let l = layoutCache.get(key);
  if (!l) {
    const m = metricsFor(font);
    const lines = wrap(text, font, limit).map((t) => ({ t, w: widthOf(font, t) }));
    l = { lines, w: Math.max(0, ...lines.map((x) => x.w)), lh: m.asc + m.desc, asc: m.asc };
    l.h = l.lh * lines.length;
    if (layoutCache.size > 3000) layoutCache.clear();
    layoutCache.set(key, l);
  }
  return l;
}

BJ.measureText = (text, fam, px, weight, slant) => widthOf(cssFont(fam, px, weight, slant), text);
BJ.fontMetrics = (fam, px, weight, slant) => {
  const m = metricsFor(cssFont(fam, px, weight, slant));
  return [m.asc, m.desc];
};
BJ.textSize = (text, fam, px, weight, slant, limit) => {
  const l = layout(text, cssFont(fam, px, weight, slant), limit);
  return [l.w, l.h];
};

// ------------------------------------------------------------------ painting
const AX = { center: [0.5, 0.5], n: [0.5, 0], s: [0.5, 1], e: [1, 0.5], w: [0, 0.5], nw: [0, 0], ne: [1, 0], sw: [0, 1], se: [1, 1] };
let last = { bg: "#06120a", items: [] };

function path(c, smooth) {
  ctx.beginPath();
  ctx.moveTo(c[0], c[1]);
  if (smooth && c.length > 4) {
    for (let i = 2; i < c.length - 2; i += 2) {
      ctx.quadraticCurveTo(c[i], c[i + 1], (c[i] + c[i + 2]) / 2, (c[i + 1] + c[i + 3]) / 2);
    }
    ctx.lineTo(c[c.length - 2], c[c.length - 1]);
  } else {
    for (let i = 2; i < c.length; i += 2) ctx.lineTo(c[i], c[i + 1]);
  }
}

function paint() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = last.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const it of last.items) {
    switch (it[0]) {
      case 0: {
        const cv = images.get(it[1]);
        if (!cv) break;
        const [ax, ay] = AX[it[4]] || AX.center;
        ctx.drawImage(cv, Math.round(it[2] - cv.width * ax), Math.round(it[3] - cv.height * ay));
        break;
      }
      case 1: {
        const [, text, fam, px, weight, slant, fill, anchor, justify, limit, angle, x, y] = it;
        const font = cssFont(fam, px, weight, slant);
        const l = layout(text, font, limit);
        const [ax, ay] = AX[anchor] || AX.center;
        ctx.font = font;
        ctx.fillStyle = fill;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.save();
        if (angle) { ctx.translate(x, y); ctx.rotate((-angle * Math.PI) / 180); ctx.translate(-x, -y); }
        const x0 = x - l.w * ax, y0 = y - l.h * ay;
        l.lines.forEach((ln, i) => {
          const dx = justify === "center" ? (l.w - ln.w) / 2 : justify === "right" ? l.w - ln.w : 0;
          ctx.fillText(ln.t, x0 + dx, y0 + i * l.lh + l.asc);
        });
        ctx.restore();
        break;
      }
      case 2: {
        const [, c, fill, outline, width] = it;
        const x = Math.min(c[0], c[2]), y = Math.min(c[1], c[3]);
        const w = Math.abs(c[2] - c[0]), h = Math.abs(c[3] - c[1]);
        if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
        if (outline && width > 0) { ctx.strokeStyle = outline; ctx.lineWidth = width; ctx.strokeRect(x, y, w, h); }
        break;
      }
      case 3: {
        const [, c, fill, width, smooth, dash, cap] = it;
        if (c.length < 4) break;
        path(c, smooth);
        ctx.strokeStyle = fill;
        ctx.lineWidth = width;
        ctx.lineCap = cap === "round" ? "round" : cap === "projecting" ? "square" : "butt";
        ctx.lineJoin = "round";
        ctx.setLineDash(dash || []);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 4: {
        const [, c, fill, outline, width] = it;
        if (c.length < 6) break;
        path(c, false);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (outline && width > 0) { ctx.strokeStyle = outline; ctx.lineWidth = width; ctx.stroke(); }
        break;
      }
    }
  }
}

BJ.render = (bg, json) => {
  last = { bg, items: JSON.parse(json) };
  paint();
};

// ------------------------------------------------------------------ cursor / fullscreen / quit
BJ.setCursor = (c) => { canvas.style.cursor = c; };
BJ.isFullscreen = () => document.fullscreenElement === $("app");
BJ.setFullscreen = (on) => {
  try {
    if (on && !document.fullscreenElement) $("app").requestFullscreen?.();
    else if (!on && document.fullscreenElement) document.exitFullscreen?.();
  } catch { /* the browser said no */ }
};
BJ.quit = () => { persist(); location.href = "/home"; };

// ------------------------------------------------------------------ input
const send = (kind, x = 0, y = 0, a = 0, b = 0, c = 0) => BJ.onEvent && BJ.onEvent(kind, x, y, a, b, c);
const where = (e) => {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) * BJ.width) / r.width, ((e.clientY - r.top) * BJ.height) / r.height];
};
let down = false, lastPos = [-1, -1];

canvas.addEventListener("pointermove", (e) => {
  const [x, y] = where(e);
  lastPos = [x, y];
  send(down ? "drag" : "motion", x, y);
});
canvas.addEventListener("pointerdown", (e) => {
  wakeAudio();
  const [x, y] = where(e);
  if (e.pointerType !== "mouse" || x !== lastPos[0] || y !== lastPos[1]) send("motion", x, y);
  lastPos = [x, y];
  if (e.button === 2) { send("right", x, y); return; }
  if (e.button !== 0) return;
  down = true;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* no capture */ }
  send("press", x, y);
});
const lift = (e) => {
  if (!down) return;
  down = false;
  const [x, y] = where(e);
  send("release", x, y);
  if (e.pointerType !== "mouse") send("leave");
};
canvas.addEventListener("pointerup", lift);
canvas.addEventListener("pointercancel", lift);
canvas.addEventListener("pointerleave", (e) => { if (!down && e.pointerType === "mouse") send("leave"); });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const [x, y] = where(e);
  send("wheel", x, y, e.deltaY < 0 ? 120 : -120);
}, { passive: false });

const KEYSYM = {
  " ": "space", Enter: "Return", Backspace: "BackSpace", Escape: "Escape", Tab: "Tab", Delete: "Delete",
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Home: "Home", End: "End",
  PageUp: "Prior", PageDown: "Next",
  "+": "plus", "-": "minus", "=": "equal", ",": "comma", ".": "period", "/": "slash", "?": "question",
};
const CHAR = { Enter: "\r", Backspace: "\b", Escape: "\x1b", Tab: "\t" };

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;               // leave browser shortcuts alone
  const sym = KEYSYM[e.key] || e.key;
  if (!(e.key === "F11" || KEYSYM[e.key] || /^[A-Za-z0-9]$/.test(e.key))) return;   // F5, F12 ... stay the browser's
  e.preventDefault();
  wakeAudio();
  send("key", 0, 0, sym, CHAR[e.key] ?? (e.key.length === 1 ? e.key : ""), (e.shiftKey ? 1 : 0));
});

// ------------------------------------------------------------------ sound
let actx = null;
const raw = new Map(), buffers = new Map();

for (const n of SOUNDS) {
  fetch(`${GAME}assets/sounds/${n}.wav`).then((r) => r.arrayBuffer()).then((b) => raw.set(n, b)).catch(() => {});
}

async function decodeAll() {
  for (const [n, b] of raw) {
    if (buffers.has(n)) continue;
    try { buffers.set(n, await actx.decodeAudioData(b.slice(0))); } catch { /* skip a bad file */ }
  }
}

function wakeAudio() {
  try {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      setTimeout(decodeAll, 0);
    }
    if (actx.state === "suspended") actx.resume();
  } catch { /* no audio */ }
}

BJ.playSound = (name, vol) => {
  const buf = buffers.get(name);
  if (!actx || actx.state !== "running" || !buf) return;
  const src = actx.createBufferSource();
  const gain = actx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, vol));
  src.buffer = buf;
  src.connect(gain).connect(actx.destination);
  src.start();
};

// ------------------------------------------------------------------ save file
let py = null, lastSave = null;
const SAVE_PATH = "/game/save_data.json";

function persist() {
  if (!py) return;
  try {
    const text = py.FS.readFile(SAVE_PATH, { encoding: "utf8" });
    if (text !== lastSave) { localStorage.setItem(SAVE_KEY, text); lastSave = text; }
  } catch { /* no save yet, or storage is blocked */ }
}

// ------------------------------------------------------------------ boot
const status = (text, pct) => {
  $("status").textContent = text;
  if (pct != null) $("bar").style.width = `${pct}%`;
};

function fail(err) {
  console.error(err);
  $("loading").classList.add("failed");
  status(window.WebAssembly ? "Something went wrong while loading the game. Reloading the page usually fixes it." :
    "This browser can't run WebAssembly, which the game needs.", 100);
  $("detail").textContent = String(err && err.message ? err.message : err).slice(0, 300);
}

async function boot() {
  status("Starting the Python engine ...", 4);
  const { loadPyodide } = await import(`${PYODIDE}pyodide.mjs`);
  const [pyodide] = await Promise.all([loadPyodide({ indexURL: PYODIDE })]);
  py = pyodide;
  status("Loading Pillow ...", 28);
  await pyodide.loadPackage("pillow");

  let done = 0;
  status("Unpacking the game ...", 36);
  const dirs = new Set();
  const loaded = await Promise.all(FILES.map(async (f) => {
    const r = await fetch(GAME + f);
    if (!r.ok) throw new Error(`${f}: ${r.status}`);
    const data = new Uint8Array(await r.arrayBuffer());
    status("Unpacking the game ...", 36 + (++done / FILES.length) * 50);
    return [f, data];
  }));
  for (const [f, data] of loaded) {
    const dir = "/game/" + f.split("/").slice(0, -1).join("/");
    if (!dirs.has(dir)) { pyodide.FS.mkdirTree(dir); dirs.add(dir); }
    pyodide.FS.writeFile("/game/" + f, data);
  }
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) { pyodide.FS.writeFile(SAVE_PATH, saved); lastSave = saved; }
  } catch { /* storage blocked: play without a save */ }

  status("Shuffling the deck ...", 90);
  await new Promise((r) => setTimeout(r, 30));      // let the bar paint before Python blocks the page
  applySize();
  pyodide.runPython("import sys; sys.path.insert(0, '/game/web'); import start; start.run()");
  status("", 100);
  $("loading").classList.add("done");
  setInterval(persist, 4000);
}

new ResizeObserver(applySize).observe(stage);
document.addEventListener("fullscreenchange", applySize);
document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });
addEventListener("pagehide", () => {
  try { py && py.runPython("import start; start.on_leave()"); } catch { /* leaving anyway */ }
  persist();
});
applySize();
boot().catch(fail);
