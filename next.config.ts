import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads live PayPal data or the seller's cookie, so nothing is prerendered or cached.
  cacheComponents: false,
  // No dev-mode badge in recordings and screenshots.
  devIndicators: false,
  // Lets a demo-mode dev server run next to the live one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // frame-ancestors only: a full CSP would need the PayPal SDK allow-listed on the store pages.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
