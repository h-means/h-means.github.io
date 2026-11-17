// Front-page simulations. Each one runs several trainers from core.js on the same 2-D points, paced so that they
// advance together in distance computations, draws them side by side and summarises the final losses.
"use strict";
function raceSim(cfg) {
  const root = document.getElementById(cfg.root); let seed = cfg.seed || 0, run = null, raf = 0, variant = cfg.variants ? cfg.variants[0] : cfg;
  const M = cfg.trainers.length; root.classList.add("sim");
  // DOM
  const grid = document.createElement("div"); grid.className = "panelgrid"; grid.style.gridTemplateColumns = `repeat(${M}, minmax(0, 1fr))`; root.appendChild(grid);
  const cvs = [], sts = [];
  cfg.trainers.forEach((t) => { const p = document.createElement("div"); p.className = "panel"; p.innerHTML = `<h3><span class="dot" style="background: var(${t.color})"></span>${t.name}</h3><canvas width="420" height="420"></canvas><div class="stat"></div>`; grid.appendChild(p); cvs.push(p.querySelector("canvas")); sts.push(p.querySelector(".stat")); });
  const head = document.createElement("p"); head.className = "headline"; head.textContent = "Loading…"; root.appendChild(head);
  const ctl = document.createElement("div"); ctl.className = "simctl"; root.appendChild(ctl);
  const replay = document.createElement("button"); replay.className = "btn ghost"; replay.textContent = cfg.fixedData ? "Replay with a new start" : "Replay with a new seed"; ctl.appendChild(replay);
  let sel = null; if (cfg.variants) { sel = document.createElement("select"); for (const v of cfg.variants) { const o = document.createElement("option"); o.value = v.id; o.textContent = v.name; sel.appendChild(o); } ctl.appendChild(sel); sel.addEventListener("change", () => { variant = cfg.variants.find((v) => v.id === sel.value); start(); }); }
  let seedsBtn = null, seedsOut = null; if (cfg.seeds) { seedsBtn = document.createElement("button"); seedsBtn.className = "btn ghost"; seedsBtn.textContent = cfg.fixedData ? `Run ${cfg.seeds} random starts` : `Run ${cfg.seeds} seeds`; ctl.appendChild(seedsBtn); seedsOut = document.createElement("span"); seedsOut.className = "muted small"; ctl.appendChild(seedsOut); }
  const note = document.createElement("span"); note.className = "muted small"; ctl.appendChild(note);
  const denom = (m) => cfg.trainers[m].lloyd ? variant.iters : variant.T;
  function make(X, n, K, s) { return cfg.trainers.map((t) => t.make(X, n, K, variant.T, s, variant.iters)); }
  function start() { if (run) { run.cancelled = true; cancelAnimationFrame(raf); }
    const { n, K } = variant; const nTest = Math.max(2000, Math.round(0.2 * n)); const dseed = cfg.fixedData ? 0 : seed; const rows = GEN[variant.gen](n + nTest, K, dseed); const idx = shuffledIndices(mulberry32(dseed + 1), rows.length);
    const X = flatten(Array.from(idx.subarray(0, n)).map((i) => rows[i])), Xt = flatten(Array.from(idx.subarray(n)).map((i) => rows[i])); const b = bounds(X, n);
    cvs.forEach(fitCanvas); const layer = pointsLayer(X, n, cvs[0].width, cvs[0].height, b, css("--muted"));
    const r = { cancelled: false, X, Xt, nTest, n, K, b, layer, ops: new Array(M).fill(0), cpu: new Array(M).fill(0), trainers: make(X, n, K, seed), colors: cfg.trainers.map((t) => css(t.color)) };
    run = r; head.textContent = "Training…"; note.textContent = `n = ${fmtInt(n)}, k = ${fmtInt(K)} (${(n / K).toFixed(0)} points per cluster), ${cfg.fixedData ? "start" : "seed"} ${seed}`; raf = requestAnimationFrame(() => tick(r)); }
  function draw(r) { const nk = r.n * r.K; r.trainers.forEach((t, m) => { drawPanel(cvs[m], r.layer, t.C, r.K, r.b, r.colors[m]); sts[m].innerHTML = `k = ${fmtInt(r.K)} centroids · ${(r.ops[m] / nk).toFixed(2)} passes of n·k · ${t.label}${cfg.extra ? cfg.extra(t, m) : ""}`; }); }
  function tick(r) { if (r.cancelled) return; const t0 = performance.now(); const nk = r.n * r.K, goal = (m) => r.ops[m] / nk / denom(m);
    while (performance.now() - t0 < 14) { let m = -1; for (let q = 0; q < M; q++) { if (r.trainers[q].done) continue; if (m < 0 || goal(q) < goal(m)) m = q; } if (m < 0) break; const s = performance.now(); r.ops[m] += r.trainers[m].step(); r.cpu[m] += performance.now() - s; }
    draw(r); if (!r.trainers.every((t) => t.done)) { raf = requestAnimationFrame(() => tick(r)); return; }
    const tr = r.trainers.map((t) => meanLoss(r.X, r.n, t.C, r.K)), te = r.trainers.map((t) => meanLoss(r.Xt, r.nTest, t.C, r.K));
    r.trainers.forEach((t, m) => { sts[m].innerHTML = `train <b>${tr[m].toPrecision(4)}</b> · held-out <b>${te[m].toPrecision(4)}</b><br>k = ${fmtInt(r.K)} centroids · ${(r.ops[m] / nk).toFixed(2)} passes of n·k · ${(r.cpu[m] / 1000).toFixed(1)} s${cfg.extra ? cfg.extra(t, m) : ""}`; });
    head.innerHTML = cfg.summary(tr, te, r, variant, seed); }
  // many random starts on the same data, without drawing: a run is stuck when it ends more than 1% above the best loss any of the runs reached
  function runSeeds() { seedsBtn.disabled = true; const S = cfg.seeds, finals = Array.from({ length: M }, () => []); let s = 0; const { n, K } = variant; const rows = GEN[variant.gen](n, K, cfg.fixedData ? 0 : 0); const X = flatten(rows);
    const chunk = () => { const t0 = performance.now(); while (s < S && performance.now() - t0 < 30) { const ts = make(X, n, K, 1000 + s); ts.forEach((t, m) => { while (!t.done) t.step(); finals[m].push(meanLoss(X, n, t.C, K)); }); s++; seedsOut.textContent = `${s} / ${S} starts`; }
      if (s < S) { requestAnimationFrame(chunk); return; }
      const best = Math.min(...finals.flat()); const stuck = finals.map((f) => f.filter((v) => v > best * 1.01).length);
      seedsOut.innerHTML = cfg.trainers.map((t, m) => `<span style="color: var(${t.color}); font-weight: 600">${t.name}</span>: stuck on ${stuck[m]} of ${S} starts`).join(" · ") + ` (stuck = more than 1% above the best loss reached, ${best.toPrecision(4)})`; seedsBtn.disabled = false; };
    requestAnimationFrame(chunk); }
  replay.addEventListener("click", () => { seed++; start(); });
  if (seedsBtn) seedsBtn.addEventListener("click", runSeeds);
  window.addEventListener("resize", () => { if (run) { cvs.forEach(fitCanvas); run.layer = pointsLayer(run.X, run.n, cvs[0].width, cvs[0].height, run.b, css("--muted")); draw(run); } });
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { threshold: 0.15 }); io.observe(cvs[0]);
}
const pctBetter = (a, b) => ((1 - a / b) * 100).toFixed(1);
