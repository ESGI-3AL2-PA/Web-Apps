import type { CreateNotificationDto } from "@repo/contracts";
import type { Notification } from "../../entities/notification.entity.js";
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

export const createNotificationUseCase = (notificationRepository: INotificationRepository) => {
  return async (data: CreateNotificationDto): Promise<Notification> => {
    return await notificationRepository.createNotification(data);
  };
};
