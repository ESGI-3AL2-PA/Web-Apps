import type { Notification } from "../../entities/notification.entity.js";
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

export const markNotificationReadUseCase = (notificationRepository: INotificationRepository) => {
  return async (id: string): Promise<Notification | null> => {
    return await notificationRepository.markNotificationRead(id);
  };
};
