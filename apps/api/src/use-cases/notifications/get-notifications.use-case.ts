import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

export const getNotificationsUseCase = (notificationRepository: INotificationRepository) => {
  return async (params: { recipientId?: string; type?: string; read?: boolean; page?: number; limit?: number }) => {
    return await notificationRepository.getNotifications(params);
  };
};
