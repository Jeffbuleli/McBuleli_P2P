/** Express types allow string | string[] for params */
export function routeParam(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string") throw new Error("MISSING_ROUTE_PARAM");
  return s;
}

/** Flat query values only (req.query); ignores nested ParsedQs objects */
export function queryString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) {
    const x = v[0];
    return typeof x === "string" ? x : "";
  }
  return "";
}
