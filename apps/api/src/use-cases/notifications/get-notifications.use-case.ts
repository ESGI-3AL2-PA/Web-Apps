// Cas d'usage : liste paginée et filtrée des notifications.
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

/**
 * Factory du cas d'usage de récupération des notifications.
 * Tous les filtres sont optionnels : destinataire, quartier, type, statut lu/non lu,
 * plus la pagination (page / limit). Le repository applique le filtrage et la pagination.
 */
export const getNotificationsUseCase = (notificationRepository: INotificationRepository) => {
  return async (params: {
    recipientId?: string;
    districtId?: string;
    type?: string;
    read?: boolean;
    page?: number;
    limit?: number;
  }) => {
    return await notificationRepository.getNotifications(params);
  };
};
