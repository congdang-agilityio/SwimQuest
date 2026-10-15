/** Level curve: total XP needed to reach level n is 25 x n x (n - 1). Level 1 starts at 0 XP; no maximum. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 25 * n * (n - 1);
}

export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  let n = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 25)) / 2);
  // Correct floating-point drift around exact thresholds.
  while (xpForLevel(n + 1) <= xp) n++;
  while (n > 1 && xpForLevel(n) > xp) n--;
  return Math.max(1, n);
}

/** XP still missing to reach the next level (always > 0). */
export function xpToNextLevel(xp: number): number {
  const total = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  return xpForLevel(levelForXp(total) + 1) - total;
}
