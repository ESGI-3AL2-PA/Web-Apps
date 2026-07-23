/**
 * Point d'entrée du user-front.
 *
 * Monte l'application React dans `#app` : StrictMode > Providers globaux
 * (auth, socket, thème…) > routeur react-router.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import Providers from "./app/providers";
import { router } from "./app/router";
import "./i18n"; // initialise i18next (fr/en) avant le premier rendu

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>,
);
