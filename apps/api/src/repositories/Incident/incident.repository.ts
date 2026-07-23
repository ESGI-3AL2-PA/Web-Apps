import type { Incident } from "../../entities/incident.entity.js";

/**
 * Contrat du repository des signalements (incidents). Implémenté par la version
 * Mongo et la version SATAN QL ; les cas d'usage ne dépendent que de cette
 * interface.
 */
export interface IIncidentRepository {
  ensureIndexes(): Promise<void>;

  getIncidents(params: {
    search?: string;
    status?: string;
    category?: string;
    districtId?: string;
    reporterId?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Incident[];
    total: number;
    page: number;
    limit: number;
  }>;

  getIncidentById(id: string): Promise<Incident | null>;

  createIncident(data: Omit<Incident, "id" | "createdAt" | "updatedAt">): Promise<Incident>;

  updateIncident(id: string, data: Partial<Omit<Incident, "id" | "createdAt" | "updatedAt">>): Promise<Incident | null>;

  deleteIncident(id: string): Promise<boolean>;

  getStats(params?: { districtId?: string; reporterId?: string }): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  }>;

  /** Supprime tous les signalements créés par un user (suppression de compte). */
  deleteByReporter(reporterId: string): Promise<void>;
}
