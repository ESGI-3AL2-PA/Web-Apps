import type { Incident } from "../../entities/incident.entity.js";

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

  /** Delete every incident reported by a user (account deletion). */
  deleteByReporter(reporterId: string): Promise<void>;
}
