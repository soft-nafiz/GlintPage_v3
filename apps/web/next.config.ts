import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public", // Places the compiled service worker inside your public directory
  disable: process.env.NODE_ENV === "development", // Keeps it disabled in dev mode so it won't mess with fast refresh
  register: true, // Automatically registers the service worker file
});

const nextConfig: NextConfig = {
  /* config options here */

  turbopack: {},

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

export default withPWA(nextConfig);
