// Cache-busting for files under public/: Astro copies them verbatim, without a content hash in the
// name, so browsers keep stale copies across deploys. asset("/assets/sims.js") appends ?v=<hash>.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function asset(path: string): string {
  const file = new URL(`../../public${path}`, import.meta.url);
  const hash = createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 8);
  return `${path}?v=${hash}`;
}
