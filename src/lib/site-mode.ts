/**
 * Preview / early-access mode.
 *
 * - Set `NEXT_PUBLIC_BOTCLUB_PREVIEW=true` (or `1`) so the UI shows the preview banner
 *   and purchase is replaced with “coming soon”.
 * - Optionally set `BOTCLUB_PREVIEW_MODE=true` on the server only; the purchase API also
 *   treats that as preview (blocks POST even if someone omits the public flag).
 *
 * Purchase (checkout + revealing hidden strategy on the bot page) is **off by default**.
 * When you are ready: set `NEXT_PUBLIC_BOTCLUB_PURCHASE_ENABLED=true` (and turn off preview).
 */

export function isPreviewMode(): boolean {
  const v = process.env.BOTCLUB_PREVIEW_MODE ?? process.env.NEXT_PUBLIC_BOTCLUB_PREVIEW;
  return v === "true" || v === "1";
}

function envTruthy(v: string | undefined): boolean {
  return v === "true" || v === "1";
}

/** Real purchase flow + showing unlocked strategy blocks. Default false until explicitly enabled. */
export function isPurchaseAllowed(): boolean {
  if (isPreviewMode()) return false;
  return envTruthy(process.env.NEXT_PUBLIC_BOTCLUB_PURCHASE_ENABLED);
}
