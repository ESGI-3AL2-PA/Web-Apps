import { z } from "../zod";

/**
 * DTO (schémas zod) GeoJSON pour les frontières de quartier.
 *
 * Deux schémas de granularité différente :
 * - `GeoJsonSchema` : forme LÂCHE pour les réponses (données stockées de confiance) ;
 * - `GeoJsonInputSchema` : forme STRICTE pour les corps de requête, validant Polygon/MultiPolygon
 *   (positions dans les bornes, anneaux fermés) afin de rejeter une frontière invalide avec un 400
 *   plutôt que de laisser l'index 2dsphere de Mongo planter en 500.
 */

// Forme lâche pour les RÉPONSES — les coordonnées s'imbriquent différemment selon le type de
// géométrie et la donnée stockée est de confiance : laissée non typée plutôt que forcée à une forme stricte.
export const GeoJsonSchema = z
  .object({
    type: z.string().openapi({ description: "GeoJSON geometry type", example: "Polygon" }),
    coordinates: z.array(z.unknown()).openapi({ description: "GeoJSON coordinates (shape depends on geometry type)" }),
  })
  .openapi("GeoJson");
export type GeoJson = z.infer<typeof GeoJsonSchema>;

// Une position GeoJSON : [lng, lat] (valeurs d'altitude supplémentaires tolérées) dans les bornes valides.
const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).rest(z.number());

// Un anneau linéaire : au moins 4 positions et fermé (première === dernière), conformément à la
// spec GeoJSON et à l'index 2dsphere de Mongo — qui lève sinon un 500 sur un anneau malformé.
const LinearRing = z
  .array(Position)
  .min(4, "A polygon ring needs at least 4 positions (closed)")
  .refine((ring) => {
    // Vérifie la fermeture de l'anneau : la dernière position doit être identique à la première.
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first[0] === last[0] && first[1] === last[1];
  }, "A polygon ring must be closed (first and last position identical)");

const PolygonCoordinates = z.array(LinearRing).min(1);

// Forme stricte pour les CORPS de requête (création/mise à jour de quartier) : valider Polygon et
// MultiPolygon en amont afin qu'une frontière incorrecte soit rejetée en 400 au lieu de faire planter
// l'index 2dsphere en 500.
export const GeoJsonInputSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: PolygonCoordinates }),
    z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(PolygonCoordinates).min(1) }),
  ])
  .openapi("GeoJsonInput");
export type GeoJsonInput = z.infer<typeof GeoJsonInputSchema>;
