import type { VoteResponseDto } from "@repo/contracts";
import CarteVote from "./CarteVote";

type VoteListProps = {
  votes: VoteResponseDto[];
  title?: string;
  onChanged?: () => void;
};

const VoteList = ({ votes, title = "Votes", onChanged }: VoteListProps) => {
  return (
    <div>
      {title && <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{title}</h2>}

      {votes.length === 0 ? (
        <p style={{ color: "#666" }}>Aucun vote à afficher.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {votes.map((v) => (
            <CarteVote key={v.id} vote={v} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
};

export default VoteList;
