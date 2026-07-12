import { quote, type SatanClient } from "@repo/satan";
import type { Notification } from "../../entities/notification.entity.js";
import type { INotificationRepository } from "./notification.repository.js";
import { eq, paginate, where } from "../satan.helpers.js";

/** SATAN QL for id lookup, the two deletes and the paginated list (COUNT + FIND,
 *  newest first). */
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

  getNotifications(params: Parameters<INotificationRepository["getNotifications"]>[0]) {
    const { recipientId, districtId, type, read, page = 1, limit = 20 } = params;
    const clause = where([
      recipientId && eq("recipientId", recipientId),
      districtId && eq("districtId", districtId),
      type && eq("type", type),
      read !== undefined && eq("read", read),
    ]);
    return paginate<Notification>(this.satan, "notifications", clause, { page, limit, sort: "createdAt DESC" });
  }

  // --- delegated to Mongo (server-generated fields) ---
  ensureIndexes(): Promise<void> {
    return this.mongo.ensureIndexes();
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
