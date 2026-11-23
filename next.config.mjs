// Plain JavaScript (not next.config.ts) so no compiler is needed to load it: on hosts whose Linux is too old
// for Next's native SWC binary (e.g. shared hosting), the WebAssembly fallback can't compile a TypeScript config.

/** @type {import("next").NextConfig} */
const nextConfig = {
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
