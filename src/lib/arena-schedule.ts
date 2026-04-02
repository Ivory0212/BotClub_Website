/**
 * Global synchronized arena schedule (UTC wall clock).
 * All viewers share the same 30-minute match slots and deterministic seeds.
 */

export const MATCH_INTERVAL_MS = 30 * 60 * 1000;

/** Nominal max turns per arena-engine match (must match initArena default). */
export const SCHEDULED_MAX_TURNS = 80;

/**
 * Wall-clock budget per turn so 80 turns span the full slot (broadcast pace).
 */
export const REAL_MS_PER_TURN = MATCH_INTERVAL_MS / SCHEDULED_MAX_TURNS;

/** Start timestamp (ms) of the UTC slot containing `now`. */
export function getCurrentSlotStartUtc(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / MATCH_INTERVAL_MS) * MATCH_INTERVAL_MS;
}

/** Ms until the next slot boundary (new match) after `nowMs`. */
export function msUntilNextSlotUtc(nowMs: number = Date.now()): number {
  const next = getCurrentSlotStartUtc(nowMs) + MATCH_INTERVAL_MS;
  return Math.max(0, next - nowMs);
}

/** Integer seed for initArena — stable for everyone in the same slot. */
export function deriveMatchSeed(slotStartMs: number): number {
  return (slotStartMs ^ 0x5bd1e995) | 0;
}

/**
 * Per-turn RNG seed so all clients reproduce identical turns for the same slot.
 * `turn` is the 1-based turn number (what executeTurn uses internally as `turn`).
 */
export function deriveTurnSeed(slotStartMs: number, turn: number): number {
  return Math.imul((slotStartMs ^ turn * 0x9e3779b1) | 0, 0x85ebca6b) | 0;
}

export function formatCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m ${r}s`;
  }
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}
