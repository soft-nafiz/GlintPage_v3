import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async headers() {
    return [
      {
        source: "/api/webhooks/:path*",
        headers: [{ key: "ngrok-skip-browser-warning", value: "true" }],
      },
    ];
  },
  allowedDevOrigins: ["192.168.0.103"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "eiwqqsvrrrvyvjwcqlzu.supabase.co",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
