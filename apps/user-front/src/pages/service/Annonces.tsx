import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { getAllAnnonces, type ListingFilters } from "../../api-service/api";
import type { ListingResponseDto } from "../../type/annonce";
import type { ServiceOutletContext } from "./Service";
import AnnonceList from "../../component/AnnonceList";

const Annonces = () => {
  const { selectedType } = useOutletContext<ServiceOutletContext>();

  const [data, setData] = useState<ListingResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnonces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ListingFilters = {};
      if (selectedType) filters.type = selectedType;

      const result = await getAllAnnonces(filters);
      setData(result);
    } catch {
      setError("Impossible de charger les annonces");
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    fetchAnnonces();
  }, [fetchAnnonces]);

  if (loading) return <div>Chargement des annonces...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return <AnnonceList annonces={data} title="Listes des annonces" />;
};

export default Annonces;
