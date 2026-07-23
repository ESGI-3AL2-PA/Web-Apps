// Paire de boutons d'appel à l'action (inscription + connexion) de la landing.
import { loginUrl, registerUrl } from "../auth-links";

/**
 * Props d'AuthButtons.
 * - primaryLabel / secondaryLabel : libellés des boutons inscription / connexion.
 * - size : taille du padding (« md » compact, « lg » proéminent, ex. bloc CTA).
 * - tone : adapte le style du bouton secondaire selon le fond (clair / sombre).
 */
interface AuthButtonsProps {
  primaryLabel: string;
  secondaryLabel: string;
  size?: "md" | "lg";
  tone?: "light" | "dark";
}

// Liens en navigation complète (pas SPA) vers les pages login/register de l'auth-service.
const AuthButtons = ({ primaryLabel, secondaryLabel, size = "md", tone = "light" }: AuthButtonsProps) => {
  // Padding selon la taille demandée.
  const pad = size === "lg" ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm";
  // Bordure/texte du bouton secondaire adaptés au fond (sombre vs clair).
  const secondary =
    tone === "dark"
      ? "border-blc/25 text-blc hover:border-blc/60 focus-visible:outline-blc"
      : "border-ink/15 text-ink hover:border-ink/40 focus-visible:outline-ink";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={registerUrl}
        className={`inline-flex items-center gap-2 rounded-full bg-primary font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${pad}`}
      >
        {primaryLabel}
        <span aria-hidden="true">→</span>
      </a>
      <a
        href={loginUrl}
        className={`inline-flex items-center rounded-full border font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${secondary} ${pad}`}
      >
        {secondaryLabel}
      </a>
    </div>
  );
};

export default AuthButtons;
