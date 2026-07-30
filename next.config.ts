import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/repair": [
      "./node_modules/vitest/**/*",
      "./node_modules/vite/**/*",
      "./lib/sandbox/**/*",
      "./fixtures/**/*",
    ],
  },
};

export default nextConfig;
