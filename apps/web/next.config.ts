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
    proxyClientMaxBodySize: "60mb",
  },
  async headers() {
    return [
      {
        source: "/api/webhooks/:path*",
        headers: [{ key: "ngrok-skip-browser-warning", value: "true" }],
      },
      // COEP/COOP only on the reader route (needed for SharedArrayBuffer)
      {
        source: "/read/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
      // General security headers for all routes (without COEP/COOP)
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; img-src 'self' https://lh3.googleusercontent.com https://covers.openlibrary.org https://standardebooks.org https://archive.org https://*.archive.org https://eiwqqsvrrrvyvjwcqlzu.supabase.co data: blob:; media-src 'self' blob: https://eiwqqsvrrrvyvjwcqlzu.supabase.co; connect-src 'self' https://eiwqqsvrrrvyvjwcqlzu.supabase.co wss://eiwqqsvrrrvyvjwcqlzu.supabase.co https://app.lemonsqueezy.com; frame-src 'self' https://app.lemonsqueezy.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://app.lemonsqueezy.com; style-src 'self' 'unsafe-inline'; font-src 'self';",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
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
        hostname: "covers.openlibrary.org",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "standardebooks.org",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "archive.org",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.archive.org",
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
