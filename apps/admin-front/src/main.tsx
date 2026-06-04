import { createRoot } from "react-dom/client";
import { AuthProvider, ProtectedRoute } from "@repo/hooks";
import { config } from "@repo/config";
import "./style.css";
import typescriptLogo from "/typescript.svg";
import { Header, Counter } from "@repo/ui";

const AUTH_SERVICE_URL = config.authServiceUrl;

const App = () => (
  <AuthProvider authServiceUrl={AUTH_SERVICE_URL}>
    <ProtectedRoute roles={["admin", "superAdmin"]}>
      <div>
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://www.typescriptlang.org/" target="_blank" rel="noreferrer">
          <img src={typescriptLogo} className="logo vanilla" alt="TypeScript logo" />
        </a>
        <Header title="Web" />
        <div className="card">
          <Counter />
        </div>
      </div>
    </ProtectedRoute>
  </AuthProvider>
);

createRoot(document.getElementById("app")!).render(<App />);
