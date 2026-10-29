import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for API routes, Next internals, files with an
  // extension (e.g. images, favicon), and the unlocalized branding-site routes:
  // the static site (/site), its support-link redirects (/support) and its demo
  // form handler (/contact).
  matcher: "/((?!api|_next|_vercel|(?:site|support|contact)(?:/|$)|.*\\..*).*)",
};
