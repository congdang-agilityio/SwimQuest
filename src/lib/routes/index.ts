import { route01 } from "./route01";

export type Destination = {
  slug: string;
  /** Message key in the `tournaments` namespace. */
  nameKey: string;
  isFinish: boolean;
};

export type Route = {
  id: string;
  destinations: readonly Destination[];
};

const routes: readonly Route[] = [route01];

export function listRoutes(): readonly Route[] {
  return routes;
}

export function getRoute(id: string): Route | null {
  return routes.find((r) => r.id === id) ?? null;
}

/** Destinations a tournament can start from: all but the finish. */
export function startDestinations(route: Route): readonly Destination[] {
  return route.destinations.filter((d) => !d.isFinish);
}
