// Imports the ECM+ "Portico" branding site from a checkout of
// MostafaAllam-start/ecmplus-website-templates into public/, so the portal serves it:
//
//   pnpm site:import ../ecmplus-website-templates
//
// Pages land in public/site/<page>/index.html and are served at /site/<page> (see the
// rewrites in next.config.ts); the shared brand assets and photos go to public/assets/.
// Next.js drops trailing slashes, which would break the template's directory-relative
// links ("about/", "../documents/"), so every relative link is resolved against the
// file's place in the templates repo and rewritten to an absolute portal path. Root-
// relative links (/support/…, /contact) are kept: the portal answers them itself.
// Re-run after changing the templates; the output is committed.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.resolve(
  process.argv[2] ?? path.join(ROOT, "..", "ecmplus-website-templates"),
);
const TEMPLATE = path.join(SOURCE, "templates", "portico");
const SITE_OUT = path.join(ROOT, "public", "site");
const ASSETS_OUT = path.join(ROOT, "public", "assets");

const SITE_PREFIX = "/site";
const TEMPLATE_PREFIX = "/templates/portico/";
// Shared asset folders the Portico pages reference. The photo docs (CREDITS.md,
// PROMPTS.md) stay out of public/.
const ASSET_DIRS = ["brand", "brands", "photos/portico"];

const URL_ATTRS = /\b(href|src|action|poster)="([^"]*)"/g;
const SRCSET_ATTRS = /\b(srcset|imagesrcset)="([^"]*)"/g;
const BASE = "http://templates.local";

// Maps a link found in the template file at `filePath` (its URL path inside the
// templates repo) to the path the portal serves it at.
function rewriteUrl(value, filePath) {
  // Anchors, root-relative and absolute URLs (https:, mailto:, data:) stay as-is.
  if (!value || /^(#|\/|[a-z][a-z0-9+.-]*:)/i.test(value)) return value;

  const url = new URL(value, BASE + filePath);
  let pathname = url.pathname;
  if (pathname.startsWith(TEMPLATE_PREFIX)) {
    pathname = `${SITE_PREFIX}/${pathname.slice(TEMPLATE_PREFIX.length)}`;
    if (pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  } else if (!pathname.startsWith("/assets/")) {
    throw new Error(`Unexpected link "${value}" in ${filePath}`);
  }
  return pathname + url.search + url.hash;
}

function rewriteSrcset(value, filePath) {
  return value
    .split(",")
    .map((candidate) => {
      const [url, ...descriptors] = candidate.trim().split(/\s+/);
      return [rewriteUrl(url, filePath), ...descriptors].join(" ");
    })
    .join(", ");
}

function transformHtml(html, filePath) {
  // The template's demo form sends its page language to /contact. A form without
  // it comes from a templates checkout older than the toast/background-submit
  // update, which the portal's /contact handler expects.
  if (html.includes('id="demo-form"') && !html.includes('name="lang"')) {
    console.warn(`Warning: the demo form in ${filePath} has no lang field; update the templates checkout.`);
  }
  return html
    .replace(URL_ATTRS, (_, attr, value) => `${attr}="${rewriteUrl(value, filePath)}"`)
    .replace(SRCSET_ATTRS, (_, attr, value) => `${attr}="${rewriteSrcset(value, filePath)}"`);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function importPages() {
  await rm(SITE_OUT, { recursive: true, force: true });
  let pages = 0;
  for await (const file of walk(TEMPLATE)) {
    const rel = path.relative(TEMPLATE, file).split(path.sep).join("/");
    const target = path.join(SITE_OUT, rel);
    await mkdir(path.dirname(target), { recursive: true });
    if (rel.endsWith(".html")) {
      const html = await readFile(file, "utf8");
      await writeFile(target, transformHtml(html, TEMPLATE_PREFIX + rel));
      pages++;
    } else {
      await cp(file, target);
    }
  }
  return pages;
}

async function importAssets() {
  for (const dir of ASSET_DIRS) {
    const target = path.join(ASSETS_OUT, dir);
    await rm(target, { recursive: true, force: true });
    await cp(path.join(SOURCE, "assets", dir), target, {
      recursive: true,
      filter: (src) => !src.endsWith(".md"),
    });
  }
}

const pages = await importPages();
await importAssets();
console.log(`Imported ${pages} Portico pages into public/site and assets into public/assets.`);
