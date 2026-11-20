// Boot: the loading screen, then the app. Everything is plain JavaScript; the
// game's rules live in engine.js and are shared by every screen.
import { App } from "./core.js";
import { Store } from "./store.js";
import { Sound } from "./sound.js";
import { Assets } from "./assets.js";
import { MenuScene } from "./menu.js";
import { IntroScene } from "./intro.js";
import { TableScene } from "./table.js";
import { StatsScene } from "./stats.js";
import { SettingsScene } from "./settings.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), canvas = $("game");

const store = new Store();
const sound = new Sound(store);
const assets = new Assets(store.settings.felt);
const app = new App(canvas, store, sound, assets);
window.BJ = app;                                    // handy in the console and for tests

const SCENES = { menu: MenuScene, intro: IntroScene, table: TableScene, stats: StatsScene, settings: SettingsScene };
app.goto = (name, opts = {}) => app.setScene(SCENES[name], opts);
app.quit = () => { store.save(); location.href = "/home"; };

/** Play: the walk-in (depending on settings), then the table. Waits for any artwork still on its way. */
app.startPlay = async () => {
  const s = store.settings, skip = s.intro === "never" || (s.intro === "session" && app.session.introSeen);
  const need = [`felt_${s.felt}`, "felt_green", ...(skip ? [] : ["intro", "intro_bg"])];
  if (need.some((n) => !assets.img[n])) app.toast("Setting up the table ...", "info", 2);
  await Promise.all(need.map((n) => assets.ready(n)));
  app.goto(skip ? "table" : "intro");
};

// ------------------------------------------------------------------ size
const fit = () => app.resize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight));
new ResizeObserver(fit).observe(stage);
document.addEventListener("fullscreenchange", fit);
fit();

// ------------------------------------------------------------------ loading
// The bar follows the real downloads but never runs ahead of a steady ~2.2 s
// pace, so it reads as a loading screen rather than a flash. At the halfway
// mark "Skip loading?" appears: the menu opens at once and the rest of the
// artwork keeps arriving behind it.
const MIN_SECONDS = 2.2;
let real = 0, opened = false, shown = 0;
const t0 = performance.now();
const open = () => {
  if (opened) return;
  opened = true;
  $("loading").classList.add("done");
  app.goto("menu");
};
const { all } = assets.load((p) => { real = p; });
all.then(() => { real = 1; registerWorker(); });
const tick = () => {
  if (opened) return;
  shown = Math.max(shown, Math.min(real, (performance.now() - t0) / 1000 / MIN_SECONDS));
  $("bar").style.width = `${Math.round(shown * 100)}%`;
  $("status").textContent = shown < 0.5 ? "Dealing the cards ..." : shown < 0.95 ? "Shuffling the deck ..." : "Pouring the chips ...";
  if (shown >= 0.5) $("skip").classList.add("show");
  if (shown >= 1) { setTimeout(open, 150); return; }
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
$("skip").addEventListener("click", open);
// until every image has arrived, keep repainting so late artwork shows up by itself
const ticker = setInterval(() => { app.invalidate(); if (Object.keys(assets.img).length >= 12) clearInterval(ticker); }, 250);

function registerWorker() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/blackjack-sw.js", { scope: "/blackjack" }).catch(() => {});
}

// ------------------------------------------------------------------ top bar controls
$("snd").addEventListener("click", () => { sound.unlock(); app.toggleMute(); });
$("fs").addEventListener("click", () => app.toggleFullscreen());
const syncBar = () => {
  const muted = !!store.settings.muted;
  $("sndl").textContent = muted ? "sound off" : "sound on";
  $("sndwave").style.opacity = muted ? 0 : 1;
};
syncBar();
setInterval(syncBar, 300);

// ------------------------------------------------------------------ leaving
const leave = () => { try { app.scene?.emergencyFinish?.(); } catch { /* leaving anyway */ } store.save(); };
addEventListener("pagehide", leave);
document.addEventListener("visibilitychange", () => { if (document.hidden) store.save(); });
