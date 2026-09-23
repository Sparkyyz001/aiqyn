import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  // Шрифт с кириллицей и казахскими буквами для PDF-пакета eOtinish должен попасть в бандл функции
  outputFileTracingIncludes: {
    "/api/documents/**": ["./assets/fonts/**"],
    "/report/[no]/escalate": ["./assets/fonts/**"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "ixrghjvdbavkaimaftvw.supabase.co" }],
  },
};

export default nextConfig;
