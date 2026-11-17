// Record the overview page's live comparison as demo.gif. The page composes its own frames (the three
// canvases plus the status lines) into an offscreen canvas every 150 ms, which is cheap; the frames are
// pulled out once the run is complete and assembled with ffmpeg.
// Usage: node scripts/demo-gif.mjs [url] [out.gif]   (the dev server must be running)
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

const url = process.argv[2] || "http://127.0.0.1:4321/";
const out = process.argv[3] || "public/assets/demo.gif";
const dir = new URL("../.demo-frames/", import.meta.url).pathname;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--disable-gpu", "--no-sandbox", "--no-first-run", "--disable-extensions"], timeout: 30000 });
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 1000, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector("#sim-hero .headline");
await page.evaluate(() => {
  const W = 1200, P = 380, G = 30, TOP = 44, H = TOP + P + 70;
  const off = document.createElement("canvas"); off.width = W; off.height = H; const g = off.getContext("2d");
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const names = ["Lloyd, 25 iterations", "e-means, 5 passes", "h-means, 5 passes"], cols = ["--lloyd", "--emeans", "--hmeans"];
  window.__frames = [];
  const grab = () => {
    g.fillStyle = css("--bg"); g.fillRect(0, 0, W, H);
    for (let m = 0; m < 3; m++) {
      const x = 15 + m * (P + G), cv = document.querySelectorAll("#sim-hero canvas")[m];
      g.fillStyle = css(cols[m]); g.beginPath(); g.arc(x + 6, TOP - 16, 5, 0, 6.3); g.fill();
      g.fillStyle = css("--fg"); g.font = "600 17px 'IBM Plex Sans', sans-serif"; g.textBaseline = "middle"; g.fillText(names[m], x + 18, TOP - 16);
      g.drawImage(cv, x, TOP, P, P);
      const st = document.querySelectorAll("#sim-hero .stat")[m].innerHTML.replace(/<br>/g, " · ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      g.fillStyle = css("--muted"); g.font = "12px 'IBM Plex Mono', monospace"; g.fillText(st.replace(/ · \d+\.\d+ s$/, "").slice(0, 56), x, TOP + P + 20);
    }
    const head = document.querySelector("#sim-hero .headline").textContent.replace(/\s+/g, " ").trim();
    g.fillStyle = css("--fg"); g.font = "500 17px 'Fraunces', Georgia, serif"; g.fillText(head.slice(0, 120), 15, TOP + P + 50);
    window.__frames.push(off.toDataURL("image/png"));
    if (head.startsWith("h-means:")) { window.__done = (window.__done || 0) + 1; }
  };
  window.__timer = setInterval(() => { grab(); if (window.__done >= 14) clearInterval(window.__timer); }, 40);  // the run takes ~2 s headless
  document.getElementById("sim-hero").scrollIntoView({ block: "center" });
});
await page.waitForFunction(() => window.__done >= 14, { timeout: 120000, polling: 250 });
const frames = await page.evaluate(() => window.__frames);
frames.forEach((d, i) => writeFileSync(`${dir}f${String(i).padStart(3, "0")}.png`, Buffer.from(d.split(",")[1], "base64")));
console.log(`${frames.length} frames`);
execSync(`ffmpeg -y -loglevel error -framerate 7 -i ${dir}f%03d.png -vf "scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 ${out}`);
console.log(`wrote ${out}`);
process.exit(0);  // browser.close() can hang with this Chrome build; the process exit takes it down
