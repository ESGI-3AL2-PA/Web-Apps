import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

export const markAllNotificationsReadUseCase = (notificationRepository: INotificationRepository) => {
  return async (recipientId: string): Promise<number> => {
    return await notificationRepository.markAllRead(recipientId);
  };
};
