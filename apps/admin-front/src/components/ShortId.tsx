// Composant : affiche un identifiant tronqué, la valeur complète restant lisible au survol.

/**
 * Rend un id tronqué (8 premiers caractères + "…" au-delà de 10) avec la valeur
 * intégrale exposée via `title` au survol, pour qu'elle reste récupérable.
 * Rend un tiret cadratin si la valeur est absente.
 */
export function ShortId({ value }: { value?: string | null }) {
  if (!value) return <>—</>;
  const short = value.length > 10 ? `${value.slice(0, 8)}…` : value;
  return (
    <span title={value} className="font-mono text-xs">
      {short}
    </span>
  );
}
