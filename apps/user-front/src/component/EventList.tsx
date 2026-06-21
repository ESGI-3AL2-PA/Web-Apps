import type { EventResponseDto } from "@repo/contracts";
import CarteEvent from "./CarteEvent";

type EventListProps = {
  events: EventResponseDto[];
  title?: string;
  onChanged?: () => void;
};

const EventList = ({ events, title = "Événements", onChanged }: EventListProps) => {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{title}</h2>

      {events.length === 0 ? (
        <p style={{ color: "#666" }}>Aucun événement à afficher.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {events.map((evt) => (
            <CarteEvent key={evt.id} event={evt} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EventList;
