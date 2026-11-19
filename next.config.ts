import type { NextConfig } from "next";

const devOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Origin tambahan untuk `next dev` (mis. ponsel di LAN). Dari env supaya
  // alamat IP lokal tidak hardcoded di repo.
  allowedDevOrigins: devOrigins.length > 0 ? devOrigins : undefined,
  output: "standalone",

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // --- CORS & Cookie Cross-Origin ---
          // Frontend terpisah mengirim Authorization: Bearer header -> CORS wajib
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // Jika butuh cookie cross-origin (refresh token masa depan): set di backend response
          // { key: "Set-Cookie", value: "SameSite=None; Secure" },  // butuh HTTPS prod
        ],
      },
    ];
  },
};

export default nextConfig;
