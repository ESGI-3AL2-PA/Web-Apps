// Cas d'usage : marque comme lues toutes les notifications d'un destinataire.
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

/**
 * Factory du cas d'usage « tout marquer comme lu ».
 * @param recipientId destinataire dont on marque toutes les notifications comme lues
 * @returns le nombre de notifications effectivement mises à jour
 */
export const markAllNotificationsReadUseCase = (notificationRepository: INotificationRepository) => {
  return async (recipientId: string): Promise<number> => {
    return await notificationRepository.markAllRead(recipientId);
  };
};
