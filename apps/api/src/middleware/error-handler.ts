// Middleware — gestion d'erreurs. AppError / NotFoundError / errorHandler sont partagés (voir
// @repo/shared). Réexportés ici (identité de classe unique sur les deux backends) pour que les
// chemins d'import locaux restent stables.
import { AppError } from "@repo/shared";

export { AppError, NotFoundError, errorHandler } from "@repo/shared";

// Levée quand les octets média d'un message ont été stockés mais que la mediaUrl n'a pas pu être
// attachée à la ligne. Le cas d'usage compense (supprime octets + ligne) avant de lever cette
// erreur pour ne laisser aucun orphelin. Spécifique à l'app — étend la base partagée.
export class ImageAttachError extends AppError {
  constructor() {
    super(500, "Failed to attach image to message");
  }
}
