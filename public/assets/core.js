// h-means / e-means / Lloyd in 2-D, counted in distance computations. Generators and the Lloyd and e-means
// trainers are adapted from the e-means playground (Meta Platforms, MIT license); h-means by this project.

"use strict";
// ---------------------------------------------------------------- RNG and generators (adapted, MIT, Meta Platforms)
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gaussian(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function shuffledIndices(rng, n) { const a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = i; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function multinomialSizes(rng, n, k) { const s = new Array(k).fill(0); for (let i = 0; i < n; i++) s[Math.floor(rng() * k)]++; return s; }
function weightedMultinomialSizes(rng, n, w) { const k = w.length, ws = w.reduce((a, b) => a + b, 0), cum = new Array(k); let acc = 0; for (let i = 0; i < k; i++) { acc += w[i] / ws; cum[i] = acc; } const s = new Array(k).fill(0); for (let i = 0; i < n; i++) { const r = rng(); let lo = 0, hi = k - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } s[lo]++; } return s; }
function splitCounts(n, w) { const s = w.reduce((a, b) => a + b, 0); const c = w.map(x => Math.floor(n * x / s)); c[0] += n - c.reduce((a, b) => a + b, 0); return c; }
function rejection(n, rng, draw, keep) { const rows = []; while (rows.length < n) { const p = draw(); if (keep(p)) rows.push(p); } return rows; }
const GEN = {
  vo_toy(n, k, seed) { const rng = mulberry32(seed), c = splitCounts(n, [7000, 1000, 500, 500]), rows = [];
    const blob = (m, cx, cy) => { for (let i = 0; i < m; i++) rows.push([cx + gaussian(rng) / 2, cy + gaussian(rng) / 2]); };
    blob(c[0], -1, -1); blob(c[1], 1, -1); blob(c[2], 0, 1); for (let i = 0; i < c[3]; i++) rows.push([(rng() - 0.5) * 6, (rng() - 0.5) * 6]); return rows; },
  syn_gmm_zipf(n, k, seed) { const rng = mulberry32(seed), sw = Math.sqrt(1 / 3), smu = Math.sqrt(2 / 3);
    const means = Array.from({ length: k }, () => [gaussian(rng) * smu, gaussian(rng) * smu]);
    const sizes = weightedMultinomialSizes(rng, n, Array.from({ length: k }, (_, g) => 1 / (g + 1))); const rows = [];
    for (let g = 0; g < k; g++) for (let s = 0; s < sizes[g]; s++) rows.push([means[g][0] + gaussian(rng) * sw, means[g][1] + gaussian(rng) * sw]); return rows; },
  gaussian_blobs(n, k, seed) { const rng = mulberry32(seed), kk = Math.max(2, Math.round(k / 20)); const centers = Array.from({ length: kk }, () => [rng() * 20 - 10, rng() * 20 - 10]); const sizes = multinomialSizes(rng, n, kk), rows = [];
    for (let i = 0; i < kk; i++) for (let s = 0; s < sizes[i]; s++) rows.push([centers[i][0] + gaussian(rng), centers[i][1] + gaussian(rng)]); return rows; },
  anisotropic_blobs(n, k, seed) { const rng = mulberry32(seed), kk = Math.max(2, Math.round(k / 20)); const centers = Array.from({ length: kk }, () => [rng() * 20 - 10, rng() * 20 - 10]); const sizes = multinomialSizes(rng, n, kk), rows = [];
    for (let i = 0; i < kk; i++) { const sx = rng() * 2.8 + 0.2, sy = rng() * 2.8 + 0.2; for (let s = 0; s < sizes[i]; s++) rows.push([centers[i][0] + gaussian(rng) * sx, centers[i][1] + gaussian(rng) * sy]); } return rows; },
  moons_tiled(n, k, seed) { const rng = mulberry32(seed), pairs = Math.max(1, Math.floor(k / 40)), per = Math.floor(n / pairs), rows = [];
    for (let p = 0; p < pairs; p++) { const cx = rng() * 30 - 15, cy = rng() * 30 - 15, half = Math.floor(per / 2);
      for (let i = 0; i < per; i++) { const t = rng() * Math.PI; let x, y; if (i < half) { x = Math.cos(t); y = Math.sin(t); } else { x = 1 - Math.cos(t); y = 1 - Math.sin(t) - 0.5; }
        rows.push([x * 6 + cx + gaussian(rng) * 0.48, y * 6 + cy + gaussian(rng) * 0.48]); } } return rows; },
  rings(n, k, seed) { const rng = mulberry32(seed), nr = 5, per = Math.floor(n / nr), rows = []; for (let i = 0; i < nr; i++) { const r = 2 + i * 3; for (let s = 0; s < per; s++) { const t = rng() * 2 * Math.PI; rows.push([r * Math.cos(t) + gaussian(rng) * 0.3, r * Math.sin(t) + gaussian(rng) * 0.3]); } } return rows; },
  spirals(n, k, seed) { const rng = mulberry32(seed), rows = new Array(n); for (let i = 0; i < n; i++) { const t = Math.sqrt(rng()) * 3 * Math.PI, a = t + Math.floor(rng() * 3) * 2 * Math.PI / 3, r = t / (3 * Math.PI); rows[i] = [r * Math.cos(a) + gaussian(rng) * 0.05, r * Math.sin(a) + gaussian(rng) * 0.05]; } return rows; },
  galaxy(n, k, seed) { const rng = mulberry32(seed), c = splitCounts(n, [3, 7]), rows = []; for (let i = 0; i < c[0]; i++) rows.push([gaussian(rng) * 0.15, gaussian(rng) * 0.15]);
    for (let i = 0; i < c[1]; i++) { const t = rng() * 2.5 * Math.PI, r = 0.15 * Math.exp(0.25 * t), a = t + Math.floor(rng() * 2) * Math.PI, s = 0.03 + 0.04 * r; rows.push([r * Math.cos(a) + gaussian(rng) * s, r * Math.sin(a) + gaussian(rng) * s]); } return rows; },
  flower(n, k, seed) { const rng = mulberry32(seed); return rejection(n, rng, () => [rng() * 2 - 1, rng() * 2 - 1], ([x, y]) => Math.hypot(x, y) <= Math.abs(Math.cos(5 * Math.atan2(y, x) / 2))); },
  checkerboard(n, k, seed) { const rng = mulberry32(seed); return rejection(n, rng, () => [rng() * 8, rng() * 8], ([x, y]) => (Math.floor(x) + Math.floor(y)) % 2 === 0); },
  heart(n, k, seed) { const rng = mulberry32(seed); return rejection(n, rng, () => [rng() * 3 - 1.5, rng() * 3 - 1.3], ([x, y]) => Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0); },
  star(n, k, seed) { const rng = mulberry32(seed), v = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 === 0 ? 1 : 0.4; v.push([r * Math.cos(a), r * Math.sin(a)]); }
    const rows = new Array(n); for (let i = 0; i < n; i++) { const e = Math.floor(rng() * 10), t = rng(), a = v[e], b = v[(e + 1) % 10]; rows[i] = [a[0] * (1 - t) + b[0] * t + gaussian(rng) * 0.015, a[1] * (1 - t) + b[1] * t + gaussian(rng) * 0.015]; } return rows; },
  syn_unif_cube(n, k, seed) { const rng = mulberry32(seed), h = Math.sqrt(3), rows = new Array(n); for (let i = 0; i < n; i++) rows[i] = [(rng() * 2 - 1) * h, (rng() * 2 - 1) * h]; return rows; },
  // toys for the local-minima simulations on the front page, after the e-means site: well separated Gaussians of unequal
  // size with more centroids than blobs, the configurations where nearest-centroid assignment has local minima
  blobs_grid(n, k, seed) { const rng = mulberry32(seed), rows = []; const c = [], w = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { c.push([a * 4, b * 4]); w.push(Math.abs(a) + Math.abs(b) === 2 ? 2 : 1); } const sz = splitCounts(n, w);
    c.forEach((m, j) => { for (let i = 0; i < sz[j]; i++) rows.push([m[0] + gaussian(rng) * 0.45, m[1] + gaussian(rng) * 0.45]); }); return rows; },
  blobs_square(n, k, seed) { const rng = mulberry32(seed), rows = []; const c = [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]], sz = splitCounts(n, [1, 1, 1, 1, 2]); c.forEach((m, j) => { for (let i = 0; i < sz[j]; i++) rows.push([m[0] + gaussian(rng) * 0.5, m[1] + gaussian(rng) * 0.5]); }); return rows; },
  two_blobs(n, k, seed) { const rng = mulberry32(seed), rows = []; const sz = splitCounts(n, [9, 1]); for (let i = 0; i < sz[0]; i++) rows.push([-3 + gaussian(rng) * 1.2, gaussian(rng) * 1.2]); for (let i = 0; i < sz[1]; i++) rows.push([4 + gaussian(rng) * 0.4, gaussian(rng) * 0.4]); return rows; },
};

