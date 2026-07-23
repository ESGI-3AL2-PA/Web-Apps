// Point d'entrée de l'admin-front : monte l'arbre React (ErrorBoundary > Providers > Router).
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./i18n"; // initialise i18next (fr/en) avant le premier render
import { router } from "./app/router";
import Providers from "./app/providers";
import { ErrorBoundary } from "./components/ErrorBoundary";

// `!` : l'élément #app est garanti présent dans index.html.
ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  </React.StrictMode>,
);
