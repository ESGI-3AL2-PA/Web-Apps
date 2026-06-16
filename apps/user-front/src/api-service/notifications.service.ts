import type {
  CreateNotificationDto,
  MarkAllReadDto,
  MarkAllReadResponseDto,
  NotificationQueryDto,
  NotificationResponseDto,
  NotificationResponseDtoSchema,
  PaginatedResponseDto,
} from "@repo/contracts";

type PaginatedNotifications = PaginatedResponseDto<typeof NotificationResponseDtoSchema>;

export async function getNotifications(
  _filters: NotificationQueryDto = {} as NotificationQueryDto,
): Promise<PaginatedNotifications> {
  throw new Error("Not implemented");
}

export async function createNotification(
  _data: CreateNotificationDto,
): Promise<NotificationResponseDto> {
  throw new Error("Not implemented");
}

export async function markNotificationRead(_id: string): Promise<NotificationResponseDto> {
  throw new Error("Not implemented");
}

export async function markAllNotificationsRead(
  _data: MarkAllReadDto,
): Promise<MarkAllReadResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteNotification(_id: string): Promise<void> {
  throw new Error("Not implemented");
}
