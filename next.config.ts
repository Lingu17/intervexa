import type { NextConfig } from "next";
const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
if (process.env.VERCEL && !process.env.BACKEND_URL) {
  throw new Error("Set BACKEND_URL to the Render API HTTPS origin before deploying to Vercel.");
}
if (process.env.VERCEL && new URL(backendUrl).protocol !== "https:") {
  throw new Error("Vercel deployments require an HTTPS BACKEND_URL.");
}
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Repository indexing has a bounded 180-second backend deadline.
  experimental: { proxyTimeout: 190_000 },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
