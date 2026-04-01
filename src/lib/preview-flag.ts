/**
 * Client-safe preview flag (must use NEXT_PUBLIC_* so it matches SSR/client bundles).
 * Pair with `isPreviewMode()` on the server / API routes.
 */
export const PREVIEW_MODE_PUBLIC =
  process.env.NEXT_PUBLIC_BOTCLUB_PREVIEW === "true" ||
  process.env.NEXT_PUBLIC_BOTCLUB_PREVIEW === "1";

/** Matches `isPurchaseAllowed()` on the server: preview off + PURCHASE_ENABLED=true. */
export const PURCHASE_ALLOWED_PUBLIC =
  !PREVIEW_MODE_PUBLIC &&
  (process.env.NEXT_PUBLIC_BOTCLUB_PURCHASE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_BOTCLUB_PURCHASE_ENABLED === "1");
