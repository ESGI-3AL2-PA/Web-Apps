/**
 * 001-example — migration d'exemple sans effet (no-op).
 *
 * Copier ce fichier vers `NNN-votre-changement.ts` (numéro suivant, avec zéros de tête) et
 * remplir `up`. Garder `up` idempotent quand c'est possible (ex. `createIndex` est réexécutable
 * sans risque) pour qu'une exécution partielle puisse être relancée. Fournir `down` quand le
 * changement est réversible ; le runner l'utilise pour `npm run migrate:down`.
 */

import type { Db } from "mongodb";

export const up = async (db: Db): Promise<void> => {
  // Exemple (laissé en commentaire — cette migration ne fait volontairement rien) :
  //   await db.collection("users").createIndex({ email: 1 }, { unique: true });
  void db;
};

export const down = async (db: Db): Promise<void> => {
  // Inverse de `up`. Exemple :
  //   await db.collection("users").dropIndex("email_1");
  void db;
};
