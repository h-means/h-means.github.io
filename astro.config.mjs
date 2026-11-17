// @ts-check
import { defineConfig } from "astro/config";

// Static site. `build.format: "file"` puts every page at the root (method.html, results.html, ...),
// and scripts/relativize.mjs rewrites the absolute asset paths to relative ones after the build, so
// the dist/ folder works from any sub-path (local file://, previews) as well as from the root of h-means.github.io.
export default defineConfig({
  site: process.env.SITE_URL || "https://h-means.github.io/",
  output: "static",
  build: { format: "file", assets: "_astro" },
  trailingSlash: "never",
});
