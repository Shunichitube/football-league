export function seedToInt(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function createRandom(seed) {
  let state = seedToInt(seed) || 1;
  const next = () => ((state = (state + 0x6D2B79F5) | 0), ((state = Math.imul(state ^ state >>> 15, state | 1)) ^ state + Math.imul(state ^ state >>> 7, state | 61)) >>> 0) / 4294967296;
  return { next, int: (min, max) => Math.floor(next() * (max - min + 1)) + min, pick: xs => xs[Math.floor(next() * xs.length)] };
}

export function weightedPick(items, weightOf, rng) {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
  let cursor = rng.next() * total;
  for (const item of items) { cursor -= Math.max(0, weightOf(item)); if (cursor <= 0) return item; }
  return items.at(-1);
}
