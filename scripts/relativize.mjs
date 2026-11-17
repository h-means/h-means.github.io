// Rewrite absolute "/_astro/..." (and "/assets/", "/figures/") references in dist/ to relative ones.
// Run after `astro build`. Every page lives at the dist root (build.format = "file"), so one level
// of relativity is enough; CSS files sit in _astro/ next to the fonts they reference.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
function walk(dir) { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
let n = 0;
for (const file of walk(dist)) {
  if (file.endsWith(".html")) {
    const s = readFileSync(file, "utf8");
    const t = s.replace(/(href|src)="\/(_astro|assets|figures)\//g, '$1="$2/').replace(/(href)="\/([a-z0-9-]+)(\.html)?"/g, (m, a, p) => `${a}="${p}.html"`).replace(/href="\/"/g, 'href="index.html"');
    if (t !== s) { writeFileSync(file, t); n++; }
  } else if (file.endsWith(".css")) {
    const s = readFileSync(file, "utf8");
    const t = s.replace(/url\(\/_astro\//g, "url(");
    if (t !== s) { writeFileSync(file, t); n++; }
  }
}
console.log(`relativized ${n} files in dist/`);
