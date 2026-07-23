import type {
  MarkAllReadResponseDto,
  NotificationQueryInput,
  NotificationResponseDto,
  NotificationResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

/**
 * Service client des notifications de l'utilisateur : lecture paginée et marquage comme lu
 * (individuel ou en masse).
 */
type PaginatedNotifications = PaginatedResponseDto<typeof NotificationResponseDtoSchema>;

// GET /notifications — les notifications de l'utilisateur authentifié (filtres : read, type, …).
export async function getNotifications(filters: NotificationQueryInput = {}): Promise<PaginatedNotifications> {
  const res = await api.get<PaginatedNotifications>("/notifications", { params: filters });
  return res.data;
}

// PATCH /notifications/:id/read — marque une notification comme lue (sans corps).
export async function markNotificationRead(id: string): Promise<NotificationResponseDto> {
  const res = await api.patch<NotificationResponseDto>(`/notifications/${id}/read`);
  return res.data;
}

// PATCH /notifications/read-all — marque toutes les notifications comme lues.
export async function markAllNotificationsRead(): Promise<MarkAllReadResponseDto> {
  const res = await api.patch<MarkAllReadResponseDto>("/notifications/read-all");
  return res.data;
}
