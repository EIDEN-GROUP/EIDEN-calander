/**
 * Deterministic pseudo-random series (seeded PRNG).
 * Used for demo/preview KPI shapes: identical on every render and on the
 * server, so hydration never mismatches. NOT crypto random.
 */

/** xmur3-ish string hash → 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n values in [floor, floor + spread): stable for a given key. */
export function seededSeries(
  key: string,
  n: number,
  floor: number,
  spread: number,
): number[] {
  const rand = mulberry32(hashSeed(key));
  return Array.from({ length: n }, () =>
    Math.max(0, Math.round(floor + rand() * spread)),
  );
}

/**
 * Random-walk series with a gentle upward drift: for KPI sparklines.
 * Always stays positive and ends above it starts (matches "we are growing").
 */
export function walkSeries(
  key: string,
  n: number,
  start: number,
  step: number,
): number[] {
  const rand = mulberry32(hashSeed(key));
  let v = start;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    v = Math.max(step * 0.4, v + (rand() - 0.38) * step);
    out.push(Math.round(v));
  }
  return out;
}
