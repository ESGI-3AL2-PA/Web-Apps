import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import MainLayout from "../layouts/MainLayouts";
import ServicePage from "../pages/service/Service";
import EvenementPage from "../pages/Evenement";
import VotesPage from "../pages/Votes";
import Annonces from "../pages/service/Annonces";
import AnnoncesUser from "../pages/service/AnnoncesUser";
import Contrat from "../pages/service/Contrat";
import DashBoard from "../pages/dashboard/DashBoard";
import NotFound from "../pages/NotFound";

export const router = createBrowserRouter([
  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    errorElement: <NotFound />,
    children: [
      { path: "/", element: <DashBoard /> },
      {
        path: "/service",
        element: <ServicePage />,
        children: [
          { index: true, element: <Navigate to="annonces" replace /> },
          { path: "annonces", element: <Annonces /> },
          { path: "mes-annonces", element: <AnnoncesUser /> },
          { path: "mes-contrats", element: <Contrat /> },
        ],
      },
      { path: "/evenement", element: <EvenementPage /> },
      { path: "/votes", element: <VotesPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
