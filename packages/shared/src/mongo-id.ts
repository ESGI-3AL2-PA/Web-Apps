/**
 * Mongo stores the primary key as `_id`; the domain entities use `id`. Both
 * backends repeated the same `{ _id, ...rest } → { id, ...rest }` mapping and the
 * `Omit<T, "id"> & { _id: string }` document alias in ~15 repositories. These are
 * the shared helpers.
 */

/** The persisted shape of an entity `T` — `id` swapped for Mongo's string `_id`. */
export type WithMongoId<T extends { id: string }> = Omit<T, "id"> & { _id: string };

/** Document → entity: rename `_id` to `id`, and drop the internal offline-sync stamp. */
export const toEntity = <T extends { id: string }>(doc: WithMongoId<T>): T => {
  const { _id, _sync, ...rest } = doc as WithMongoId<T> & { _sync?: unknown };
  return { id: _id, ...rest } as unknown as T;
};

/** Entity → document: rename `id` to `_id`. */
export const toDoc = <T extends { id: string }>(entity: T): WithMongoId<T> => {
  const { id, ...rest } = entity;
  return { _id: id, ...rest } as WithMongoId<T>;
};
