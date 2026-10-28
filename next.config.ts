import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads live PayPal data or the seller's cookie, so nothing is prerendered or cached.
  cacheComponents: false,
  // No dev-mode badge in recordings and screenshots.
  devIndicators: false,
  // Lets a demo-mode dev server run next to the live one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
