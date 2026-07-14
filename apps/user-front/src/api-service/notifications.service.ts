import type {
  MarkAllReadResponseDto,
  NotificationQueryInput,
  NotificationResponseDto,
  NotificationResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedNotifications = PaginatedResponseDto<typeof NotificationResponseDtoSchema>;

// GET /notifications — the authed user's notifications (filters: read, type, …).
export async function getNotifications(filters: NotificationQueryInput = {}): Promise<PaginatedNotifications> {
  const res = await api.get<PaginatedNotifications>("/notifications", { params: filters });
  return res.data;
}

// PATCH /notifications/:id/read — mark one notification read (no body).
export async function markNotificationRead(id: string): Promise<NotificationResponseDto> {
  const res = await api.patch<NotificationResponseDto>(`/notifications/${id}/read`);
  return res.data;
}

// PATCH /notifications/read-all — mark every notification read.
export async function markAllNotificationsRead(): Promise<MarkAllReadResponseDto> {
  const res = await api.patch<MarkAllReadResponseDto>("/notifications/read-all");
  return res.data;
}
