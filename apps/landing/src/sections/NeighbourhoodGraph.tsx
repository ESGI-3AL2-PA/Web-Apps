/**
 * Graphe de quartier animé — l'élément signature de la landing.
 *
 * Dessine un quartier stylisé : des voisins (nœuds) reliés par des échanges
 * (arêtes), avec des points qui circulent le long des arêtes. C'est la
 * représentation littérale du graphe social qui classe le fil de chaque
 * résident. Toute l'animation est désactivée si l'utilisateur a demandé une
 * réduction des animations (`prefers-reduced-motion`).
 */
import { useEffect, useState } from "react";

/**
 * Hook renvoyant `true` si l'utilisateur a activé la préférence système
 * « réduire les animations ». Se met à jour en direct via un écouteur sur la
 * media query.
 */
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

// Centre du graphe (« vous »), en coordonnées du viewBox 400×340.
const HUB = { x: 200, y: 165 };
// Voisins disposés en cercle autour du hub.
const NODES = [
  { x: 66, y: 66 },
  { x: 334, y: 78 },
  { x: 356, y: 214 },
  { x: 196, y: 292 },
  { x: 52, y: 214 },
];
// Arêtes sous forme de paires de points [depuis, vers] : le hub est relié à
// tout le monde, plus quelques liens voisin-à-voisin pour donner de la texture.
const EDGES = [
  [HUB, NODES[0]],
  [HUB, NODES[1]],
  [HUB, NODES[2]],
  [HUB, NODES[3]],
  [HUB, NODES[4]],
  [NODES[0], NODES[1]],
  [NODES[2], NODES[3]],
];
// Points en déplacement : sur quelle arête chacun circule et à quel instant il
// démarre (décalé pour ne pas tous partir en même temps).
const TOKENS = [
  { from: NODES[0], to: HUB, begin: "0s" },
  { from: HUB, to: NODES[2], begin: "1.1s" },
  { from: NODES[3], to: NODES[4] ?? HUB, begin: "2.2s" },
];

/**
 * Rend le graphe SVG animé du quartier.
 *
 * @param label - texte affiché sous le hub central (p. ex. le mot « vous »
 *   traduit). Quand les animations sont réduites, arêtes en pointillés animés,
 *   points en circulation et pulsation des nœuds sont omis, le graphe restant
 *   entièrement lisible en version statique.
 */
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

      {/* Points « points » circulant le long des arêtes, via `animateMotion` sur
          un chemin droit reliant les deux extrémités de l'arête. */}
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

      {/* Hub — « vous », au centre de votre quartier. */}
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
