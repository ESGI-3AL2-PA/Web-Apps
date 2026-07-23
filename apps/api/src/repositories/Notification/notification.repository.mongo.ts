import { randomUUID } from "crypto";
import type { Collection, Db, Filter } from "mongodb";
import { toEntity, type WithMongoId } from "@repo/shared";
import type { Notification, NotificationType } from "../../entities/notification.entity.js";
import type { INotificationRepository } from "./notification.repository.js";

// Document Mongo = entité Notification + son `_id`.
type NotificationDoc = WithMongoId<Notification>;

/**
 * Implémentation Mongo du repository des notifications (collection
 * `notifications`). Liste triée du plus récent au plus ancien, marquage lu
 * unitaire ou en masse.
 */
export class MongoNotificationRepository implements INotificationRepository {
  private collection: Collection<NotificationDoc>;

  constructor(db: Db) {
    this.collection = db.collection("notifications");
  }

  async ensureIndexes(): Promise<void> {
    // Index qui sert au filtrage des listes par quartier (côté admin).
    await this.collection.createIndex({ districtId: 1 });
  }

  async getNotifications(params: {
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
  }> {
    const { recipientId, districtId, type, read, page = 1, limit = 20 } = params;

    const filter: Filter<NotificationDoc> = {};
    if (recipientId) filter.recipientId = recipientId;
    if (districtId) filter.districtId = districtId;
    if (type) filter.type = type as NotificationType;
    if (read !== undefined) filter.read = read;

    const [total, docs] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    return { data: docs.map((d) => toEntity<Notification>(d)), total, page, limit };
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toEntity<Notification>(doc) : null;
  }

  async createNotification(data: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification> {
    const now = new Date().toISOString();
    const doc: NotificationDoc = { ...data, _id: randomUUID(), createdAt: now, read: false };
    await this.collection.insertOne(doc);
    return toEntity<Notification>(doc);
  }

  async markNotificationRead(id: string): Promise<Notification | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: id },
      { $set: { read: true } },
      { returnDocument: "after" },
    );
    return result ? toEntity<Notification>(result) : null;
  }

  // Marque comme lues toutes les notifications non lues d'un destinataire ;
  // renvoie le nombre effectivement modifié.
  async markAllRead(recipientId: string): Promise<number> {
    const result = await this.collection.updateMany({ recipientId, read: false }, { $set: { read: true } });
    return result.modifiedCount;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  // Supprime toutes les notifications adressées à un user (suppression de compte).
  async deleteByRecipient(userId: string): Promise<void> {
    await this.collection.deleteMany({ recipientId: userId });
  }
}
