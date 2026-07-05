import type {
  MarkAllReadResponseDto,
  NotificationQueryDto,
  NotificationResponseDto,
  NotificationResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedNotifications = PaginatedResponseDto<typeof NotificationResponseDtoSchema>;

// GET /notifications — paginated list (filters: read, type, recipientId, …)
// Le backend renvoie uniquement les notifs du user authentifié (sauf admin).
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

// PATCH /notifications/:id/read — marque une notification comme lue (pas de body)
export async function markNotificationRead(id: string): Promise<NotificationResponseDto> {
  try {
    const res = await api.patch<NotificationResponseDto>(`/notifications/${id}/read`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du marquage de la notification comme lue");
  }
}

// PATCH /notifications/read-all — marque toutes les notifs du user comme lues
export async function markAllNotificationsRead(): Promise<MarkAllReadResponseDto> {
  try {
    const res = await api.patch<MarkAllReadResponseDto>("/notifications/read-all");
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du marquage en masse des notifications");
  }
}
