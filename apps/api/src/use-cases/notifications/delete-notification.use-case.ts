import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

export const deleteNotificationUseCase = (notificationRepository: INotificationRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await notificationRepository.deleteNotification(params.id);
  };
};
