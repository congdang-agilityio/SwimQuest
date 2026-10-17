// GET (organizer) downloads the tournament's privacy-controlled CSV; the export is audited.
import { requireApiUser } from "@/server/auth/current-user";
import { roleErrorResponse } from "@/server/auth/roles";
import { exportTournament } from "@/server/organizer/export";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const { filename, csv } = await exportTournament(auth.user.id, id, new Date());
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const response = roleErrorResponse(err);
    if (response) return response;
    throw err;
  }
}
