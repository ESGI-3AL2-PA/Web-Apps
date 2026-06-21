import type { Event } from "../../entities/event.entity.js";

export interface IEventRepository {
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

  /**
   * Récupère un lot d'events par leurs IDs. L'ordre du tableau renvoyé n'est
   * PAS garanti — le caller doit re-trier s'il a besoin d'un ordre spécifique
   * (typiquement le moteur de reco veut préserver l'ordre de pertinence).
   */
  getEventsByIds(ids: string[]): Promise<Event[]>;

  createEvent(data: Omit<Event, "id" | "createdAt">): Promise<Event>;

  updateEvent(id: string, data: Partial<Omit<Event, "id" | "createdAt">>): Promise<Event | null>;

  deleteEvent(id: string): Promise<boolean>;

  addRegistrant(id: string, userId: string): Promise<Event | null>;

  removeRegistrant(id: string, userId: string): Promise<Event | null>;
}
