import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import Providers from "./app/providers";
import { router } from "./app/router";
import "./i18n"; // initialise i18next (fr/en) before first render

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>,
);
