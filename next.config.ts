import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * One id per build (#922): the deployed commit on Railway, else a timestamp. It is set on
 * process.env first so every worker Next spawns while building sees the same value. It becomes
 * Next's build id and is inlined as SQ_BUILD_ID into the client (the build a page runs), the
 * /api/version route (the build the server serves) and the service worker (src/app/sw.js).
 */
process.env.SQ_BUILD_ID ||=
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) || `local-${Date.now().toString(36)}`;
const buildId = process.env.SQ_BUILD_ID;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  generateBuildId: async () => buildId,
  env: { SQ_BUILD_ID: buildId },
  // The browser must always fetch the latest service worker, never an HTTP-cached copy.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
  experimental: {
    // src/middleware.ts runs on /api/swims, and Next truncates bodies it buffers for middleware
    // (default 10 MB). Keep this above the route cap (MAX_BODY_BYTES in api/swims/route.ts,
    // 10 MB + 64 KB) so the route, not the truncation, decides FILE_TOO_LARGE.
    middlewareClientMaxBodySize: "12mb",
  },
};

export default withNextIntl(nextConfig);
