// Small SVG charts for the results pages (no library). Each chart: one SVG, recessive grid, direct labels,
// a hover tooltip, and a table fallback already present on the page.
"use strict";
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function tipShow(tip, x, y, html) { tip.innerHTML = html; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.add("on"); }
function tipHide(tip) { tip.classList.remove("on"); }
const fmtPct = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(2) + "%";
const fmtK = (k) => k.toLocaleString("en-US");

// Relative loss against points per cluster (log x). series: [{name, color, pts:[{x, y, err, label, extra}]}]
function relChart(root, series, tip, opts) {
  const W = 760, H = 360, L = 56, Rr = 16, T = 14, B = 44; const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "" }, root);
  const xs = series.flatMap((s) => s.pts.map((p) => p.x)), ys = series.flatMap((s) => s.pts.flatMap((p) => [p.y - (p.err || 0), p.y + (p.err || 0)]));
  const x0 = Math.log10(Math.min(...xs) / 1.3), x1 = Math.log10(Math.max(...xs) * 1.3); let y0 = Math.min(0, Math.min(...ys)) - 0.5, y1 = Math.max(0, Math.max(...ys)) + 0.5;
  if (opts.ymin !== undefined) y0 = opts.ymin;
  const X = (v) => L + (Math.log10(v) - x0) / (x1 - x0) * (W - L - Rr), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const yt = niceTicks(y0, y1, 6); for (const t of yt) { el("line", { x1: L, x2: W - Rr, y1: Y(t), y2: Y(t), class: t === 0 ? "zero" : "grid" }, svg); el("text", { x: L - 8, y: Y(t) + 4, class: "tick", "text-anchor": "end" }, svg).textContent = (t > 0 ? "+" : t < 0 ? "−" : "") + Math.abs(t) + "%"; }
  const xt = [4, 8, 15, 30, 60, 120, 240, 480].filter((v) => Math.log10(v) >= x0 && Math.log10(v) <= x1); for (const t of xt) { el("line", { x1: X(t), x2: X(t), y1: T, y2: H - B, class: "grid" }, svg); el("text", { x: X(t), y: H - B + 16, class: "tick", "text-anchor": "middle" }, svg).textContent = String(t); }
  el("text", { x: (L + W - Rr) / 2, y: H - 8, class: "lab", "text-anchor": "middle" }, svg).textContent = opts.xlabel || "points per cluster (n / k)";
  el("text", { x: 14, y: T + 4, class: "lab", "text-anchor": "start", transform: `rotate(-90 14 ${T + 4})` , "dominant-baseline": "hanging"}, svg).textContent = "";
  for (const s of series) {
    if (s.line) { const d = s.pts.map((p, i) => (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" "); el("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round" }, svg); }
    for (const p of s.pts) {
      if (p.err) el("line", { x1: X(p.x), x2: X(p.x), y1: Y(p.y - p.err), y2: Y(p.y + p.err), stroke: s.color, "stroke-width": 1.5 }, svg);
      const c = el("circle", { cx: X(p.x), cy: Y(p.y), r: 5, fill: s.color, stroke: "var(--panel)", "stroke-width": 2 }, svg);
      if (p.label) el("text", { x: X(p.x) + 8, y: Y(p.y) - 7, class: "dlab" }, svg).textContent = p.label;
      const hit = el("circle", { cx: X(p.x), cy: Y(p.y), r: 14, fill: "transparent" }, svg);
      hit.addEventListener("mouseenter", () => { const r = root.getBoundingClientRect(), b = hit.getBoundingClientRect(); tipShow(tip, b.left - r.left + b.width / 2, b.top - r.top, p.tip); });
      hit.addEventListener("mouseleave", () => tipHide(tip));
    }
  }
  return svg;
}
function niceTicks(a, b, n) { const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), r = step0 / mag, step = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag; const out = []; for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(+t.toFixed(6)); return out; }

function sweepChart(root, sweep, tip) {
  relChart(root, [{ name: "h-means vs best e-means", color: "var(--hmeans)", line: true, pts: sweep.map((s) => ({ x: s.nk, y: s.vs_best, err: 100 * s.hmeans.std / Math.min(s.emeans.mean, s.emeans_q.mean), label: "k = " + fmtK(s.k), tip: `k = ${fmtK(s.k)}, n/k = ${s.nk.toFixed(0)}<br>h-means ${s.hmeans.mean.toFixed(0)} vs e-means ${Math.min(s.emeans.mean, s.emeans_q.mean).toFixed(0)}<br>${fmtPct(s.vs_best)} &nbsp; (${s.hmeans.time.toFixed(1)} s vs ${s.emeans.time.toFixed(1)} s)` })) }], tip, { aria: "h-means relative train loss against points per cluster on SIFT" });
}

