import type { Event } from "../../entities/event.entity.js";

export interface IEventRepository {
  ensureIndexes(): Promise<void>;

  getEvents(params: {
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
  }>;

  getEventById(id: string): Promise<Event | null>;

  /** Batch fetch by IDs. Result order is NOT guaranteed — re-sort if needed. */
  getEventsByIds(ids: string[]): Promise<Event[]>;

  createEvent(data: Omit<Event, "id" | "createdAt">): Promise<Event>;

  updateEvent(id: string, data: Partial<Omit<Event, "id" | "createdAt">>): Promise<Event | null>;

  deleteEvent(id: string): Promise<boolean>;

  addRegistrant(id: string, userId: string): Promise<Event | null>;

  removeRegistrant(id: string, userId: string): Promise<Event | null>;
}