// ---------------------------------------------------------------- core (d = 2), distance computations counted
const INIT_USAGE = Math.pow(2, -16), EMA_EPS = 1e-5, SPLIT_EPS = 1e-4, ALPHA_MIN_FRAC = 0.1;
function flatten(rows) { const n = rows.length, f = new Float64Array(2 * n); for (let i = 0; i < n; i++) { f[2 * i] = rows[i][0]; f[2 * i + 1] = rows[i][1]; } return f; }
let lastD2 = 0;
function nearest(X, i, C, K) { const x0 = X[2 * i], x1 = X[2 * i + 1]; let best = 0, bd = Infinity; for (let j = 0, o = 0; j < K; j++, o += 2) { const a = x0 - C[o], b = x1 - C[o + 1], s = a * a + b * b; if (s < bd) { bd = s; best = j; } } lastD2 = bd; return best; }
function meanLoss(X, n, C, K) { let t = 0; for (let i = 0; i < n; i++) { nearest(X, i, C, K); t += lastD2; } return t / n; }
function valleyBatch(K, T, n) { const b = 0.00439175 * Math.pow(K, 0.134749) * Math.pow(n, 0.876473) * Math.pow(T, 0.813344); const lo = Math.pow(2, Math.floor(Math.log2(Math.max(1, b)))), hi = lo * 2; const b2 = (b / lo) < (hi / b) ? lo : hi; return Math.max(1, Math.min(b2, Math.floor(n / 2))); }
function peakStep(B, K, T, n) { const a0 = 0.8244 * Math.pow(K, -0.4617) * Math.pow(B, 0.9003) * Math.pow(n, -0.4498) * Math.pow(T, -0.1057); return Math.min(Math.max(a0, 1e-4), 1); }
function cosineAlpha(a0, frac) { return a0 * (ALPHA_MIN_FRAC + (1 - ALPHA_MIN_FRAC) * 0.5 * (1 + Math.cos(Math.PI * Math.min(1, frac)))); }
function randomRows(X, n, K, rng) { const idx = shuffledIndices(rng, n), C = new Float64Array(2 * K); for (let j = 0; j < K; j++) { C[2 * j] = X[2 * idx[j]]; C[2 * j + 1] = X[2 * idx[j] + 1]; } return C; }

