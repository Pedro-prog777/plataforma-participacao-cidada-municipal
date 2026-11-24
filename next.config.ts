import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  // Permite um diretório de build separado (ex.: testes E2E sem conflitar com o servidor de desenvolvimento).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // No build dos testes E2E a verificação de tipos e o lint já rodaram antes (npm run check).
  typescript: { ignoreBuildErrors: process.env.NEXT_DIST_DIR === ".next-e2e" },
  eslint: { ignoreDuringBuilds: process.env.NEXT_DIST_DIR === ".next-e2e" },
  reactStrictMode: true,
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2", "pg", "pdf-lib", "qrcode"],
  experimental: {
    // Anexos de até 20 MB (RF023) trafegam por Server Actions.
    serverActions: { bodySizeLimit: "25mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack(config) {
    // `import texto from "arquivo.md?raw"`: o Documento de Requisitos entra no build como texto
    // (página /requisitos e referências cruzadas automáticas, DT-24). O Vitest já entende `?raw`.
    config.module.rules.push({ resourceQuery: /raw/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
