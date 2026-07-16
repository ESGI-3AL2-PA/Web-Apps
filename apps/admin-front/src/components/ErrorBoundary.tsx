import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

interface State {
  error: Error | null;
}

// Last-resort boundary: a render throw shows a recoverable screen instead of a white page.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

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