// EMA codebook: c_j = S_j / N_j kept as (C, N); blend applies the mass-weighted update (as in the e-means code).
class Codebook {
  constructor(C, K) { this.C = C; this.K = K; this.N = new Float64Array(K).fill(INIT_USAGE); this.cnt = new Float64Array(K); this.sum = new Float64Array(2 * K); this.sse = new Float64Array(K); }
  clear() { this.cnt.fill(0); this.sum.fill(0); }
  add(X, i, j, d2) { this.cnt[j]++; this.sum[2 * j] += X[2 * i]; this.sum[2 * j + 1] += X[2 * i + 1]; this.sse[j] += d2; }
  blend(alpha) { const { K, C, N, cnt, sum } = this, decay = 1 - alpha; for (let j = 0; j < K; j++) { const Nj = N[j] * decay; if (cnt[j] === 0) { N[j] = Nj; continue; } const Nn = Nj + alpha * cnt[j], inv = 1 / Math.max(Nn, EMA_EPS); C[2 * j] = (C[2 * j] * Nj + alpha * sum[2 * j]) * inv; C[2 * j + 1] = (C[2 * j + 1] * Nj + alpha * sum[2 * j + 1]) * inv; N[j] = Nn; } }
  setMeans() { const { K, C, cnt, sum } = this; for (let j = 0; j < K; j++) if (cnt[j] > 0) { C[2 * j] = sum[2 * j] / cnt[j]; C[2 * j + 1] = sum[2 * j + 1] / cnt[j]; } }
  splitEmpty(rng) { // Lloyd's empty-cluster rule: split mass-sampled donors
    const { K, C, cnt } = this; const dead = [], keys = []; for (let j = 0; j < K; j++) { if (cnt[j] === 0) dead.push(j); else keys.push([Math.log(cnt[j]) - Math.log(-Math.log(Math.max(rng(), 1e-300))), j]); }
    const take = Math.min(dead.length, keys.length); if (!take) return 0; keys.sort((p, q) => q[0] - p[0]);
    for (let m = 0; m < take; m++) { const s = keys[m][1], t = dead[m]; const v0 = C[2 * s], v1 = C[2 * s + 1]; C[2 * s] = v0 * (1 - SPLIT_EPS); C[2 * s + 1] = v1 * (1 + SPLIT_EPS); C[2 * t] = v0 * (1 + SPLIT_EPS); C[2 * t + 1] = v1 * (1 - SPLIT_EPS); } return take; }
}

