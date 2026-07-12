import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import MainLayout from "../layouts/MainLayouts";
import ServiceLayout from "../pages/service/ServiceLayout";
import EvenementPage from "../pages/Evenement";
import MessageriePage from "../pages/Messagerie";
import Annonces from "../pages/service/Annonces";
import AnnoncesUser from "../pages/service/AnnoncesUser";
import Contrat from "../pages/service/Contrat";
import DashBoard from "../pages/dashboard/DashBoard";
import CreateService from "../pages/service/CreateService";
import Votes from "../pages/Votes";
import Profile from "../pages/Profile";

export const router = createBrowserRouter([
  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "/", element: <DashBoard /> },
      {
        path: "/service",
        element: <ServiceLayout />,
        children: [
          { index: true, element: <Navigate to="annonces" replace /> },
          { path: "annonces", element: <Annonces /> },
          { path: "mes-annonces", element: <AnnoncesUser /> },
          { path: "mes-contrats", element: <Contrat /> },
        ],
      },
      { path: "/creationService", element: <CreateService /> },
      { path: "/evenement", element: <EvenementPage /> },
      { path: "/messagerie", element: <MessageriePage /> },
      { path: "/votes", element: <Votes /> },
      { path: "/profile", element: <Profile /> },
    ],
  },
]);
