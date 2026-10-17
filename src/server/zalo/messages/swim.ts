import { formatPace } from "@/lib/format/swim";
import { db } from "@/server/db";
import type { ZaloStoredPayload } from "../render";
import { playerNameVi } from "./team";

const pad = (n: number) => String(n).padStart(2, "0");

/** Metres as kilometres with 2 decimals, Vietnamese style: 1250 -> "1,25 km". */
export function km2Vi(metres: number): string {
  return `${(metres / 1000).toFixed(2).replace(".", ",")} km`;
}

/** Seconds as "h:mm:ss" (always with hours): 2723 -> "0:45:23". */
export function hmsVi(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Progress basis points as a Vietnamese percentage: 4567 -> "45,67%". */
export function percentVi(bp: number): string {
  return `${String(Math.round(bp) / 100).replace(".", ",")}%`;
}

type Part = { tournamentId: string; resultId: string };

function partsOf(payload: ZaloStoredPayload): Part[] {
  const raw = Array.isArray(payload.parts) ? payload.parts : [];
  const parts: Part[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const { tournamentId, resultId } = p as Record<string, unknown>;
    if (typeof tournamentId === "string" && typeof resultId === "string") {
      parts.push({ tournamentId, resultId });
    }
  }
  return parts;
}

/**
 * COUNTED_SWIM (S-87): who swam (display name), distance, time and pace, then one block per
 * tournament of this group the swim counts in: the points this swim earned there and the team's
 * progress, both read now (the message is sent after the scoring committed). A part whose result
 * no longer counts (revoked before sending) is left out; null when none is left.
 */
export async function renderCountedSwim(payload: ZaloStoredPayload): Promise<string | null> {
  const parts = partsOf(payload);
  if (parts.length === 0) return null;
  const results = await db.swimResult.findMany({
    where: { id: { in: parts.map((p) => p.resultId) }, status: "VERIFIED" },
    select: {
      id: true,
      tournament: { select: { name: true } },
      team: { select: { name: true, progressBp: true } },
      swim: { select: { distanceM: true, durationS: true } },
      user: { select: { displayName: true, privacy: true } },
    },
  });
  if (results.length === 0) return null;
  const byId = new Map(results.map((r) => [r.id, r]));
  const points = await db.pointsEntry.groupBy({
    by: ["swimResultId"],
    where: { swimResultId: { in: results.map((r) => r.id) } },
    _sum: { points: true },
  });
  const pointsOf = new Map(points.map((p) => [p.swimResultId, p._sum.points ?? 0]));

  const { swim, user } = results[0];
  const pace = swim.distanceM > 0 ? formatPace(swim.durationS / (swim.distanceM / 100)) : "-";
  const lines = [
    `${playerNameVi(user)} vừa hoàn thành một buổi bơi được tính!`,
    `Quãng đường: ${km2Vi(swim.distanceM)} · Thời gian: ${hmsVi(swim.durationS)} · Tốc độ: ${pace}`,
  ];
  for (const part of parts) {
    const r = byId.get(part.resultId);
    if (!r) continue;
    lines.push(
      "",
      `[${r.tournament.name}] +${pointsOf.get(r.id) ?? 0} điểm cho đội "${r.team.name}"`,
      `Tiến độ của đội: ${percentVi(r.team.progressBp)} lộ trình`,
    );
  }
  return lines.join("\n");
}
