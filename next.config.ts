import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Unsplash serves resized, format-negotiated renditions from its own CDN,
    // so we hand sizing off to it instead of the built-in optimizer.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    qualities: [60, 75, 85],
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
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
