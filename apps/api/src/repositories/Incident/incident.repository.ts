import type { Incident } from "../../entities/incident.entity.js";

export interface IIncidentRepository {
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

  getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byDistrict: Record<string, number>;
  }>;
}
