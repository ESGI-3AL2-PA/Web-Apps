import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@repo/hooks";
import { config } from "@repo/config";
import Providers from "./app/providers";
import { router } from "./app/router";

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <AuthProvider authServiceUrl={config.authServiceUrl}>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </AuthProvider>
  </React.StrictMode>,
);
