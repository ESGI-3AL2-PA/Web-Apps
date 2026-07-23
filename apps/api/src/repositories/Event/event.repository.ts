import type { Event } from "../../entities/event.entity.js";

/**
 * Interface du repository des événements (couche persistance).
 *
 * Gère les événements de quartier, leur liste d'inscrits (avec sièges restants),
 * et une sous-collection d'interactions par utilisateur (présence + note, ou
 * signal d'intérêt 👍/👎). Ces interactions sont la source de vérité durable,
 * projetée dans Neo4j en best-effort par l'appelant pour le moteur de
 * recommandation.
 */
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

  /** Récupération par lot d'ids. L'ordre du résultat n'est PAS garanti — re-trier
   *  si besoin. */
  getEventsByIds(ids: string[]): Promise<Event[]>;

  createEvent(data: Omit<Event, "id" | "createdAt">): Promise<Event>;

  updateEvent(id: string, data: Partial<Omit<Event, "id" | "createdAt">>): Promise<Event | null>;

  deleteEvent(id: string): Promise<boolean>;

  /** Inscrit un utilisateur (garde-fou : pas déjà inscrit et sièges restants > 0). */
  addRegistrant(id: string, userId: string): Promise<Event | null>;

  /** Désinscrit un utilisateur et libère son siège. */
  removeRegistrant(id: string, userId: string): Promise<Event | null>;

  /** Enregistre (upsert) la présence d'un utilisateur + note optionnelle pour un
   *  événement. Source de vérité ; l'arête Neo4j est une projection synchronisée en
   *  best-effort par l'appelant. */
  recordAttendance(eventId: string, userId: string, rating?: number): Promise<void>;

  /** Enregistre (upsert) le signal d'intérêt 👍/👎 d'un utilisateur pour un
   *  événement. Source de vérité. */
  recordInterest(eventId: string, userId: string, score: number): Promise<void>;

  /** Supprime toutes les lignes d'interaction (présence/intérêt) d'un utilisateur —
   *  utilisé à la suppression de compte. */
  deleteUserInteractions(userId: string): Promise<void>;

  /** Toutes les lignes de présence/intérêt — utilisé par le job de réconciliation
   *  du graphe. */
  getAllInteractions(): Promise<
    { eventId: string; userId: string; kind: "attendance" | "interest"; rating?: number; score?: number }[]
  >;

  /** Supprime tous les événements créés par un utilisateur (suppression de compte). */
  deleteByCreator(creatorId: string): Promise<void>;

  /** Retire un utilisateur de la liste des inscrits de tous les événements qu'il
   *  avait rejoints (suppression de compte). */
  removeUserFromAllEvents(userId: string): Promise<void>;
}
