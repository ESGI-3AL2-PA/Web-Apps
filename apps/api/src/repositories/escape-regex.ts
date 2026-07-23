// Utilitaire de la couche repository : échappe les métacaractères de regex pour
// qu'une chaîne de recherche brute venue du client ne puisse pas injecter une
// « evil-regex » (backtracking catastrophique / déni de service par full-scan)
// lorsqu'elle est utilisée dans un $regex Mongo.
export function escapeRegex(input: string): string {
  // Préfixe chaque métacaractère par un backslash ($& = la correspondance capturée).
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
