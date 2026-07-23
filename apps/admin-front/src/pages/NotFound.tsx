// Page 404 : affichée pour toute route inconnue, avec un lien de retour au tableau de bord.
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-black text-primary">404</p>
      <h1 className="text-2xl font-extrabold text-base-content">Page not found</h1>
      <p className="max-w-sm text-base-content/60">This page does not exist or has moved.</p>
      <Link to="/" className="btn btn-primary mt-2">
        Back to dashboard
      </Link>
    </div>
  );
}
