import { quote, type SatanClient, type Scalar } from "@repo/satan";

/**
 * SATAN QL query-building helpers shared by the SATAN-backed repositories.
 *
 * They keep the paginated list methods declarative: build a list of WHERE
 * conditions from the optional filter params, then hand collection + clause to
 * `paginate`, which runs a `COUNT` and a paginated `FIND` and reshapes the
 * result into the `{ data, total, page, limit }` envelope every list endpoint
 * returns. All values go through `quote`, so callers never interpolate raw
 * strings into the query.
 */

/** `field = value`. */
export const eq = (field: string, value: Scalar): string => `${field} = ${quote(value)}`;

/**
 * Case-insensitive literal-substring match across one or more fields, OR-combined
 * — the SATAN QL equivalent of Mongo's `{ $regex: term, $options: "i" }` search.
 * Parenthesised when it spans several fields so it AND-composes safely.
 */
export const containsAny = (fields: string[], text: string): string => {
  const clause = fields.map((f) => `${f} CONTAINS ${quote(text)}`).join(" OR ");
  return fields.length > 1 ? `(${clause})` : clause;
};

/** Join the truthy conditions into a ` WHERE …` clause (empty string if none). */
export const where = (conditions: Array<string | false | null | undefined>): string => {
  const parts = conditions.filter((c): c is string => Boolean(c));
  return parts.length ? ` WHERE ${parts.join(" AND ")}` : "";
};

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Run a `COUNT` + a paginated `FIND` (the two-query shape Mongo does with
 * `countDocuments` + `find().skip().limit()`) and return the standard envelope.
 * `sort` is a raw ORDER BY body, e.g. `"createdAt DESC"`.
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
