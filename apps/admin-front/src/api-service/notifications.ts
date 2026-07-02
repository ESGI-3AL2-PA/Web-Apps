import type { CreateNotificationDto, NotificationResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listNotifications(params: ListParams): Promise<Paginated<NotificationResponseDto>> {
  const res = await api.get<Paginated<NotificationResponseDto>>("/notifications", { params });
  return res.data;
}

export async function createNotification(body: CreateNotificationDto): Promise<NotificationResponseDto> {
  const res = await api.post<NotificationResponseDto>("/notifications", body);
  return res.data;
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}
