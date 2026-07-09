import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "./event.repository.js";

type EventDoc = Omit<Event, "id"> & { _id: string };

// Per-user attendance/interest signals — the durable source of truth, mirrored
// into Neo4j (best-effort) for the recommendation engine.
type InteractionDoc = {
  eventId: string;
  userId: string;
  kind: "attendance" | "interest";
  rating?: number;
  score?: number;
  at: string;
};

// Default event duration: within 4h of start = "ongoing", after = "completed".
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export class MongoEventRepository implements IEventRepository {
  private collection: Collection<EventDoc>;
  private interactions: Collection<InteractionDoc>;

  constructor(db: Db) {
    this.collection = db.collection("events");
    this.interactions = db.collection("event_interactions");
  }

  async ensureIndexes(): Promise<void> {
    // Backs district-scoped list filtering.
    await this.collection.createIndex({ districtId: 1 });
    // One interaction row per (event, user, kind) — makes record* an idempotent upsert.
    await this.interactions.createIndex({ eventId: 1, userId: 1, kind: 1 }, { unique: true });
    await this.interactions.createIndex({ userId: 1 });
  }

  async getEvents(params: {
    search?: string;
    status?: string;
    districtId?: string;
    creatorId?: string;
    registrantId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Event[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { search, status, districtId, creatorId, registrantId, page = 1, limit = 20 } = params;

    const filter: Filter<EventDoc> = {};

    // Title-only search — matching description/location caused false positives.
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    if (districtId) filter.districtId = districtId;
    if (creatorId) filter.creatorId = creatorId;
    if (registrantId) filter.registrants = registrantId;

    // Date-derived status (see computeStatus in the use-case); "cancelled" stays explicit.
    if (status) {
      if (status === "cancelled") {
        filter.status = "cancelled";
      } else {
        filter.status = { $ne: "cancelled" };
        const nowIso = new Date().toISOString();
        const fourHoursAgoIso = new Date(Date.now() - FOUR_HOURS_MS).toISOString();
        if (status === "upcoming") {
          filter.eventDate = { $gt: nowIso };
        } else if (status === "ongoing") {
          filter.eventDate = { $gt: fourHoursAgoIso, $lte: nowIso };
        } else if (status === "completed") {
          filter.eventDate = { $lte: fourHoursAgoIso };
        }
      }
    }

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

  async getEventsByIds(ids: string[]): Promise<Event[]> {
    if (ids.length === 0) return [];
    const docs = await this.collection.find({ _id: { $in: ids } }).toArray();
    return docs.map(this.toEvent);
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

  async recordAttendance(eventId: string, userId: string, rating?: number): Promise<void> {
    await this.interactions.updateOne(
      { eventId, userId, kind: "attendance" },
      { $set: { rating, at: new Date().toISOString() } },
      { upsert: true },
    );
  }

  async recordInterest(eventId: string, userId: string, score: number): Promise<void> {
    await this.interactions.updateOne(
      { eventId, userId, kind: "interest" },
      { $set: { score, at: new Date().toISOString() } },
      { upsert: true },
    );
  }

  async deleteUserInteractions(userId: string): Promise<void> {
    await this.interactions.deleteMany({ userId });
  }

  private toEvent(doc: EventDoc): Event {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
}
