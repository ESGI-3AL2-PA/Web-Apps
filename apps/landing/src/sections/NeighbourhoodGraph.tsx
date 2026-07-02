import { useEffect, useState } from "react";

// Signature element: a stylised district — neighbours (nodes) linked by
// exchanges (edges), with points travelling along them. It literally draws the
// social graph that ranks each resident's feed.

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

const HUB = { x: 200, y: 165 };
const NODES = [
  { x: 66, y: 66 },
  { x: 334, y: 78 },
  { x: 356, y: 214 },
  { x: 196, y: 292 },
  { x: 52, y: 214 },
];
// Edges as [from, to] point pairs; the hub links to everyone, plus a couple of
// neighbour-to-neighbour ties for texture.
const EDGES = [
  [HUB, NODES[0]],
  [HUB, NODES[1]],
  [HUB, NODES[2]],
  [HUB, NODES[3]],
  [HUB, NODES[4]],
  [NODES[0], NODES[1]],
  [NODES[2], NODES[3]],
];
// Which edges carry a travelling point, and when each starts.
const TOKENS = [
  { from: NODES[0], to: HUB, begin: "0s" },
  { from: HUB, to: NODES[2], begin: "1.1s" },
  { from: NODES[3], to: NODES[4] ?? HUB, begin: "2.2s" },
];

const NeighbourhoodGraph = ({ label }: { label: string }) => {
  const reduced = useReducedMotion();

  return (
    <svg
      viewBox="0 0 400 340"
      className="h-full w-full"
      role="img"
      aria-label="A small map of neighbours connected by service exchanges"
    >
      {EDGES.map(([a, b], i) => (
        <line
          key={i}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#6366f1"
          strokeOpacity={0.28}
          strokeWidth={1.5}
          className={reduced ? undefined : "graph-edge"}
        />
      ))}

      {!reduced &&
        TOKENS.map((tk, i) => (
          <circle key={`t${i}`} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5}>
            <animateMotion
              dur="3.2s"
              begin={tk.begin}
              repeatCount="indefinite"
              path={`M${tk.from.x},${tk.from.y} L${tk.to.x},${tk.to.y}`}
            />
          </circle>
        ))}

      {NODES.map((n, i) => (
        <g key={`n${i}`} className={reduced ? undefined : "graph-node"} style={{ animationDelay: `${i * 0.5}s` }}>
          <circle cx={n.x} cy={n.y} r={12} fill="#ffffff" stroke="#6366f1" strokeOpacity={0.5} strokeWidth={2} />
          <circle cx={n.x} cy={n.y} r={4} fill="#6366f1" fillOpacity={0.7} />
        </g>
      ))}

      {/* Hub — "you", at the centre of your district */}
      <g>
        <circle cx={HUB.x} cy={HUB.y} r={22} fill="#6366f1" fillOpacity={0.12} />
        <circle cx={HUB.x} cy={HUB.y} r={15} fill="#6366f1" />
        <circle cx={HUB.x} cy={HUB.y} r={5} fill="#ffffff" />
        <text
          x={HUB.x}
          y={HUB.y + 42}
          textAnchor="middle"
          fill="#1c1b2e"
          fontFamily="Space Mono, monospace"
          fontSize={12}
          fontWeight={700}
        >
          {label}
        </text>
      </g>
    </svg>
  );
};

export default NeighbourhoodGraph;
