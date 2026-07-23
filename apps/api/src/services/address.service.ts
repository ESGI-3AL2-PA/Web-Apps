// Service (couche services) : géocodage d'adresses via l'API publique de la Géoplateforme
// (IGN, data.geopf.fr). Convertit une adresse textuelle en géométrie GeoJSON exploitable
// par les vérifications de périmètre de quartier et le stockage Mongo géo-indexé.
import { type GeoJson } from "@repo/contracts";
import axios from "axios";

/**
 * Géocode une adresse et renvoie la géométrie GeoJSON du meilleur résultat.
 * Timeout à 5 s pour ne pas bloquer la requête si l'API IGN est lente.
 * @throws si aucun résultat n'est trouvé (accès à `features[0]` sur un tableau vide).
 */
export const getCoordinatesFromAddress = async (address: string): Promise<GeoJson> => {
  const res = await axios.get("https://data.geopf.fr/geocodage/search", {
    params: { q: address },
    timeout: 5000,
  });
  return res.data.features[0].geometry as GeoJson;
};
