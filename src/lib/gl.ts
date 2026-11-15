/** The few WebGL chores the two ferrofluid shaders share. */

export type GL = WebGL2RenderingContext | WebGLRenderingContext;

export function getContext(canvas: HTMLCanvasElement, prefer2 = true): GL | null {
  const options: WebGLContextAttributes = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  };
  return (
    (prefer2 ? (canvas.getContext("webgl2", options) as WebGL2RenderingContext | null) : null) ??
    (canvas.getContext("webgl", options) as WebGLRenderingContext | null)
  );
}

export function isWebGL2(gl: GL): gl is WebGL2RenderingContext {
  return typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
}

function compile(gl: GL, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * A program that draws one triangle over the whole canvas, so the fragment
 * shader runs once per pixel. Returns a uniform-location lookup with it.
 */
export function fullscreenProgram(gl: GL, fragment: string) {
  const two = isWebGL2(gl);
  const vertex = two
    ? "#version 300 es\nin vec2 a_pos;\nvoid main(){gl_Position=vec4(a_pos,0.0,1.0);}"
    : "attribute vec2 a_pos;\nvoid main(){gl_Position=vec4(a_pos,0.0,1.0);}";

  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;

  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const cache = new Map<string, WebGLUniformLocation | null>();
  const uniform = (name: string) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
    return cache.get(name)!;
  };

  return { program, uniform };
}

/** The current theme's accent as 0–1 RGB, read from the CSS token. */
export function accentRGB(): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const hex = value.startsWith("#") ? value.slice(1) : "c8f55a";
  const n = parseInt(hex.length === 3 ? hex.replace(/./g, c => c + c) : hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function isLightTheme() {
  return document.documentElement.dataset.theme === "light";
}

/** Calls back whenever the site's theme flips, so shaders can re-read colours. */
export function onThemeChange(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** A critically damped-ish spring step, for values the shaders animate. */
export function spring(state: { v: number; x: number }, target: number, dt: number, stiffness: number, damping: number) {
  const force = (target - state.x) * stiffness - state.v * damping;
  state.v += force * dt;
  state.x += state.v * dt;
  return Math.abs(target - state.x) < 0.001 && Math.abs(state.v) < 0.001;
}
