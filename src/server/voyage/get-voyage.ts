import { getSelectedMembership } from "@/server/home/selected-tournament";
import { getTeamPoints } from "@/server/scoring/team-points";
import { routeProgress, type RouteProgress } from "@/lib/scoring/progress";
import { getRoute } from "@/lib/routes";
import { MAP_ASPECT } from "@/lib/routes/destinations-passed";
import { pointAlongPath, type MapPoint } from "@/lib/routes/path-position";
import route01Anchors from "../../../public/art/route01/map-anchors.json";

const anchorsByRoute: Record<string, { anchors: Record<string, MapPoint> }> = {
  route01: route01Anchors,
};

export type Voyage = {
  tournament: { id: string; name: string; routeId: string };
  team: { id: string; name: string; emblemKey: string };
  start: {
    slug: string;
    setBy: "CAPTAIN" | "ORGANIZER" | "AUTOMATIC" | null;
    setAt: Date | null;
  } | null;
  destinations: { slug: string; x: number; y: number; isFinish: boolean }[];
  path: MapPoint[] | null;
  progress: RouteProgress;
  ship: MapPoint | null;
};

/** Voyage data for the player's current team; always computed from current points. */
export async function getVoyage(
  userId: string,
  selectedTournamentId?: string | null,
): Promise<Voyage | null> {
  const current = await getSelectedMembership(userId, selectedTournamentId);
  if (!current) return null;
  const { tournament, team } = current;
  const route = getRoute(tournament.routeId);
  const anchors = anchorsByRoute[tournament.routeId]?.anchors;
  if (!route || !anchors) throw new Error(`No route or map anchors for ${tournament.routeId}`);

  const points = await getTeamPoints(tournament.id, team.id);
  const progress = routeProgress({
    teamPoints: points,
    routeDistanceM: tournament.routeDistanceM,
    pointsPerKm: tournament.pointsPerKm,
  });

  const destinations = route.destinations.map((d) => ({
    slug: d.slug,
    x: anchors[d.slug].x,
    y: anchors[d.slug].y,
    isFinish: d.isFinish,
  }));
  const startIndex = team.startDestination
    ? destinations.findIndex((d) => d.slug === team.startDestination)
    : -1;
  const path =
    startIndex >= 0 ? destinations.slice(startIndex).map(({ x, y }) => ({ x, y })) : null;

  return {
    tournament: { id: tournament.id, name: tournament.name, routeId: tournament.routeId },
    team: { id: team.id, name: team.name, emblemKey: team.emblemKey },
    start:
      startIndex >= 0
        ? { slug: destinations[startIndex].slug, setBy: team.startSetBy, setAt: team.startSetAt }
        : null,
    destinations,
    path,
    progress,
    ship: path ? pointAlongPath(path, Math.min(1, progress.progressBp / 10000), MAP_ASPECT) : null,
  };
}
