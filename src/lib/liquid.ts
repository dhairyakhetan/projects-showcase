/**
 * A small particle liquid, after Clavet, Beaudoin & Poulin, "Particle-based
 * Viscoelastic Fluid Simulation" (2005): every step, each particle pushes and
 * pulls on its neighbours to hold a rest density ("double density
 * relaxation"). Too crowded pushes apart; too sparse pulls together — that
 * pull is the surface tension that beads a stretched strand into drops.
 *
 * Units are canvas CSS pixels and one fixed substep, so the constants below
 * read as "px per substep". 120 substeps a second.
 *
 * On top of the fluid sit the forces that make it the button's: a spring to a
 * band just outside the button's edge, a current that runs clockwise around
 * it, a little gravity, the button itself as a solid, and the cursor as a
 * magnet.
 */

export const SUBSTEPS_PER_SECOND = 120;

const H = 16; // interaction radius
const H2 = H * H;
const REST = 4.6; // rest density
const STIFF = 0.32;
const STIFF_NEAR = 0.7;
const VISCOSITY = 0.06;
const GRAVITY = 0.006;
const DAMPING = 0.992;
const MAX_SPEED = 11;

const OUTLINE_K = 0.003;
const OUTLINE_CAP = 0.05;
const CURRENT = 0.022;
const MAGNET = 0.2;
const MAGNET_FALLOFF = 85;
/** Liquid this close to the magnet is the drop on the cursor, and is always held. */
const HOLD = 26;
/** The drop stops recruiting once it holds this share of the liquid. */
const DROP_SHARE = 0.08;

export interface Box {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
}

export interface Field {
  box: Box;
  /** Where the liquid is drawn to, or null. */
  magnet: { x: number; y: number; strength: number } | null;
  /** 1 while the pointer is over the button: the current races. */
  excite: number;
  width: number;
  height: number;
}

/** Signed distance from (x, y) to the box's edge, and the outward normal there. */
function edge(box: Box, x: number, y: number) {
  const dx = x - box.cx;
  const dy = y - box.cy;
  const qx = Math.abs(dx) - box.hx;
  const qy = Math.abs(dy) - box.hy;
  let nx: number;
  let ny: number;
  let d: number;
  if (qx > 0 && qy > 0) {
    d = Math.hypot(qx, qy);
    nx = (Math.sign(dx) * qx) / d;
    ny = (Math.sign(dy) * qy) / d;
  } else if (qx > qy) {
    d = qx;
    nx = Math.sign(dx) || 1;
    ny = 0;
  } else {
    d = qy;
    nx = 0;
    ny = Math.sign(dy) || 1;
  }
  return { d, nx, ny };
}

export class Liquid {
  readonly count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private px: Float32Array;
  private py: Float32Array;
  /** How far out from the edge each particle likes to sit: a layer, not a line. */
  private band: Float32Array;

  private cellStart = new Int32Array(0);
  private cellCount = new Int32Array(0);
  private sorted = new Int32Array(0);
  private cols = 0;
  private rows = 0;

  private nbr: Int32Array;
  private nq: Float32Array;
  private nx: Float32Array;
  private ny: Float32Array;

  constructor(count: number, box: Box) {
    this.count = count;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.band = new Float32Array(count);
    this.sorted = new Int32Array(count);
    this.nbr = new Int32Array(96);
    this.nq = new Float32Array(96);
    this.nx = new Float32Array(96);
    this.ny = new Float32Array(96);

    // Start already wrapped round the edge, in a layer as thick as this much
    // liquid needs — packed any tighter, its own pressure would blow it apart.
    const perimeter = 4 * (box.hx + box.hy);
    const layer = (count * 30) / perimeter;
    for (let i = 0; i < count; i++) {
      this.band[i] = 3 + Math.random() * Math.random() * 16;
      let t = Math.random() * perimeter;
      const out = 2 + Math.random() * layer;
      if (t < 2 * box.hx) {
        this.x[i] = box.cx - box.hx + t;
        this.y[i] = box.cy - box.hy - out;
      } else if ((t -= 2 * box.hx) < 2 * box.hy) {
        this.x[i] = box.cx + box.hx + out;
        this.y[i] = box.cy - box.hy + t;
      } else if ((t -= 2 * box.hy) < 2 * box.hx) {
        this.x[i] = box.cx + box.hx - t;
        this.y[i] = box.cy + box.hy + out;
      } else {
        t -= 2 * box.hx;
        this.x[i] = box.cx - box.hx - out;
        this.y[i] = box.cy + box.hy - t;
      }
    }
  }

