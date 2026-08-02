import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/repair": [
      "./node_modules/vitest/**/*",
      "./node_modules/@vitest/**/*",
      "./node_modules/vite/**/*",
      "./node_modules/tsx/**/*",
      "./node_modules/esbuild/**/*",
      "./lib/sandbox/**/*",
      "./fixtures/**/*",
    ],
  },
};

export default nextConfig;