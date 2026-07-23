import { quote, type SatanClient, type Scalar } from "@repo/satan";

/**
 * Helpers de construction de requêtes SATAN QL, partagés par les repositories
 * adossés à SATAN.
 *
 * Ils gardent les méthodes de listing paginé déclaratives : on construit une
 * liste de conditions WHERE à partir des paramètres de filtre optionnels, puis
 * on passe collection + clause à `paginate`, qui exécute un `COUNT` et un `FIND`
 * paginé et remet en forme le résultat dans l'enveloppe `{ data, total, page, limit }`
 * que renvoie chaque endpoint de liste. Toutes les valeurs passent par `quote`,
 * de sorte que les appelants n'interpolent jamais de chaînes brutes dans la requête
 * (protection contre l'injection).
 */

/** Condition `field = value`. */
export const eq = (field: string, value: Scalar): string => `${field} = ${quote(value)}`;

/**
 * Recherche par sous-chaîne littérale, insensible à la casse, sur un ou plusieurs
 * champs, combinés en OU — l'équivalent SATAN QL du `{ $regex: term, $options: "i" }`
 * de Mongo. Mis entre parenthèses quand il porte sur plusieurs champs pour composer
 * proprement avec un AND englobant.
 */
export const containsAny = (fields: string[], text: string): string => {
  const clause = fields.map((f) => `${f} CONTAINS ${quote(text)}`).join(" OR ");
  return fields.length > 1 ? `(${clause})` : clause;
};

/** Assemble les conditions non-falsy en une clause ` WHERE …` (chaîne vide si aucune). */
export const where = (conditions: Array<string | false | null | undefined>): string => {
  const parts = conditions.filter((c): c is string => Boolean(c));
  return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
};

/** Enveloppe de résultat paginé renvoyée par tous les endpoints de liste. */
export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Exécute un `COUNT` + un `FIND` paginé (le schéma à deux requêtes que Mongo fait
 * avec `countDocuments` + `find().skip().limit()`) et renvoie l'enveloppe standard.
 * `sort` est un corps ORDER BY brut, ex. `"createdAt DESC"`.
 */
export async function paginate<T>(
  satan: SatanClient,
  collection: string,
  whereClause: string,
  opts: { page: number; limit: number; sort?: string },
): Promise<Page<T>> {
  const { page, limit, sort } = opts;
  const skip = (page - 1) * limit;
  const order = sort ? ` ORDER BY ${sort}` : "";
  const [countRes, data] = await Promise.all([
    satan.query(`COUNT ${collection}${whereClause}`) as Promise<{ count: number }>,
    satan.query(`FIND ${collection}${whereClause}${order} SKIP ${skip} LIMIT ${limit}`) as Promise<T[]>,
  ]);
  return { data, total: countRes.count, page, limit };
}
