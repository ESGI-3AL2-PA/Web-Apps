import type { Notification } from "../../entities/notification.entity.js";
import type { SatanQueryRunner } from "../satan/satan-runner.js";
import type { INotificationRepository } from "./notification.repository.js";

/** SATAN QL for id lookup and the two deletes. */
export class SatanNotificationRepository implements INotificationRepository {
  constructor(
    private readonly mongo: INotificationRepository,
    private readonly satan: SatanQueryRunner,
  ) {}

  getNotificationById(id: string): Promise<Notification | null> {
    return this.satan.findOne<Notification>(`FIND notifications WHERE _id = ${this.satan.q(id)}`);
  }

  async deleteNotification(id: string): Promise<boolean> {
    const deleted = await this.satan.delete(`DELETE FROM notifications WHERE _id = ${this.satan.q(id)}`);
    return deleted > 0;
  }

  async deleteByRecipient(userId: string): Promise<void> {
    await this.satan.delete(`DELETE FROM notifications WHERE recipientId = ${this.satan.q(userId)}`);
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
