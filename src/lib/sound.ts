/**
 * Every sound on the site, synthesised on the spot with Web Audio — there are
 * no audio files to download.
 *
 * Browsers only let audio start inside a user gesture, so the context is
 * created on the first click (normally the dock's "let's go") and never
 * before: creating it earlier just logs a warning and stays silent. On by
 * default once that happens; the choice to mute is remembered.
 */

const KEY = "sound";
export const SOUND_EVENT = "sound:change";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Blocked storage: it still switches for this visit.
  }
  if (on) context();
  if (out && ctx) out.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
  window.dispatchEvent(new Event(SOUND_EVENT));
}

export function toggleSound() {
  const next = !soundEnabled();
  setSound(next);
  if (next) click();
  return next;
}

/** The context, created or resumed — but only once the page has had a gesture. */
function context(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!ctx) {
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return null;

    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    ctx = new Ctor();
    out = ctx.createGain();
    out.gain.value = soundEnabled() ? 1 : 0;

    // A gentle limiter so overlapping sounds never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    out.connect(limiter).connect(ctx.destination);

    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function ready() {
  if (!soundEnabled()) return null;
  const c = context();
  return c && out && noise ? { c, out, noise } : null;
}

function noiseSource(c: AudioContext, buffer: AudioBuffer) {
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = Math.random();
  return source;
}

/** Call from inside a click: the moment the browser allows sound to start. */
export function unlockSound() {
  context();
}

/** A tiny dry tick for presses. */
export function click() {
  const a = ready();
  if (!a) return;
  const { c, out } = a;
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(2100, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.03);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.09, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.06);
}

/**
 * The big one, for "let's go": air rushing inward, rising as the button falls
 * into the screen, then a sub-bass boom as it lands.
 */
export function woosh() {
  const a = ready();
  if (!a) return;
  const { c, out, noise } = a;
  const t = c.currentTime;

  const rush = noiseSource(c, noise);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(180, t);
  band.frequency.exponentialRampToValueAtTime(2600, t + 0.62);
  band.frequency.exponentialRampToValueAtTime(140, t + 1.3);

  const pan = c.createStereoPanner();
  pan.pan.setValueAtTime(-0.7, t);
  pan.pan.linearRampToValueAtTime(0.6, t + 0.7);
  pan.pan.linearRampToValueAtTime(0, t + 1.2);

  const rushGain = c.createGain();
  rushGain.gain.setValueAtTime(0.0001, t);
  rushGain.gain.exponentialRampToValueAtTime(0.9, t + 0.6);
  rushGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);

  rush.connect(band).connect(pan).connect(rushGain).connect(out);
  rush.start(t);
  rush.stop(t + 1.4);

  const boomAt = t + 0.58;
  const boom = c.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(120, boomAt);
  boom.frequency.exponentialRampToValueAtTime(34, boomAt + 0.9);

  const boomGain = c.createGain();
  boomGain.gain.setValueAtTime(0.0001, boomAt);
  boomGain.gain.exponentialRampToValueAtTime(0.85, boomAt + 0.03);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, boomAt + 1.1);

  boom.connect(boomGain).connect(out);
  boom.start(boomAt);
  boom.stop(boomAt + 1.2);
}

/** Liquid moving: a low, bubbling slosh for page changes. */
export function slosh() {
  const a = ready();
  if (!a) return;
  const { c, out, noise } = a;
  const t = c.currentTime;

  const body = noiseSource(c, noise);
  const low = c.createBiquadFilter();
  low.type = "lowpass";
  low.Q.value = 7;
  low.frequency.setValueAtTime(380, t);

  // The wobble on the filter is what makes noise sound wet.
  const wobble = c.createOscillator();
  wobble.frequency.setValueAtTime(9, t);
  wobble.frequency.linearRampToValueAtTime(4, t + 0.6);
  const depth = c.createGain();
  depth.gain.value = 260;
  wobble.connect(depth).connect(low.frequency);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

  body.connect(low).connect(gain).connect(out);
  body.start(t);
  body.stop(t + 0.75);
  wobble.start(t);
  wobble.stop(t + 0.75);

  for (let i = 0; i < 3; i++) bloop(c, out, t + 0.05 + i * 0.11 + Math.random() * 0.05, 0.12);
}

/** A single drop of liquid: a fast falling sine. */
function bloop(c: AudioContext, out: AudioNode, at: number, level: number) {
  const osc = c.createOscillator();
  osc.type = "sine";
  const start = 500 + Math.random() * 500;
  osc.frequency.setValueAtTime(start, at);
  osc.frequency.exponentialRampToValueAtTime(start * 0.35, at + 0.09);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);

  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.14);
}

/** Poking the ferrofluid: a thick, wet thunk. */
export function gloop() {
  const a = ready();
  if (!a) return;
  const { c, out } = a;
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.22);

  const low = c.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 600;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.6, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

  osc.connect(low).connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.32);

  bloop(c, out, t + 0.07, 0.1);
}
