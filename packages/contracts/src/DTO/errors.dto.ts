import { z } from "../zod";

/**
 * DTO (schémas zod) des corps d'erreur partagés par les contrats ts-rest.
 *
 * Chaque schéma est un simple objet `{ message }` associé à un statut HTTP standard
 * (404, 400, 502) et sert de forme de réponse pour les branches d'erreur des routes.
 */

// Corps d'erreur 404 : ressource introuvable.
export const NotFoundErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi({ title: "NotFoundError", description: "Resource not found error" });
export type NotFoundError = z.infer<typeof NotFoundErrorSchema>;

// Corps d'erreur 400 : requête invalide (ex. solde de points insuffisant).
export const BadRequestErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi({ title: "BadRequestError", description: "Invalid request (e.g. insufficient balance)" });
export type BadRequestError = z.infer<typeof BadRequestErrorSchema>;

// Corps d'erreur 502 : une dépendance en amont a échoué (ex. le service de signature électronique).
export const BadGatewayErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi({
    title: "BadGatewayError",
    description: "An upstream dependency failed (e.g. the e-signature service)",
  });
export type BadGatewayError = z.infer<typeof BadGatewayErrorSchema>;