// Each trainer exposes step(): processes one unit of work and returns the distance computations spent.
class LloydTrainer {
  constructor(X, n, K, iters, seed) { this.X = X; this.n = n; this.K = K; this.iters = iters; this.rng = mulberry32(seed); this.cb = new Codebook(randomRows(X, n, K, this.rng), K); this.C = this.cb.C; this.it = 0; this.pos = 0; this.chunk = 4096; this.done = false; this.cb.clear(); this.passes = 0; }
  step() { if (this.done) return 0; const { X, K, cb } = this, end = Math.min(this.n, this.pos + this.chunk); for (let i = this.pos; i < end; i++) { const j = nearest(X, i, cb.C, K); cb.add(X, i, j, lastD2); } const ops = (end - this.pos) * K; this.pos = end; this.passes += (end - (end - ops / K)) / this.n;
    if (this.pos >= this.n) { cb.setMeans(); cb.splitEmpty(this.rng); cb.clear(); this.pos = 0; this.it++; if (this.it >= this.iters) this.done = true; } return ops; }
  get progress() { return this.it + this.pos / this.n; }
  get label() { return `iteration ${Math.min(this.it, this.iters)} / ${this.iters}`; }
}

// e-means. opts: { hartigan: false, revive: false }. hartigan = Hartigan's rule with the EMA mass as the size estimate
// (the h-means EMA passes). revive = dead-cluster revival as in faiss contrib/e_means: every 5 updates, clusters whose
// mass is below a tenth of the mean are re-seeded by splitting a donor sampled in proportion to mass. faiss switches
// revival off for d <= 2, so it is off here unless a simulation turns it on.
const CHECK_UNUSED_EVERY = 5, UNUSED_THRESHOLD = 0.1;
function autoEmaFrac(n, K) { const nk = n / K; return nk < 24 ? 0.4 : nk < 64 ? 0.8 : 1.0; }
class EmeansTrainer {
  constructor(X, n, K, T, seed, opts) {
    if (typeof opts === "boolean") opts = { hartigan: opts }; opts = opts || {};
    this.X = X; this.n = n; this.K = K; this.T = T; this.rng = mulberry32(seed); this.hartigan = !!opts.hartigan; this.revive = !!opts.revive; this.revived = 0;
    this.cb = new Codebook(randomRows(X, n, K, this.rng), K); this.C = this.cb.C;
    this.B = valleyBatch(K, T, n); this.a0 = peakStep(this.B, K, T, n);
    this.stepsPerEpoch = Math.ceil(n / this.B); this.totalSteps = T * this.stepsPerEpoch; this.step_ = 0; this.epoch = 0; this.inEpoch = 0; this.perm = null; this.done = false;
    this.capCnt = new Float64Array(K); this.capSum = new Float64Array(2 * K); this.labels = new Int32Array(n).fill(-1); this.passes = 0;
  }
  init(C, N) { if (C) this.C.set(C); if (N) this.cb.N.set(N); }
  get dead() { const { K, cb } = this; let mean = 0; for (let j = 0; j < K; j++) mean += cb.N[j]; mean /= K; let d = 0; for (let j = 0; j < K; j++) if (cb.N[j] < UNUSED_THRESHOLD * mean) d++; return d; }
  reviveDead() { const { K, cb } = this; let mean = 0; for (let j = 0; j < K; j++) mean += cb.N[j]; mean /= K; const thr = UNUSED_THRESHOLD * mean; const dead = []; let tot = 0;
    for (let j = 0; j < K; j++) { if (cb.N[j] < thr) dead.push(j); else tot += cb.N[j]; } if (!dead.length || tot <= 0) return;
    for (const e of dead) { let r = this.rng() * tot, d = -1; for (let j = 0; j < K; j++) { if (cb.N[j] >= thr) { r -= cb.N[j]; if (r <= 0) { d = j; break; } } } if (d < 0) continue;
      const v0 = cb.C[2 * d], v1 = cb.C[2 * d + 1]; cb.C[2 * d] = v0 * (1 - SPLIT_EPS); cb.C[2 * d + 1] = v1 * (1 + SPLIT_EPS); cb.C[2 * e] = v0 * (1 + SPLIT_EPS); cb.C[2 * e + 1] = v1 * (1 - SPLIT_EPS);
      const half = cb.N[d] / 2; tot -= cb.N[d]; cb.N[d] = half; cb.N[e] = half; if (half >= thr) tot += half; this.revived++; } }
  assign(i, prev) { // Hartigan-corrected assignment using the EMA mass as the cluster size estimate (h-means), or plain nearest (e-means)
    const { X, K, cb } = this; if (!this.hartigan || prev < 0) return nearest(X, i, cb.C, K);
    const scale = this.n / this.B, x0 = X[2 * i], x1 = X[2 * i + 1]; let best = -1, bc = Infinity, bd = 0;
    for (let j = 0, o = 0; j < K; j++, o += 2) { const a = x0 - cb.C[o], b = x1 - cb.C[o + 1], s = a * a + b * b, Nj = cb.N[j] * scale; let c;
      if (j === prev) c = Nj > 1 ? s * Nj / (Nj - 1) : 0; else c = Nj > 1e-6 ? s * Nj / (Nj + 1) : Infinity;
      if (c < bc) { bc = c; best = j; bd = s; } }
    lastD2 = bd; return best; }
  step() { if (this.done) return 0; const { n, K, cb } = this;
    if (this.perm === null) this.perm = shuffledIndices(this.rng, n);
    const off = this.inEpoch * this.B, len = Math.min(this.B, n - off), last = this.epoch === this.T - 1; cb.clear();
    for (let q = 0; q < len; q++) { const i = this.perm[off + q]; const j = this.assign(i, this.labels[i]); cb.add(this.X, i, j, lastD2); this.labels[i] = j; }
    if (last) for (let j = 0; j < K; j++) { this.capCnt[j] += cb.cnt[j]; this.capSum[2 * j] += cb.sum[2 * j]; this.capSum[2 * j + 1] += cb.sum[2 * j + 1]; }
    cb.blend(cosineAlpha(this.a0, this.step_ / this.totalSteps)); cb.sse.fill(0);
    this.step_++; this.inEpoch++; this.passes += len / n;
    if (this.revive && this.step_ % CHECK_UNUSED_EVERY === 0) this.reviveDead();
    if (this.inEpoch >= this.stepsPerEpoch) { this.inEpoch = 0; this.epoch++; this.perm = null;
      if (this.epoch >= this.T) { for (let j = 0; j < K; j++) if (this.capCnt[j] > 0) { cb.C[2 * j] = this.capSum[2 * j] / this.capCnt[j]; cb.C[2 * j + 1] = this.capSum[2 * j + 1] / this.capCnt[j]; } this.done = true; } }
    return len * K; }
  get progress() { return Math.min(this.T, this.epoch + this.inEpoch / this.stepsPerEpoch); }
  get label() { return `pass ${Math.min(this.T, Math.floor(this.progress) + (this.done ? 0 : 1))} / ${this.T}`; }
}