  /** Scatter outward from the button: a splash. */
  splash(box: Box, power = 6) {
    for (let i = 0; i < this.count; i++) {
      const { nx, ny } = edge(box, this.x[i], this.y[i]);
      const kick = power * (0.4 + Math.random() * 0.8);
      this.vx[i] += nx * kick;
      this.vy[i] += ny * kick - Math.random() * 1.5;
    }
  }

  private grid(width: number, height: number) {
    const cols = Math.max(1, Math.ceil(width / H) + 2);
    const rows = Math.max(1, Math.ceil(height / H) + 2);
    if (cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      this.cellStart = new Int32Array(cols * rows + 1);
      this.cellCount = new Int32Array(cols * rows);
    }
    const { x, y, count } = this;
    const counts = this.cellCount;
    counts.fill(0);
    for (let i = 0; i < count; i++) counts[this.cell(x[i], y[i])]++;
    let sum = 0;
    for (let c = 0; c < counts.length; c++) {
      this.cellStart[c] = sum;
      sum += counts[c];
    }
    this.cellStart[counts.length] = sum;
    counts.fill(0);
    for (let i = 0; i < count; i++) {
      const c = this.cell(x[i], y[i]);
      this.sorted[this.cellStart[c] + counts[c]++] = i;
    }
  }

