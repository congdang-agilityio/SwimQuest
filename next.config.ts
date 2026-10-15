import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // src/middleware.ts runs on /api/swims, and Next truncates bodies it buffers for middleware
    // (default 10 MB). Keep this above the route cap (MAX_BODY_BYTES in api/swims/route.ts,
    // 10 MB + 64 KB) so the route, not the truncation, decides FILE_TOO_LARGE.
    middlewareClientMaxBodySize: "12mb",
  },
};

export default withNextIntl(nextConfig);
