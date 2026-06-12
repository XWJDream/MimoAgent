/**
 * Context pressure detection module.
 *
 * Monitors how much of the model's context window is consumed and
 * reports a pressure level so the agent loop can trigger compaction
 * before hitting hard limits.
 *
 * Design mirrors MiMo-Code's overflow.ts but adapted for the
 * MimoAgent engine's simpler type surface.
 */

/** Buffer reserved for compaction summary output */
const COMPACTION_BUFFER = 20_000

/**
 * Cap the output reservation so models with large output windows
 * (e.g. 32K, 64K) don't strangle the usable input window.
 * 20K covers >99.99% of compaction summary outputs.
 */
const OUTPUT_CAP = 20_000

export interface OverflowInput {
  /** Model context window size (e.g. 128000, 262144, 1048576) */
  contextWindow: number
  /** Model max output tokens */
  maxOutputTokens: number
  /** Current prompt tokens consumed this turn */
  currentTokens: number
}

/**
 * Calculate usable input window after reserving space for output
 * and compaction overhead.
 */
export function usable(input: OverflowInput): number {
  if (input.contextWindow === 0) return 0
  const outputReserve = Math.min(input.maxOutputTokens, OUTPUT_CAP)
  return Math.max(0, input.contextWindow - outputReserve - COMPACTION_BUFFER)
}

/**
 * Detect whether the conversation has overflowed the usable window.
 */
export function isOverflow(input: OverflowInput): boolean {
  return input.currentTokens >= usable(input)
}

/**
 * Pressure level (0-3).
 *   0: < 50%  -- no pressure
 *   1: 50-69% -- light
 *   2: 70-84% -- moderate
 *   3: >= 85% -- severe
 */
export function pressureLevel(input: OverflowInput): 0 | 1 | 2 | 3 {
  const u = usable(input)
  if (u === 0) return 0
  const ratio = input.currentTokens / u
  if (ratio < 0.50) return 0
  if (ratio < 0.70) return 1
  if (ratio < 0.85) return 2
  return 3
}
