import type { Collection, Db } from "mongodb";
import type { ICounterRepository } from "./counter.repository.js";

// Un document par compteur nommé : `_id` = nom du compteur, `seq` = dernière
// valeur distribuée.
interface CounterDoc {
  _id: string;
  seq: number;
}

/**
 * Implémentation Mongo du repository de compteurs (collection `counters`).
 * Distribue des séquences atomiques (ex. numéros incrémentaux) via un `$inc`
 * upsert sur un unique document.
 */
export class MongoCounterRepository implements ICounterRepository {
  private collection: Collection<CounterDoc>;

  constructor(db: Db) {
    this.collection = db.collection<CounterDoc>("counters");
  }

  async next(name: string): Promise<number> {
    // `$inc` upsert atomique : crée le compteur au 1er appel puis renvoie la
    // valeur incrémentée (`returnDocument: "after"`).
    const doc = await this.collection.findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return doc!.seq;
  }
}
