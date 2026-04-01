/**
 * Client-safe preview flag (must use NEXT_PUBLIC_* so it matches SSR/client bundles).
 * Pair with `isPreviewMode()` on the server / API routes.
 */
export const PREVIEW_MODE_PUBLIC =
  process.env.NEXT_PUBLIC_BOTCLUB_PREVIEW === "true" ||
  process.env.NEXT_PUBLIC_BOTCLUB_PREVIEW === "1";
