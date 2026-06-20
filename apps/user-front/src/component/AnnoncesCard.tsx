import type { ListingResponseDto } from "@repo/contracts";

type AnnonceCardProps = {
  annonce: ListingResponseDto;
};

const AnnoncesCard = ({ annonce }: AnnonceCardProps) => {
  return (
    <div
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
      <p
        style={{
          color: "#444",
          margin: 0,
          fontSize: 13,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {annonce.description}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
          <strong>Prix:</strong> {annonce.price} €
        </span>
        <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>{annonce.type}</span>
      </div>
    </div>
  );
};

export default AnnoncesCard;
