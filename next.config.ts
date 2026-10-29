import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  experimental: {
    // Image uploads are submitted through Server Actions; the default request
    // body limit is 1 MB, too small for the 5 MB images the dropzone allows.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  // The ECM+ branding site (static pages imported into public/site by
  // scripts/import-site.mjs) is the front door; the portal lives under /en, /ar.
  async redirects() {
    return [{ source: "/", destination: "/site", permanent: false }];
  },
  async rewrites() {
    // Each site page is a folder's index.html. Real files (styles.css, main.js)
    // are served before these apply.
    return [
      { source: "/site", destination: "/site/index.html" },
      { source: "/site/:path+", destination: "/site/:path+/index.html" },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
