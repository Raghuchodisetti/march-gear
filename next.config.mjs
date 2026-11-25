// Plain JavaScript (not next.config.ts) so no compiler is needed to load it: on hosts whose Linux is too old
// for Next's native SWC binary (e.g. shared hosting), the WebAssembly fallback can't compile a TypeScript config.

/** @type {import("next").NextConfig} */
const nextConfig = {
  // PDF.js (via unpdf, used to read guide PDFs) is loaded by Node at runtime rather than bundled.
  serverExternalPackages: ["unpdf"],
  experimental: {
    // Requests through src/proxy.ts (the /admin and /staff desks) are buffered up to this size — room for a guide's
    // 15 MB PDF upload (the default is 10 MB).
    proxyClientMaxBodySize: "20mb",
  },
  images: {
    // Unsplash serves resized, format-negotiated renditions from its own CDN,
    // so we hand sizing off to it instead of the built-in optimizer.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    qualities: [60, 75, 85],
  },
  async redirects() {
    return [
      {
        // www.marchgear.in/… → https://marchgear.in/… (any www. host; path and query are kept). Permanent (308).
        source: "/:path*",
        has: [{ type: "host", value: "www\\.(?<domain>.+)" }],
        destination: "https://:domain/:path*",
        permanent: true,
      },
      // Moved routes (permanent, 308 — browsers and search engines update their links). Keep this list as the
      // single record of renamed public URLs. Trailing slashes are handled by Next itself (/x/ → /x, 308).
      // /profile → /account: the customer area moved (the old page also permanentRedirects as a fallback).
      { source: "/profile", destination: "/account", permanent: true },
      // /cars has no index of its own — the catalogue lives at /new-cars (car pages stay at /cars/<slug>).
      { source: "/cars", destination: "/new-cars", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // The admin panel must never be framed (clickjacking).
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        // Nor the staff desk (the same pages as /admin).
        source: "/staff/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        // Nor the insurance vendor portal (its private file route sets its own framing headers for PDF previews).
        source: "/insurance-vendor/:path((?!files/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
