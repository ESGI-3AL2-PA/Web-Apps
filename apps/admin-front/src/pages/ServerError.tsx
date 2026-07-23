// Page 500 plein écran, également utilisée comme errorElement du router. Autonome (aucune
// dépendance à l'api ni au router) afin de s'afficher même quand une route plante ou que l'api
// est indisponible. N'expose jamais l'erreur/la stack brute — celle-ci reste dans la console.
//
// Props : `onRetry` action de réessai (défaut : recharger la page), `retrying` indicateur d'état
// en cours pour désactiver le bouton et montrer le spinner.
export default function ServerError({ onRetry, retrying }: { onRetry?: () => void; retrying?: boolean }) {
  // À défaut de callback fourni, on recharge simplement la page.
  const handleClick = onRetry ?? (() => window.location.reload());
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base-100 p-6 text-center">
      <p className="text-6xl font-black text-error">500</p>
      <h1 className="text-2xl font-extrabold text-base-content">Something went wrong</h1>
      <p className="max-w-sm text-base-content/60">An unexpected error occurred. Try reloading the page.</p>
      <button onClick={handleClick} disabled={retrying} className="btn btn-primary mt-2">
        {retrying && <span className="loading loading-spinner loading-sm" />}
        {retrying ? "Retrying…" : "Reload"}
      </button>
    </div>
  );
}
