import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" for Docker, default for Vercel
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
};

export default nextConfig;
