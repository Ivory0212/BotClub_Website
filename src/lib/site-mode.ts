/**
 * Preview / early-access mode.
 *
 * - Set `NEXT_PUBLIC_BOTCLUB_PREVIEW=true` (or `1`) so the UI shows the preview banner
 *   and purchase is replaced with “coming soon”.
 * - Optionally set `BOTCLUB_PREVIEW_MODE=true` on the server only; the purchase API also
 *   treats that as preview (blocks POST even if someone omits the public flag).
 *
 * For launch: remove or set both to `false`.
 */

export function isPreviewMode(): boolean {
  const v = process.env.BOTCLUB_PREVIEW_MODE ?? process.env.NEXT_PUBLIC_BOTCLUB_PREVIEW;
  return v === "true" || v === "1";
}
