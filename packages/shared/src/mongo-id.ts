/**
 * Helpers partagés de mapping clé primaire (couche « repository »).
 * Mongo stocke la clé primaire sous `_id` ; les entités de domaine utilisent `id`.
 * Les deux backends répétaient le même mapping `{ _id, ...rest } → { id, ...rest }`
 * et l'alias de document `Omit<T, "id"> & { _id: string }` dans ~15 repositories.
 * Voici les helpers mutualisés.
 */

/** Forme persistée d'une entité `T` — `id` remplacé par le `_id` (string) de Mongo. */
export type WithMongoId<T extends { id: string }> = Omit<T, "id"> & { _id: string };

/** Document → entité : renomme `_id` en `id`, et retire le tampon interne de synchro offline. */
export const toEntity = <T extends { id: string }>(doc: WithMongoId<T>): T => {
  const { _id, _sync, ...rest } = doc as WithMongoId<T> & { _sync?: unknown };
  return { id: _id, ...rest } as unknown as T;
};

/** Entité → document : renomme `id` en `_id`. */
export const toDoc = <T extends { id: string }>(entity: T): WithMongoId<T> => {
  const { id, ...rest } = entity;
  return { _id: id, ...rest } as WithMongoId<T>;
};
