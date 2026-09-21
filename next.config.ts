import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // no native sqlite on Vercel
  // Cloudflare quick tunnel host, so `next dev` accepts the public origin.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
