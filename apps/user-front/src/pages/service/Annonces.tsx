import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { getAllAnnonces, type ListingFilters } from "../../api-service/api";
import type { ListingResponseDto } from "../../type/annonce";
import type { ServiceOutletContext } from "./Service";

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

    return (
        <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>Liste des annonces</h1>

            {data.length === 0 ? (
                <p>Aucune annonce ne correspond à votre recherche.</p>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 16,
                }}>
                    {data.map((annonce) => (
                        <div
                            key={annonce.id}
                            style={{
                                background: "#fff",
                                borderRadius: 10,
                                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                                padding: 14,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                border: "1px solid #eee",
                            }}
                        >
                            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#6366f1", margin: 0 }}>{annonce.title}</h2>
                            <p style={{ color: "#444", margin: 0, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {annonce.description}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                                <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
                                    <strong>Prix:</strong> {annonce.price} €
                                </span>
                                <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
                                    {annonce.type}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Annonces;
