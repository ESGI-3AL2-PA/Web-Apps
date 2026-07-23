import { quote, type SatanClient } from "@repo/satan";
import type { Event } from "../../entities/event.entity.js";
import type { IEventRepository } from "./event.repository.js";
import { containsAny, eq, paginate, where } from "../satan.helpers.js";

/** Fenêtre du statut "ongoing" dérivé de la date — reflète le repo Mongo. */
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Repository des événements en implémentation hybride.
 *
 * SATAN QL pour les recherches par id / par lot `IN`, les suppressions simples (y
 * compris la sous-collection `event_interactions`) et la liste paginée (COUNT +
 * FIND avec le filtre de statut dérivé de la date) ; Mongo pour les mises à jour
 * de sièges gardées, les upserts, le `$pull` et le scan des interactions.
 */
export class SatanEventRepository implements IEventRepository {
  constructor(
    private readonly mongo: IEventRepository,
    private readonly satan: SatanClient,
  ) {}

  async getEventById(id: string): Promise<Event | null> {
    const rows = (await this.satan.query(`FIND events WHERE _id = ${quote(id)}`)) as Event[];
    return rows[0] ?? null;
  }

  async getEventsByIds(ids: string[]): Promise<Event[]> {
    if (ids.length === 0) return [];
    const list = ids.map((id) => quote(id)).join(", ");
    return (await this.satan.query(`FIND events WHERE _id IN (${list})`)) as Event[];
  }

  async deleteEvent(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM events WHERE _id = ${quote(id)}`)) as { deletedCount: number };
    return res.deletedCount > 0;
  }

  async deleteByCreator(creatorId: string): Promise<void> {
    await this.satan.query(`DELETE FROM events WHERE creatorId = ${quote(creatorId)}`);
  }

  async deleteUserInteractions(userId: string): Promise<void> {
    await this.satan.query(`DELETE FROM event_interactions WHERE userId = ${quote(userId)}`);
  }

  getEvents(params: Parameters<IEventRepository["getEvents"]>[0]) {
    const { search, status, districtId, creatorId, registrantId, page = 1, limit = 20 } = params;
    const conditions: Array<string | false | null | undefined> = [
      // Recherche sur le titre uniquement — matcher description/lieu produisait des
      // faux positifs.
      search && containsAny(["title"], search),
      districtId && eq("districtId", districtId),
      creatorId && eq("creatorId", creatorId),
      registrantId && eq("registrants", registrantId),
    ];
    // Statut dérivé de la date (cf. computeStatus dans le cas d'usage) ; "cancelled"
    // reste un statut explicite stocké.
    if (status === "cancelled") {
      conditions.push(eq("status", "cancelled"));
    } else if (status) {
      conditions.push(`status != ${quote("cancelled")}`);
      const nowIso = new Date().toISOString();
      const fourHoursAgoIso = new Date(Date.now() - FOUR_HOURS_MS).toISOString();
      if (status === "upcoming") {
        conditions.push(`eventDate > ${quote(nowIso)}`);
      } else if (status === "ongoing") {
        conditions.push(`eventDate > ${quote(fourHoursAgoIso)} AND eventDate <= ${quote(nowIso)}`);
      } else if (status === "completed") {
        conditions.push(`eventDate <= ${quote(fourHoursAgoIso)}`);
      }
    }
    return paginate<Event>(this.satan, "events", where(conditions), { page, limit });
  }

  // --- délégué à Mongo (écritures gardées/upsert/$pull et scan des interactions) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
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
