import type { Collection, Db } from "mongodb";
import type { ICounterRepository } from "./counter.repository.js";

interface CounterDoc {
  _id: string;
  seq: number;
}

export class MongoCounterRepository implements ICounterRepository {
  private collection: Collection<CounterDoc>;

  constructor(db: Db) {
    this.collection = db.collection<CounterDoc>("counters");
  }

  async next(name: string): Promise<number> {
    const doc = await this.collection.findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return doc!.seq;
  }
}
