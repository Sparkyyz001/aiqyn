import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  // Шрифт с кириллицей и казахскими буквами для PDF-пакета eOtinish должен попасть в бандл функции
  outputFileTracingIncludes: {
    "/api/documents/**": ["./assets/fonts/**"],
    "/report/[no]/escalate": ["./assets/fonts/**"],
    "/api/og/**": ["./assets/fonts/**", "./assets/og-landscape.jpg"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "ixrghjvdbavkaimaftvw.supabase.co" }],
  },
  poweredByHeader: false,
  // Базовые заголовки безопасности. Камера, микрофон и геолокация — только для самого сайта
  // (фото проблемы, голосовая жалоба, точка на карте); встраивать сайт в чужие фреймы нельзя.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
