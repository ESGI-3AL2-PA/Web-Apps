import { quote, type SatanClient } from "@repo/satan";
import type { Notification } from "../../entities/notification.entity.js";
import type { INotificationRepository } from "./notification.repository.js";

/** SATAN QL for id lookup and the two deletes. */
export class SatanNotificationRepository implements INotificationRepository {
  constructor(
    private readonly mongo: INotificationRepository,
    private readonly satan: SatanClient,
  ) {}

  async getNotificationById(id: string): Promise<Notification | null> {
    const rows = (await this.satan.query(`FIND notifications WHERE _id = ${quote(id)}`)) as Notification[];
    return rows[0] ?? null;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const res = (await this.satan.query(`DELETE FROM notifications WHERE _id = ${quote(id)}`)) as {
      deletedCount: number;
    };
    return res.deletedCount > 0;
  }

  async deleteByRecipient(userId: string): Promise<void> {
    await this.satan.query(`DELETE FROM notifications WHERE recipientId = ${quote(userId)}`);
  }

  // --- delegated to Mongo ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
  }
  getNotifications(params: Parameters<INotificationRepository["getNotifications"]>[0]) {
    return this.mongo.getNotifications(params);
  }
  createNotification(data: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification> {
    return this.mongo.createNotification(data);
  }
  markNotificationRead(id: string): Promise<Notification | null> {
    return this.mongo.markNotificationRead(id);
  }
  markAllRead(recipientId: string): Promise<number> {
    return this.mongo.markAllRead(recipientId);
  }
}