// h-means: warm start (coarse e-means, loss-proportional split, local Lloyd) -> Hartigan-corrected EMA passes -> exact Hartigan passes.
// opts (defaults are the h-means recipe): emaFrac "auto" | number (fraction of the passes in EMA mode; "auto" is 0.4 below
// 24 points per cluster, 0.8 below 64, 1.0 above), hartiganEma true, tailRule "hartigan" | "lloyd", warmStart true,
// allocation "sse" | "uniform", revive false. Switching everything off (warmStart false, hartiganEma false, emaFrac 1) is e-means.
class HmeansTrainer {
  constructor(X, n, K, T, seed, opts) {
    opts = opts || {}; this.opts = opts;
    this.X = X; this.n = n; this.K = K; this.T = T; this.seed = seed; this.rng = mulberry32(seed + 11);
    const f = opts.emaFrac === undefined || opts.emaFrac === "auto" ? autoEmaFrac(n, K) : +opts.emaFrac;
    this.emaFrac = f; this.Tema = f >= 1 ? T : Math.max(1, Math.round(f * T)); this.Ttail = T - this.Tema;
    this.hartiganEma = opts.hartiganEma === undefined ? true : !!opts.hartiganEma; this.tailRule = opts.tailRule || "hartigan"; this.warmStart = opts.warmStart === undefined ? true : !!opts.warmStart; this.allocation = opts.allocation || "sse";
    this.kc = Math.max(1, Math.floor(K / 16)); this.done = false; this.passes = 0; this.ops = 0; this.tailPass = 0; this.tailPos = 0; this.tailB = 0;
    if (this.warmStart) {
      this.phase = "coarse"; this.coarse = new EmeansTrainer(X, n, this.kc, 0.5, seed + 7, false); this.coarse.T = 0.5; this.coarse.totalSteps = Math.ceil(0.5 * this.coarse.stepsPerEpoch);
      this.coarseSteps = this.coarse.totalSteps; this.coarseDone = 0; this.C = new Float64Array(2 * K);
    } else { this.phase = "ema"; this.ema = new EmeansTrainer(X, n, K, this.Tema, seed, { hartigan: this.hartiganEma, revive: !!opts.revive }); this.C = this.ema.C; }
  }
  get progress() { if (this.phase === "coarse" || this.phase === "split") return 0; if (this.phase === "ema") return this.ema.progress; return this.Tema + this.tailPass + this.tailPos / this.n; }
  get label() { return this.phase === "coarse" || this.phase === "split" ? "warm start" : this.phase === "ema" ? `EMA pass ${Math.min(this.Tema, Math.floor(this.ema.progress) + 1)} / ${this.Tema}` : `${this.tailRule === "lloyd" ? "exact Lloyd" : "Hartigan"} pass ${Math.min(this.Ttail, this.tailPass + 1)} / ${this.Ttail}`; }
  step() { if (this.done) return 0;
    if (this.phase === "coarse") { const ops = this.coarse.step(); this.coarseDone++; this.C.set(this.coarse.C.subarray(0, 2 * Math.min(this.K, this.kc))); if (this.coarseDone >= this.coarseSteps) this.phase = "split"; return ops; }
    if (this.phase === "split") { const ops = this.split(); this.phase = "ema"; return ops; }
    if (this.phase === "ema") { const ops = this.ema.step(); if (this.ema.done) { if (this.Ttail > 0) { this.startTail(); this.phase = "tail"; } else this.done = true; } return ops; }
    return this.tailStep(); }
  split() { const { X, n, K, kc } = this, Cc = this.coarse.C; let ops = n * kc;
    const lab = new Int32Array(n), d2 = new Float64Array(n), cnt = new Float64Array(kc), sse = new Float64Array(kc);
    for (let i = 0; i < n; i++) { const j = nearest(X, i, Cc, kc); lab[i] = j; d2[i] = lastD2; cnt[j]++; sse[j] += lastD2; }
    // children per coarse cluster, proportional to SSE (largest remainder) or uniform, >= 1 if non-empty, <= points
    const weight = this.allocation === "uniform" ? sse.map((_, j) => (cnt[j] > 0 ? 1 : 0)) : sse;
    const alloc = new Int32Array(kc); let remaining = K; for (let j = 0; j < kc; j++) if (cnt[j] > 0) { alloc[j] = 1; remaining--; }
    for (let round = 0; round < 8 && remaining > 0; round++) { let ws = 0; for (let j = 0; j < kc; j++) if (alloc[j] < cnt[j]) ws += weight[j]; if (ws <= 0) break;
      const frac = []; let given = 0; for (let j = 0; j < kc; j++) { if (alloc[j] >= cnt[j]) continue; const q = weight[j] / ws * remaining, g = Math.min(Math.floor(q), cnt[j] - alloc[j]); alloc[j] += g; given += g; frac.push([q - Math.floor(q), j]); }
      remaining -= given; if (remaining <= 0) break; frac.sort((a, b) => b[0] - a[0]); for (const [, j] of frac) { if (remaining <= 0) break; if (alloc[j] < cnt[j]) { alloc[j]++; remaining--; } } }
    // children: random members of each coarse cluster
    const order = shuffledIndices(this.rng, n), start = new Int32Array(kc + 1); for (let j = 0; j < kc; j++) start[j + 1] = start[j] + alloc[j];
    const childStart = start, filled = new Int32Array(kc), C = this.C; C.fill(0); const childOf = new Int32Array(n).fill(-1);
    for (let q = 0; q < n; q++) { const i = order[q], j = lab[i]; if (filled[j] < alloc[j]) { const c = childStart[j] + filled[j]; C[2 * c] = X[2 * i]; C[2 * c + 1] = X[2 * i + 1]; filled[j]++; } }
    for (let c = childStart[kc]; c < K; c++) { C[2 * c] = Cc[0] + SPLIT_EPS * c; C[2 * c + 1] = Cc[1]; } // never allocated (only when kc clusters are empty)
    const counts = new Float64Array(K), sums = new Float64Array(2 * K);
    for (let it = 0; it < 2; it++) { counts.fill(0); sums.fill(0);
      for (let i = 0; i < n; i++) { const j = lab[i], a = childStart[j], b = childStart[j + 1]; let best = a, bd = Infinity; const x0 = X[2 * i], x1 = X[2 * i + 1];
        for (let c = a; c < b; c++) { const u = x0 - C[2 * c], v = x1 - C[2 * c + 1], s = u * u + v * v; if (s < bd) { bd = s; best = c; } } childOf[i] = best; counts[best]++; sums[2 * best] += x0; sums[2 * best + 1] += x1; }
      for (let c = 0; c < K; c++) if (counts[c] > 0) { C[2 * c] = sums[2 * c] / counts[c]; C[2 * c + 1] = sums[2 * c + 1] / counts[c]; } ops += n * Math.max(1, K / kc); }
    this.ema = new EmeansTrainer(X, n, K, this.Tema, this.seed, { hartigan: this.hartiganEma, revive: !!this.opts.revive }); this.ema.C.set(C); this.C = this.ema.C;
    const N = new Float64Array(K); for (let c = 0; c < K; c++) N[c] = Math.max(INIT_USAGE, counts[c] * this.ema.B / n); this.ema.cb.N.set(N); // init mass ~ points per batch
    return ops; }
  startTail() { const { n, K, X } = this, e = this.ema; this.S = new Float64Array(2 * K); this.Ncnt = new Float64Array(K); this.labels = e.labels; this.C = e.C;
    for (let i = 0; i < n; i++) { let j = this.labels[i]; if (j < 0) { j = nearest(X, i, this.C, K); this.labels[i] = j; } this.Ncnt[j]++; this.S[2 * j] += X[2 * i]; this.S[2 * j + 1] += X[2 * i + 1]; }
    for (let j = 0; j < K; j++) if (this.Ncnt[j] > 0) { this.C[2 * j] = this.S[2 * j] / this.Ncnt[j]; this.C[2 * j + 1] = this.S[2 * j + 1] / this.Ncnt[j]; }
    this.tailB = e.B; this.tailPos = 0; this.tailPass = 0; this.tperm = shuffledIndices(this.rng, n); this.tailSteps = 0; }
  tailStep() { const { X, n, K, C, S, Ncnt, labels } = this; const end = Math.min(n, this.tailPos + this.tailB); const touched = new Set(); const lloyd = this.tailRule === "lloyd";
    for (let q = this.tailPos; q < end; q++) { const i = this.tperm[q], o = labels[i], x0 = X[2 * i], x1 = X[2 * i + 1]; let best = o, bc = Infinity;
      for (let j = 0, p = 0; j < K; j++, p += 2) { const Nj = Ncnt[j]; if (Nj <= 0 && j !== o) continue; const a = x0 - C[p], b = x1 - C[p + 1], s = a * a + b * b; const c = lloyd ? s : j === o ? (Nj > 1 ? s * Nj / (Nj - 1) : 0) : s * Nj / (Nj + 1); if (c < bc) { bc = c; best = j; } }
      if (best !== o) { S[2 * o] -= x0; S[2 * o + 1] -= x1; Ncnt[o]--; S[2 * best] += x0; S[2 * best + 1] += x1; Ncnt[best]++; labels[i] = best; touched.add(o); touched.add(best); } }
    for (const j of touched) if (Ncnt[j] > 0) { C[2 * j] = S[2 * j] / Ncnt[j]; C[2 * j + 1] = S[2 * j + 1] / Ncnt[j]; }
    this.tailSteps++;
    if (this.tailSteps % 5 === 0) this.tailRevive();
    const ops = (end - this.tailPos) * K; this.tailPos = end;
    if (this.tailPos >= n) { this.tailPos = 0; this.tailPass++; this.tperm = shuffledIndices(this.rng, n); if (this.tailPass >= this.Ttail) this.done = true; }
    return ops; }
  tailRevive() { const { X, n, K, C, S, Ncnt, labels } = this; const empty = []; for (let j = 0; j < K; j++) if (Ncnt[j] <= 0) empty.push(j); if (!empty.length) return;
    let tot = 0; for (let j = 0; j < K; j++) if (Ncnt[j] > 1) tot += Ncnt[j];
    for (const e of empty) { let r = this.rng() * tot, d = -1; for (let j = 0; j < K; j++) { if (Ncnt[j] > 1) { r -= Ncnt[j]; if (r <= 0) { d = j; break; } } } if (d < 0) return;
      let far = -1, fd = -1; for (let i = 0; i < n; i++) if (labels[i] === d) { const a = X[2 * i] - C[2 * d], b = X[2 * i + 1] - C[2 * d + 1], s = a * a + b * b; if (s > fd) { fd = s; far = i; } }
      if (far < 0) continue; const x0 = X[2 * far], x1 = X[2 * far + 1]; S[2 * d] -= x0; S[2 * d + 1] -= x1; Ncnt[d]--; tot -= 1; S[2 * e] = x0; S[2 * e + 1] = x1; Ncnt[e] = 1; labels[far] = e; C[2 * e] = x0; C[2 * e + 1] = x1; C[2 * d] = S[2 * d] / Ncnt[d]; C[2 * d + 1] = S[2 * d + 1] / Ncnt[d]; } }
}

