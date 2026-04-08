
import { useEffect, useState } from "react";
import { getAllAnnonces } from "../../api-service/api";
import type { ListingResponseDto } from "../../type/annonce";

const Annonces = () => {
    const [data, setData] = useState<ListingResponseDto[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnnonces = async () => {
            try {
                const result = await getAllAnnonces();
                setData(result);
            } catch {
                setError("Impossible de charger les annonces");
            } finally {
                setLoading(false);
            }
        };

        fetchAnnonces();
    }, []);

    if (loading) {
        return <div>Chargement des annonces...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div>
            <h1>Liste des annonces</h1>

            {data.length === 0 ? (
                <p>Aucune annonce disponible.</p>
            ) : (
                data.map((annonce) => (
                    <article key={annonce.id}>
                        <h2>{annonce.title}</h2>
                        <p>{annonce.description}</p>
                        <p>ID: {annonce.id}</p>
                        <p>Prix: {annonce.price} EUR</p>
                        <p>Type: {annonce.type}</p>
                        <p>Statut: {annonce.status}</p>
                    </article>
                ))
            )}
        </div>
    );
};

export default Annonces;