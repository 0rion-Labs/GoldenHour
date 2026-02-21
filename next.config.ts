import type { NextConfig } from "next";
// @ts-expect-error — next-pwa does not ship TypeScript declarations
import withPWA from "next-pwa";

const nextConfig: NextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})({
  // Turbopack empty config to satisfy Next.js 16 requirement
  turbopack: {},
});

export default nextConfig;