  private cell(x: number, y: number) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / H) + 1));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / H) + 1));
    return cy * this.cols + cx;
  }

  step(field: Field) {
    const { x, y, vx, vy, px, py, band, count } = this;
    const { box, magnet, excite, width, height } = field;

    // The magnet holds whatever it already has, but only draws more while the
    // drop on the cursor is small — otherwise the whole pool would follow it.
    const recruit = magnet ? Math.max(0, 1 - this.gripAt(magnet.x, magnet.y, HOLD) / (count * DROP_SHARE)) : 0;

    // 1. Outside forces, as velocity.
    for (let i = 0; i < count; i++) {
      const { d, nx, ny } = edge(box, x[i], y[i]);

      let ax = 0;
      let ay = GRAVITY;

      const pull = Math.max(-OUTLINE_CAP, Math.min(OUTLINE_CAP, -OUTLINE_K * (d - band[i]) * 3));
      ax += nx * pull;
      ay += ny * pull;

      // The current only carries liquid that's on the edge, not mid-air.
      if (d < 34) {
        const flow = CURRENT * (1 + excite * 2.5) * (1 - d / 34);
        ax += -ny * flow;
        ay += nx * flow;
      }

      if (magnet) {
        const mx = magnet.x - x[i];
        const my = magnet.y - y[i];
        const r = Math.hypot(mx, my) + 0.001;
        const f = ((MAGNET * magnet.strength) / (1 + (r / MAGNET_FALLOFF) ** 2)) * (r < HOLD ? 1 : recruit);
        ax += (mx / r) * f;
        ay += (my / r) * f;
      }

      vx[i] = (vx[i] + ax) * DAMPING;
      vy[i] = (vy[i] + ay) * DAMPING;
    }

    this.grid(width, height);
    this.viscosity();

    // 2. Move.
    for (let i = 0; i < count; i++) {
      const speed = Math.hypot(vx[i], vy[i]);
      if (speed > MAX_SPEED) {
        vx[i] *= MAX_SPEED / speed;
        vy[i] *= MAX_SPEED / speed;
      }
      px[i] = x[i];
      py[i] = y[i];
      x[i] += vx[i];
      y[i] += vy[i];
    }

    // 3. Hold the rest density.
    this.grid(width, height);
    this.relax();

    // 4. Velocity is whatever the position did — taken before the walls push
    // back, so a push out of the button never turns into a launch.
    for (let i = 0; i < count; i++) {
      vx[i] = x[i] - px[i];
      vy[i] = y[i] - py[i];

      // 5. The button is solid: slide along it, don't bounce off it.
      const { d, nx, ny } = edge(box, x[i], y[i]);
      if (d < 0.5) {
        x[i] += nx * (0.5 - d);
        y[i] += ny * (0.5 - d);
        const into = vx[i] * nx + vy[i] * ny;
        if (into < 0) {
          vx[i] -= into * nx;
          vy[i] -= into * ny;
        }
      }
      if (x[i] < 2 || x[i] > width - 2) {
        x[i] = Math.min(width - 2, Math.max(2, x[i]));
        vx[i] *= -0.3;
      }
      if (y[i] < 2 || y[i] > height - 2) {
        y[i] = Math.min(height - 2, Math.max(2, y[i]));
        vy[i] *= -0.3;
      }
    }
  }

  /** Visits i's neighbours within H, filling the scratch arrays. Returns how many. */
  private neighbours(i: number) {
    const { x, y } = this;
    const xi = x[i];
    const yi = y[i];
    const ccx = Math.floor(xi / H) + 1;
    const ccy = Math.floor(yi / H) + 1;
    let n = 0;
    for (let oy = -1; oy <= 1; oy++) {
      const cy = ccy + oy;
      if (cy < 0 || cy >= this.rows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const cx = ccx + ox;
        if (cx < 0 || cx >= this.cols) continue;
        const c = cy * this.cols + cx;
        for (let s = this.cellStart[c]; s < this.cellStart[c + 1]; s++) {
          const j = this.sorted[s];
          if (j === i) continue;
          const dx = x[j] - xi;
          const dy = y[j] - yi;
          const r2 = dx * dx + dy * dy;
          if (r2 >= H2 || n >= this.nbr.length) continue;
          const r = Math.sqrt(r2) || 0.0001;
          this.nbr[n] = j;
          this.nq[n] = 1 - r / H;
          this.nx[n] = dx / r;
          this.ny[n] = dy / r;
          n++;
        }
      }
    }
    return n;
  }

  private viscosity() {
    const { vx, vy, count } = this;
    for (let i = 0; i < count; i++) {
      const n = this.neighbours(i);
      for (let k = 0; k < n; k++) {
        const j = this.nbr[k];
        if (j < i) continue;
        const ux = this.nx[k];
        const uy = this.ny[k];
        // Closing speed along the line between them.
        const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
        if (u <= 0) continue;
        const impulse = this.nq[k] * VISCOSITY * u * 0.5;
        vx[i] -= ux * impulse;
        vy[i] -= uy * impulse;
        vx[j] += ux * impulse;
        vy[j] += uy * impulse;
      }
    }
  }

  private relax() {
    const { x, y, count } = this;
    for (let i = 0; i < count; i++) {
      const n = this.neighbours(i);
      let density = 0;
      let near = 0;
      for (let k = 0; k < n; k++) {
        const q = this.nq[k];
        density += q * q;
        near += q * q * q;
      }
      const pressure = STIFF * (density - REST);
      const pressureNear = STIFF_NEAR * near;

      let dxi = 0;
      let dyi = 0;
      for (let k = 0; k < n; k++) {
        const q = this.nq[k];
        const push = (pressure * q + pressureNear * q * q) * 0.5;
        const ox = this.nx[k] * push;
        const oy = this.ny[k] * push;
        const j = this.nbr[k];
        x[j] += ox;
        y[j] += oy;
        dxi -= ox;
        dyi -= oy;
      }
      x[i] += dxi;
      y[i] += dyi;
    }
  }

  /** How many particles sit within r of (x, y) — how hard the liquid has hold there. */
  gripAt(gx: number, gy: number, r: number) {
    let n = 0;
    const r2 = r * r;
    for (let i = 0; i < this.count; i++) {
      const dx = this.x[i] - gx;
      const dy = this.y[i] - gy;
      if (dx * dx + dy * dy < r2) n++;
    }
    return n;
  }
}
