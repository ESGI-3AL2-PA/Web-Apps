// Cas d'usage : crée une notification. Fine couche pass-through au-dessus du
// repository ; le districtId (quartier) est injecté par le router à partir du scope.
import type { CreateNotificationDto } from "@repo/contracts";
import type { Notification } from "../../entities/notification.entity.js";
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";

/**
 * Factory du cas d'usage de création de notification.
 * @param notificationRepository repository des notifications
 * @returns une fonction qui persiste la notification et renvoie l'entité créée
 */
export const createNotificationUseCase = (notificationRepository: INotificationRepository) => {
  return async (data: CreateNotificationDto & { districtId: string }): Promise<Notification> => {
    return await notificationRepository.createNotification(data);
  };
};
