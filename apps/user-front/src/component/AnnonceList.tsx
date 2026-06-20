import type { ListingResponseDto } from "@repo/contracts";
import AnnoncesCard from "./AnnoncesCard";

type AnnonceListProps = {
  annonces: ListingResponseDto[];
  title?: string;
};

const AnnonceList = ({ annonces, title = "liste des annonces" }: AnnonceListProps) => {
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
            <AnnoncesCard key={annonce.id} annonce={annonce} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnonceList;
