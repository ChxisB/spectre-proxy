import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/chat", destination: "/", permanent: true },
      { source: "/projects", destination: "/", permanent: true },
      { source: "/settings", destination: "/tools", permanent: true },
      { source: "/plugins", destination: "/tools", permanent: true },
    ];
  },
};

export default nextConfig;
