// Point d'entrée de la landing : monte le composant App dans le DOM (#app).
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// StrictMode : vérifications de développement React (effets doublés en dev).
ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
