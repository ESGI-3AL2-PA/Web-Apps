import type { Event } from "../../entities/event.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { IEventRepository } from "./event.repository.js";

/** SATAN QL for id / `IN`-batch lookups and the plain deletes (incl. the
 *  `event_interactions` sub-collection); Mongo for lists, guarded seat updates,
 *  upserts, `$pull` and the interaction scan. */
export class SatanEventRepository implements IEventRepository {
  constructor(
    private readonly mongo: IEventRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  getEventById(id: string): Promise<Event | null> {
    return this.satan.findOne<Event>(`FIND events WHERE _id = ${this.satan.q(id)}`);
  }

  getEventsByIds(ids: string[]): Promise<Event[]> {
    if (ids.length === 0) return Promise.resolve([]);
    const list = ids.map((id) => this.satan.q(id)).join(", ");
    return this.satan.find<Event>(`FIND events WHERE _id IN (${list})`);
  }

  async deleteEvent(id: string): Promise<boolean> {
    const deleted = await this.satan.delete(`DELETE FROM events WHERE _id = ${this.satan.q(id)}`);
    return deleted > 0;
  }

  async deleteByCreator(creatorId: string): Promise<void> {
    await this.satan.delete(`DELETE FROM events WHERE creatorId = ${this.satan.q(creatorId)}`);
  }

  async deleteUserInteractions(userId: string): Promise<void> {
    await this.satan.delete(`DELETE FROM event_interactions WHERE userId = ${this.satan.q(userId)}`);
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getEvents(params: Parameters<IEventRepository["getEvents"]>[0]) {
    return this.mongo.getEvents(params);
  }
  createEvent(data: Omit<Event, "id" | "createdAt">): Promise<Event> {
    return this.mongo.createEvent(data);
  }
  updateEvent(id: string, data: Partial<Omit<Event, "id" | "createdAt">>): Promise<Event | null> {
    return this.mongo.updateEvent(id, data);
  }
  addRegistrant(id: string, userId: string): Promise<Event | null> {
    return this.mongo.addRegistrant(id, userId);
  }
  removeRegistrant(id: string, userId: string): Promise<Event | null> {
    return this.mongo.removeRegistrant(id, userId);
  }
  recordAttendance(eventId: string, userId: string, rating?: number): Promise<void> {
    return this.mongo.recordAttendance(eventId, userId, rating);
  }
  recordInterest(eventId: string, userId: string, score: number): Promise<void> {
    return this.mongo.recordInterest(eventId, userId, score);
  }
  getAllInteractions() {
    return this.mongo.getAllInteractions();
  }
  removeUserFromAllEvents(userId: string): Promise<void> {
    return this.mongo.removeUserFromAllEvents(userId);
  }
}
