import type {
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

export async function markNotificationRead(_id: string): Promise<NotificationResponseDto> {
  throw new Error("Not implemented");
}

export async function markAllNotificationsRead(): Promise<MarkAllReadResponseDto> {
  throw new Error("Not implemented");
}
