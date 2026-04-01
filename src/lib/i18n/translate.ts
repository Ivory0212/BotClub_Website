export function translate(
  dict: Record<string, unknown>,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object" || !(p in (cur as object))) {
      return path;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur !== "string") return path;
  if (!vars) return cur;
  return cur.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : "",
  );
}
