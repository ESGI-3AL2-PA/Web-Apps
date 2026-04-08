import { type GeoJson } from "@repo/contracts";
import axios from "axios";

export const getCoordinatesFromAddress = async (address: string): Promise<GeoJson> => {
  const res = await axios.get(`https://data.geopf.fr/geocodage/search?q=${address}`);
  return res.data.features[0].geometry as GeoJson;
};
