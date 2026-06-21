import type { ListingResponseDto } from "@repo/contracts";
import AnnoncesCard from "./AnnoncesCard";
import CarteService from "./CarteService";

type AnnonceListProps = {
  annonces: ListingResponseDto[];
  title?: string;
  /** Si true, les cartes deviennent interactives (modale + Modifier/Supprimer). */
  editable?: boolean;
  /** Callback déclenché après une update/delete réussie depuis CarteService. */
  onChanged?: () => void;
};

const AnnonceList = ({
  annonces,
  title = "liste des annonces",
  editable = false,
  onChanged,
}: AnnonceListProps) => {
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
          {annonces.map((annonce) =>
            editable ? (
              <CarteService
                key={annonce.id}
                annonce={annonce}
                editable
                onChanged={onChanged}
              />
            ) : (
              <AnnoncesCard key={annonce.id} annonce={annonce} />
            ),
          )}
        </div>
      )}
    </div>
  );
};

export default AnnonceList;
