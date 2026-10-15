// Distance points for one verified swim (FR-49, FR-78): integer math only (NFR-08).
export type DistanceInput = {
  distanceM: number;
  longestSwimCountedM: number;
  dailyLimitM: number;
  alreadyCountedTodayM: number;
  pointsPerKm: number;
};

const bad = (v: number) => !Number.isSafeInteger(v) || v < 0;

export function countDistance(i: DistanceInput): { countedM: number; points: number } {
  const { distanceM, longestSwimCountedM, dailyLimitM, alreadyCountedTodayM, pointsPerKm } = i;
  if ([distanceM, longestSwimCountedM, dailyLimitM, alreadyCountedTodayM, pointsPerKm].some(bad)) {
    throw new RangeError("distance values must be non-negative integers");
  }
  const countedM = Math.min(
    distanceM,
    longestSwimCountedM,
    Math.max(0, dailyLimitM - alreadyCountedTodayM),
  );
  return { countedM, points: Math.floor((countedM * pointsPerKm) / 1000) };
}
