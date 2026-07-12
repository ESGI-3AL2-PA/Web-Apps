export type Scalar = string | number | boolean | null;

/**
 * Render a JS scalar as a SATAN QL literal, escaping strings so a value coming
 * from a request can't break out of the query. Use it when building query
 * strings: `client.query(\`FIND users WHERE _id = ${quote(id)}\`)`.
 */
export function quote(v: Scalar): string {
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("Cannot embed a non-finite number in SATAN QL");
    return String(v);
  }
  const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  return `"${escaped}"`;
}
