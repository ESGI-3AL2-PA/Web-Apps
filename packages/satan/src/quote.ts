/** Valeur scalaire embarquable dans une requête SATAN QL. */
export type Scalar = string | number | boolean | null;

/**
 * Rend un scalaire JS en littéral SATAN QL, en échappant les chaînes pour qu'une
 * valeur venant d'une requête ne puisse pas s'échapper du contexte (protection
 * contre l'injection). À utiliser pour construire des chaînes de requête :
 * `client.query(\`FIND users WHERE _id = ${quote(id)}\`)`.
 */
export function quote(v: Scalar): string {
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    // NaN / Infinity n'ont pas de littéral valide : on refuse plutôt que d'émettre une requête cassée.
    if (!Number.isFinite(v)) throw new Error("Cannot embed a non-finite number in SATAN QL");
    return String(v);
  }
  // Échappe backslash, guillemet et sauts de ligne, puis entoure de guillemets doubles.
  const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  return `"${escaped}"`;
}
