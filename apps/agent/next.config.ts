import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a monorepo with multiple lockfiles; pin the Turbopack
  // root to this package so the correct workspace is used.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
