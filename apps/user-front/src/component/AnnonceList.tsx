import type { ListingResponseDto } from "@repo/contracts";
import CarteService from "./CarteService";

type AnnonceListProps = {
  annonces: ListingResponseDto[];
  title?: string;
  /** Callback déclenché après une update/delete/take depuis CarteService. */
  onChanged?: () => void;
};

// Toutes les listes (Annonces du quartier ET Mes annonces) rendent désormais
// `CarteService`. Le composant détecte lui-même si l'annonce appartient au
// user connecté pour afficher les bons boutons (Modifier/Supprimer vs Prendre).
const AnnonceList = ({ annonces, title = "liste des annonces", onChanged }: AnnonceListProps) => {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>{title}</h1>

      {annonces.length === 0 ? (
        <p>Aucune annonce ne correspond à votre recherche.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {annonces.map((annonce) => (
            <CarteService key={annonce.id} annonce={annonce} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnonceList;
