// Cas d'usage : supprime une notification par son id.
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

/**
 * Factory du cas d'usage de suppression de notification.
 * @returns une fonction qui supprime la notification et renvoie true si une ligne a été supprimée
 */
export const deleteNotificationUseCase = (notificationRepository: INotificationRepository) => {
  return async (params: { id: string }): Promise<boolean> => {
    return await notificationRepository.deleteNotification(params.id);
  };
};
