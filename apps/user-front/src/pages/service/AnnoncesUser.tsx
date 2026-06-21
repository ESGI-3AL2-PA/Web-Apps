import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "@repo/hooks";
import type { ListingQueryDto, ListingResponseDto } from "@repo/contracts";
import { getListings } from "../../api-service/listings.service";
import type { ServiceOutletContext } from "./Service";
import AnnonceList from "../../component/AnnonceList";

// "Mes annonces" — filtre les annonces du user connecté, avec possibilité de
// raffiner via le tag sélectionné dans la sidebar (FilterBar du parent Service).
// Les cartes sont éditables : modifier / supprimer ouvre une modale.
const AnnoncesUser = () => {
  const { selectedTag } = useOutletContext<ServiceOutletContext>();
  const { user } = useAuth();

  const [data, setData] = useState<ListingResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyAnnonces = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const filters: ListingQueryDto = { authorId: user.id } as ListingQueryDto;
      if (selectedTag) filters.tag = selectedTag;

      const res = await getListings(filters);
      setData(res.data);
    } catch {
      setError("Impossible de charger vos annonces");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, selectedTag]);

  useEffect(() => {
    fetchMyAnnonces();
  }, [fetchMyAnnonces]);

  if (!user?.id) return <div>Connexion requise.</div>;
  if (isLoading) return <div>Chargement des annonces...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <AnnonceList
      annonces={data}
      title="Mes annonces"
      editable
      onChanged={fetchMyAnnonces}
    />
  );
};

export default AnnoncesUser;