// ---------------------------------------------------------------- shared helpers (DOM-free except css())
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmtInt = v => v.toLocaleString("en-US");
function fitCanvas(cv) { const r = cv.getBoundingClientRect(), s = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(200, Math.round(r.width * s)), h = Math.round(w * (cv.id === "cvC" ? (r.width < 500 ? 1 / 1.4 : 1 / 2.6) : 1)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return s; }
function bounds(X, n) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (let i = 0; i < n; i++) { const x = X[2 * i], y = X[2 * i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.max(x1 - x0, y1 - y0) / 2 * 1.04; return { cx, cy, half }; }
function pointsLayer(X, n, w, h, b, color) { const off = document.createElement("canvas"); off.width = w; off.height = h; const g = off.getContext("2d"); g.fillStyle = color; g.globalAlpha = n > 60000 ? 0.35 : 0.55; const s = w / (2 * b.half), step = Math.max(1, Math.floor(n / 60000));
  for (let i = 0; i < n; i += step) { const px = (X[2 * i] - b.cx) * s + w / 2, py = h / 2 - (X[2 * i + 1] - b.cy) * s; g.fillRect(px, py, 1.2, 1.2); } return off; }
function drawPanel(cv, layer, C, K, b, color) { const g = cv.getContext("2d"), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h); g.drawImage(layer, 0, 0); const s = w / (2 * b.half), r = K > 3000 ? 1.4 : K > 1000 ? 2 : 3; g.fillStyle = color;
  for (let j = 0; j < K; j++) { const px = (C[2 * j] - b.cx) * s + w / 2, py = h / 2 - (C[2 * j + 1] - b.cy) * s; g.beginPath(); g.arc(px, py, r, 0, 6.2832); g.fill(); } }

function drawChart(cv, series, xMax) { const g = cv.getContext("2d"), w = cv.width, h = cv.height, s = Math.min(2, window.devicePixelRatio || 1); g.clearRect(0, 0, w, h);
  const L = 62 * s, R = 14 * s, Tp = 12 * s, Bt = 34 * s; let lo = Infinity, hi = -Infinity;
  for (const se of series) for (const p of se.pts) { if (p.y < lo) lo = p.y; if (p.y > hi) hi = p.y; } if (!isFinite(lo)) return;
  // zoom to the interesting range: from the best value to a bit above the median of all finals
  const finals = series.filter(se => se.pts.length).map(se => se.pts[se.pts.length - 1].y).sort((a, b) => a - b); const top = Math.min(hi, Math.max(finals[finals.length - 1] * 1.08, lo * 1.3)); hi = top; const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const xs = x => L + (x / xMax) * (w - L - R), ys = y => Tp + (1 - (y - lo) / (hi - lo)) * (h - Tp - Bt);
  g.strokeStyle = css("--line"); g.lineWidth = 1; g.fillStyle = css("--muted"); g.font = `${11 * s}px ${css("--font-mono")}`; g.textAlign = "right"; g.textBaseline = "middle";
  for (let t = 0; t <= 4; t++) { const y = lo + pad + (hi - lo - 2 * pad) * t / 4, py = ys(y); g.beginPath(); g.moveTo(L, py); g.lineTo(w - R, py); g.stroke(); g.fillText(y.toPrecision(3), L - 6 * s, py); }
  g.textAlign = "center"; g.textBaseline = "top"; const tick = xMax > 12 ? 5 : 1; for (let x = 0; x <= xMax + 1e-9; x += tick) { const px = xs(x); g.beginPath(); g.moveTo(px, Tp); g.lineTo(px, h - Bt); g.stroke(); g.fillText(String(x), px, h - Bt + 5 * s); }
  g.fillText("passes over the data (n·k distance computations)", (L + w - R) / 2, h - 15 * s);
  for (const se of series) { if (se.pts.length < 1) continue; g.strokeStyle = se.color; g.lineWidth = (se.dashed ? 1.4 : 2.2) * s; g.setLineDash(se.dashed ? [5 * s, 4 * s] : []); g.beginPath();
    se.pts.forEach((p, i) => { const px = xs(p.x), py = Math.max(Tp - 2, Math.min(h - Bt + 2, ys(p.y))); if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }); g.stroke(); g.setLineDash([]);
    const last = se.pts[se.pts.length - 1]; if (!se.dashed) { g.fillStyle = se.color; g.beginPath(); g.arc(xs(last.x), Math.max(Tp - 2, Math.min(h - Bt + 2, ys(last.y))), 3 * s, 0, 6.2832); g.fill(); } } }

