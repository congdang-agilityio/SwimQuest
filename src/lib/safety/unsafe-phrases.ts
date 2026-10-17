/**
 * Phrases that would encourage unsafe swimming: pushing distance or pace past one's limits,
 * night swimming, or swimming alone in open water. Used by `scripts/check-safety-copy.mjs`.
 * Safety advice (namespace `safety`) may name these risks, and so may any sentence that
 * clearly warns against them (see NEGATORS).
 */
export type UnsafePattern = { id: string; pattern: RegExp };

export const UNSAFE_PATTERNS: UnsafePattern[] = [
  // English
  {
    id: "en-push-limits",
    pattern: /\b(push(ing)? (through|past|beyond)|no pain,? no gain|at any cost)\b/i,
  },
  {
    id: "en-exhaustion",
    pattern: /\b(until you drop|to exhaustion|swim (as )?(far|fast|hard) as you can)\b/i,
  },
  {
    id: "en-night",
    pattern: /\b(swim(ming)? (at|by|in the) (night|dark)|night[- ]swim(ming)?|after dark)\b/i,
  },
  {
    id: "en-alone",
    pattern:
      /\b(swim(ming)? (alone|solo|by yourself|on your own)|solo (open[- ]water )?swim(ming)?)\b/i,
  },
  // Vietnamese
  {
    id: "vi-push-limits",
    pattern: /(bất chấp|bằng mọi giá|vượt (qua )?giới hạn|đến (khi )?kiệt sức|hết (sức|mình))/i,
  },
  {
    id: "vi-night",
    pattern: /(bơi (vào )?(ban )?đêm|bơi lúc tối|bơi khi trời tối|bơi sau khi trời tối)/i,
  },
  { id: "vi-alone", pattern: /(bơi một mình|bơi đơn độc|tự bơi một mình)/i },
];

/** Words just before a match that turn it into a warning ("never swim alone"). */
const NEGATORS =
  /(?<![\p{L}])(never|don'?t|do not|not|no|avoid|without|stop|không|đừng|chớ|tránh|cấm|chẳng)(?![\p{L}])[^.!?]{0,20}$/iu;

export type UnsafeHit = { id: string; text: string };

/** Unsafe phrases found in one message string; warnings that negate the phrase are skipped. */
export function findUnsafePhrases(message: string): UnsafeHit[] {
  const hits: UnsafeHit[] = [];
  for (const { id, pattern } of UNSAFE_PATTERNS) {
    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
    );
    for (const m of message.matchAll(re)) {
      const before = message.slice(0, m.index);
      if (NEGATORS.test(before)) continue;
      hits.push({ id, text: m[0] });
    }
  }
  return hits;
}