function gridChart(root, grid, tip, key) {
  const names = [...new Set(grid.map((g) => g.name))];
  const pal = ["#2b6cb0", "#c8451f", "#2f855a", "#8a6d3b", "#6b46c1", "#b7791f"]; // fixed order by dataset name
  const series = names.map((nm, i) => ({ name: nm, color: pal[i % pal.length], pts: grid.filter((g) => g.name === nm).map((g) => ({ x: g.nk, y: g[key], err: key === "vs_best" ? g.vs_best_std : 0, tip: `${g.name}, k = ${fmtK(g.k)} (n/k = ${g.nk.toFixed(0)})<br>${fmtPct(g[key])}${key === "vs_best" ? ` ± ${g.vs_best_std.toFixed(2)}, ${g.seeds_won}/${g.seeds} seeds` : ""}` })) }));
  relChart(root, series, tip, { aria: "h-means relative loss per configuration" });
  const lg = document.createElement("div"); lg.className = "legend"; for (const s of series) { const sp = document.createElement("span"); sp.style.color = s.color; sp.textContent = s.name; lg.appendChild(sp); } root.appendChild(lg);
}

// Held-out loss against passes (log x): curves {method: {x:[], y:[]}}
function curveChart(root, curves, tip, title) {
  const W = 520, H = 300, L = 62, Rr = 12, T = 12, B = 40; const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": title }, root);
  const color = (m) => m.startsWith("h-means") ? "var(--hmeans)" : m.startsWith("e-means") ? "var(--emeans)" : m.startsWith("Lloyd") ? "var(--lloyd)" : "var(--sculley)";
  const dash = (m) => (m.includes("T3") ? "5 4" : m.includes("quality") ? "2 3" : "");
  const ms = Object.keys(curves).filter((m) => !m.startsWith("Sculley"));
  const finals = ms.map((m) => curves[m].y[curves[m].y.length - 1]); const lo = Math.min(...finals) * 0.995, hi = Math.max(...finals) * 1.012;
  const xmax = Math.max(...ms.flatMap((m) => curves[m].x)); const X = (v) => L + Math.log10(v) / Math.log10(xmax) * (W - L - Rr), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  for (const t of niceTicks(lo, hi, 5)) { el("line", { x1: L, x2: W - Rr, y1: Y(t), y2: Y(t), class: "grid" }, svg); el("text", { x: L - 6, y: Y(t) + 4, class: "tick", "text-anchor": "end" }, svg).textContent = t.toPrecision(4); }
  for (const t of [1, 2, 3, 5, 10, 25].filter((v) => v <= xmax)) { el("line", { x1: X(t), x2: X(t), y1: T, y2: H - B, class: "grid" }, svg); el("text", { x: X(t), y: H - B + 15, class: "tick", "text-anchor": "middle" }, svg).textContent = String(t); }
  el("text", { x: (L + W - Rr) / 2, y: H - 6, class: "lab", "text-anchor": "middle" }, svg).textContent = "passes over the data (n·k distance computations)";
  for (const m of ms) { const c = curves[m]; const pts = c.x.map((x, i) => [x, Math.min(hi, c.y[i])]); const d = pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" ");
    el("path", { d, fill: "none", stroke: color(m), "stroke-width": m.startsWith("h-means T5") && !m.includes("quality") ? 2.6 : 1.8, "stroke-dasharray": dash(m), "stroke-linejoin": "round" }, svg);
    for (let i = 0; i < pts.length; i++) { const h = el("circle", { cx: X(pts[i][0]), cy: Y(pts[i][1]), r: 9, fill: "transparent" }, svg); el("circle", { cx: X(pts[i][0]), cy: Y(pts[i][1]), r: 2.4, fill: color(m) }, svg);
      h.addEventListener("mouseenter", () => { const r = root.getBoundingClientRect(), b = h.getBoundingClientRect(); tipShow(tip, b.left - r.left + b.width / 2, b.top - r.top, `${m}<br>${c.x[i].toFixed(2)} passes: ${c.y[i].toPrecision(5)}`); }); h.addEventListener("mouseleave", () => tipHide(tip)); } }
  const lg = document.createElement("div"); lg.className = "legend"; for (const m of ms) { const sp = document.createElement("span"); sp.style.color = color(m); sp.textContent = m; lg.appendChild(sp); } root.appendChild(lg);
}

// Hero race on the overview page: same trainers as the playground, auto-run, no controls.
