import type { Event } from "../../entities/event.entity.js";

export interface IEventRepository {
  getEvents(params: {
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
  }>;

  getEventById(id: string): Promise<Event | null>;

  createEvent(data: Omit<Event, "id" | "createdAt">): Promise<Event>;

  updateEvent(id: string, data: Partial<Omit<Event, "id" | "createdAt">>): Promise<Event | null>;

  deleteEvent(id: string): Promise<boolean>;

  addRegistrant(id: string, userId: string): Promise<Event | null>;

  removeRegistrant(id: string, userId: string): Promise<Event | null>;
}
