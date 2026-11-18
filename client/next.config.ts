import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E (playwright.config.ts) chạy dev server riêng với thư mục build riêng.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
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
