/**
 * The app build this server runs (#922). Open pages compare it with the build they were loaded
 * from to offer the "Update" card. Public, never cached; the service worker skips /api.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { build: process.env.SQ_BUILD_ID ?? "dev" },
    { headers: { "cache-control": "no-store" } },
  );
}
