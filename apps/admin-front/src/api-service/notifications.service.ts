import type {
  CreateNotificationDto,
  NotificationQueryDto,
  NotificationResponseDto,
  NotificationResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedNotifications = PaginatedResponseDto<typeof NotificationResponseDtoSchema>;

// Consigne ADMIN — NOTIFICATIONS:
//   - Create (envoyer une notification à tout le quartier)
//   - Read
// (Pas de markAsRead / markAllRead — c'est l'utilisateur final qui consulte ses
//  notifs côté user-front.)

// GET /notifications — paginated list (filtres: read, type, recipientId, …)
export async function getNotifications(
  filters: NotificationQueryDto = {} as NotificationQueryDto,
): Promise<PaginatedNotifications> {
  try {
    const res = await api.get<PaginatedNotifications>("/notifications", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all notifications");
  }
}

// POST /notifications — broadcast/cible une notification (admin → quartier ou user)
export async function createNotification(
  data: CreateNotificationDto,
): Promise<NotificationResponseDto> {
  try {
    const res = await api.post<NotificationResponseDto>("/notifications", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'envoi de la notification");
  }
}
