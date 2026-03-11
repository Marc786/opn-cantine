import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'standalone' is for Docker/self-hosted deployments; skip it on Vercel
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  reactCompiler: true,
};

export default nextConfig;
