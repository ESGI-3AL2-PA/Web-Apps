import { useEffect, useState, useCallback } from "react";
import type { ListingResponseDto } from "../../type/annonce";
import { getListingsById } from "../../api-service/api";
import { useAuth } from "@repo/hooks";
import AnnonceList from "../../component/AnnonceList";

const AnnoncesUser = () => {
  const [data, setData] = useState<ListingResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>();
  const userAuth = useAuth();

  useEffect(() => {
    const user = userAuth.user;

    if (!user?.id) return;

    const fetchMyAnnonces = async () => {
      setIsLoading(true);
      try {
        const res = await getListingsById(user?.id);

        setData(res);
      } catch (error) {
        setError("Impossible de charger les données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyAnnonces();
  }, []);

  if (isLoading) return <div>Chargement des annonces...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return <AnnonceList annonces={data} title="Mes annonces" />;
};

export default AnnoncesUser;
