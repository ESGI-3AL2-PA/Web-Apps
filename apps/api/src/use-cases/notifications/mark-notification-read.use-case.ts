// Cas d'usage : marque une notification précise comme lue.
import type { Notification } from "../../entities/notification.entity.js";
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

/**
 * Factory du cas d'usage « marquer comme lu ».
 * @param id identifiant de la notification à marquer
 * @returns la notification mise à jour, ou null si aucune notification ne porte cet id
 */
export const markNotificationReadUseCase = (notificationRepository: INotificationRepository) => {
  return async (id: string): Promise<Notification | null> => {
    return await notificationRepository.markNotificationRead(id);
  };
};
