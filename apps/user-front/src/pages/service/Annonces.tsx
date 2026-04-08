
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

    console.log("data : ", data);

    return (
        <div>
            <h1>Liste des annonces</h1>

            <div className="mt-5 card sm:max-w-sm bg-blc p-3">
                {data.length === 0 ? (
                    <p>Aucune annonce disponible.</p>
                ) : (
                    data.map((annonce) => (
                        <article key={annonce.id}>
                            <div className="flex gap-15 px-5">
                                <div className="avatar">
                                    <div className="size-8 rounded-full text-white bg-secondary text-center">1</div>
                                </div>
                                <h2 className="bg-primary">{annonce.title}</h2>
                            </div>
                            <p>{annonce.description}</p>
                            <p>Prix: {annonce.price} EUR</p>
                            <p>Type: {annonce.type}</p>
                            <p>Statut: {annonce.status}</p>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
};

export default Annonces;