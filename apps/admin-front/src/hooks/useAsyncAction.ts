import { useCallback, useState } from "react";

function extractError(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message ?? e?.message ?? "Something went wrong";
}

// Wraps a one-shot async action (delete, save) with busy + error state so callers stop
// swallowing failures. `run` returns true on success, false on failure (error is surfaced).
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

  const reset = useCallback(() => setError(null), []);

  return { busy, error, run, reset };
}
