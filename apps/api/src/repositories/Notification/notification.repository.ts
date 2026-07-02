import type { Notification } from "../../entities/notification.entity.js";

export interface INotificationRepository {
  ensureIndexes(): Promise<void>;

  getNotifications(params: {
    recipientId?: string;
    districtId?: string;
    type?: string;
    read?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Notification[];
    total: number;
    page: number;
    limit: number;
  }>;

  getNotificationById(id: string): Promise<Notification | null>;

  createNotification(data: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification>;

  markNotificationRead(id: string): Promise<Notification | null>;

  markAllRead(recipientId: string): Promise<number>;

  deleteNotification(id: string): Promise<boolean>;
}
