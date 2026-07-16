// Full-screen 500 page, also the router's errorElement. Self-contained (no api or
// router dependencies) so it renders even when a route crashes or the api is down.
// Never surfaces the raw error/stack — that stays in the console.
export default function ServerError({ onRetry, retrying }: { onRetry?: () => void; retrying?: boolean }) {
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
