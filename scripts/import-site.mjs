// Imports the ECM+ "Portico" branding site into public/site, so the portal serves it.
//
// The site is the Next.js project `portico-next` of MostafaAllam-start/ecmplus-website-templates,
// built as a static export for this portal:
//
//   cd ecmplus-website-templates/portico-next
//   NEXT_PUBLIC_BASE_PATH=/site NEXT_PUBLIC_CONTACT_URL=/contact \
//   NEXT_PUBLIC_PARTNER_PORTAL_URL=/support/login npx next build
//
//   pnpm site:import ../ecmplus-website-templates/portico-next/out
//
// With basePath=/site every link, script and image in the export already points at /site/…,
// so the export is copied as it is (pages, _next assets, images). Pages are folders with an
// index.html, served at /site/<page> by the rewrites in next.config.ts; real files
// (/site/_next/…, /site/assets/…) are served before those rewrites apply.
//   - The demo form posts to /contact, which stores the request and redirects back to the
//     page with ?request=sent|invalid; the site shows that outcome as a toast itself.
//   - Support links (/support/login, /support/tickets, …) are handled by app/support.
// Re-run after changing the site; the output is committed.
import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.resolve(
  process.argv[2] ?? path.join(ROOT, "..", "ecmplus-website-templates", "portico-next", "out"),
);
const SITE_OUT = path.join(ROOT, "public", "site");

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(path.join(SOURCE, "index.html"))) || !(await exists(path.join(SOURCE, "_next")))) {
  throw new Error(`"${SOURCE}" is not a static export of portico-next (no index.html or _next). Build it first, see the header of this script.`);
}
const home = await readFile(path.join(SOURCE, "index.html"), "utf8");
if (!home.includes('/site/_next/')) {
  throw new Error("The export was built without NEXT_PUBLIC_BASE_PATH=/site: its assets would not resolve under /site.");
}

await rm(SITE_OUT, { recursive: true, force: true });
await mkdir(SITE_OUT, { recursive: true });
await cp(SOURCE, SITE_OUT, { recursive: true });

async function count(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) n += await count(full);
    else if (e.name === "index.html") n++;
  }
  return n;
}
console.log(`Imported ${await count(SITE_OUT)} Portico pages into public/site.`);
