// Composant : garde-fou React de dernier recours pour toute l'admin-front.
// Capture les exceptions levées pendant le rendu de l'arbre enfant et affiche
// un écran de secours récupérable plutôt qu'une page blanche.
import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

interface State {
  error: Error | null;
}

/**
 * Error boundary de dernier recours : une exception au rendu affiche un écran
 * récupérable (message + bouton de rechargement) au lieu d'une page blanche.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  // Bascule l'état vers l'écran de secours dès qu'un enfant lève au rendu.
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  // Effet de bord : journalise l'erreur + la pile de composants (non affiché à l'utilisateur).
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Admin UI crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="icon-[tabler--alert-triangle] size-10 text-error" />
          <div>
            <h1 className="text-xl font-semibold">{i18n.t("common.errorBoundaryTitle")}</h1>
            <p className="text-sm text-base-content/60 mt-1">{this.state.error.message}</p>
          </div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {i18n.t("common.actions.reload")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
