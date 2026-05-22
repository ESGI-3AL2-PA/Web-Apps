import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Event, EventStatus } from "../../entities/event.entity.js";
import type { IEventRepository } from "./event.repository.js";

type EventDoc = Omit<Event, "id"> & { _id: string };

export class MongoEventRepository implements IEventRepository {
  private collection: Collection<EventDoc>;

  constructor(db: Db) {
    this.collection = db.collection("events");
  }

  async getEvents(params: {
    search?: string;
    status?: string;
    districtId?: string;
    creatorId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Event[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, status, districtId, creatorId, page = 1, limit = 20 } = params;

    const filter: Filter<EventDoc> = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status as EventStatus;
    if (districtId) filter.districtId = districtId;
    if (creatorId) filter.creatorId = creatorId;

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map(this.toEvent), total, page, limit };
  }

  async getEventById(id: string): Promise<Event | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.toEvent(doc) : null;
  }

  async createEvent(data: Omit<Event, "id" | "createdAt">): Promise<Event> {
    const now = new Date().toISOString();
    const doc: EventDoc = { ...data, _id: randomUUID(), createdAt: now };
    await this.collection.insertOne(doc);
    return this.toEvent(doc);
  }

  async updateEvent(id: string, data: Partial<Omit<Event, "id" | "createdAt">>): Promise<Event | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { returnDocument: "after" },
    );
    return result ? this.toEvent(result) : null;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async addRegistrant(id: string, userId: string): Promise<Event | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id, registrants: { $ne: userId }, remainingSeats: { $gt: 0 } },
      { $addToSet: { registrants: userId }, $inc: { remainingSeats: -1 } },
      { returnDocument: "after" },
    );
    return result ? this.toEvent(result) : null;
  }

  async removeRegistrant(id: string, userId: string): Promise<Event | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id, registrants: userId },
      { $pull: { registrants: userId }, $inc: { remainingSeats: 1 } },
      { returnDocument: "after" },
    );
    return result ? this.toEvent(result) : null;
  }

  private toEvent(doc: EventDoc): Event {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
