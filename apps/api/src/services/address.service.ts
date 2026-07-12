import { type GeoJson } from "@repo/contracts";
import axios from "axios";

export const getCoordinatesFromAddress = async (address: string): Promise<GeoJson> => {
  const res = await axios.get("https://data.geopf.fr/geocodage/search", {
    params: { q: address },
    timeout: 5000,
  });
  return res.data.features[0].geometry as GeoJson;
};
