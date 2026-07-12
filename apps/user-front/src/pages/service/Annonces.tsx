import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { ListingQueryDto, ListingResponseDto } from "@repo/contracts";
import { getListings } from "../../api-service/listings.service";
import type { ServiceOutletContext } from "./ServiceLayout";
import AnnonceList from "../../component/AnnonceList";

const Annonces = () => {
  const { selectedTag } = useOutletContext<ServiceOutletContext>();

  const [data, setData] = useState<ListingResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnonces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ListingQueryDto accepte désormais `tag` (filtre par nom de tag — match
      // automatique sur l'array `tags` côté Mongo).
      const filters: ListingQueryDto = {} as ListingQueryDto;
      if (selectedTag) filters.tag = selectedTag;

      const result = await getListings(filters);
      setData(result.data);
    } catch {
      setError("Impossible de charger les annonces");
    } finally {
      setLoading(false);
    }
  }, [selectedTag]);

  useEffect(() => {
    fetchAnnonces();
  }, [fetchAnnonces]);

  if (loading) return <div>Chargement des annonces...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return <AnnonceList annonces={data} title="Listes des annonces" onChanged={fetchAnnonces} />;
};

export default Annonces;
