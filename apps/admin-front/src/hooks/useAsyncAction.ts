// Hook : encapsule une action asynchrone ponctuelle avec un état d'occupation + d'erreur.
import { useCallback, useState } from "react";

// Extrait un message d'erreur lisible : d'abord le message renvoyé par l'api (response.data.message),
// sinon le message natif de l'erreur, sinon un texte générique.
function extractError(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message ?? e?.message ?? "Something went wrong";
}

/**
 * Encapsule une action asynchrone ponctuelle (suppression, sauvegarde) avec un état `busy` et
 * `error`, pour que les appelants cessent d'avaler les échecs silencieusement.
 * `run(fn)` renvoie true en cas de succès, false en cas d'échec (l'erreur est alors exposée via `error`).
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(extractError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  // Efface l'erreur courante (ex. quand l'utilisateur relance ou ferme la modale).
  const reset = useCallback(() => setError(null), []);

  return { busy, error, run, reset };
}
