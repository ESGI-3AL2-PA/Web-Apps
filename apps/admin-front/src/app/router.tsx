// Définition du routeur react-router de la console admin : arbre de routes protégées, cadrées par quartier.
import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import { DistrictScopeProvider } from "./DistrictScopeProvider";
import AdminLayout from "../layouts/AdminLayout";
import NotFound from "../pages/NotFound";
import ServerError from "../pages/ServerError";

// Les composants de page sont découpés en chunks (code splitting) : chacun est chargé à la
// navigation, ce qui garde le bundle initial léger.
const Dashboard = lazy(() => import("../pages/dashboard/Dashboard"));
const UsersList = lazy(() => import("../pages/users/UsersList"));
const DistrictPage = lazy(() => import("../pages/districts/DistrictPage"));
const DistrictAdminsList = lazy(() => import("../pages/district-admins/DistrictAdminsList"));
const TagsList = lazy(() => import("../pages/tags/TagsList"));
const IncidentsList = lazy(() => import("../pages/incidents/IncidentsList"));
const ListingsList = lazy(() => import("../pages/listings/ListingsList"));
const DisputesList = lazy(() => import("../pages/disputes/DisputesList"));
const EventsList = lazy(() => import("../pages/events/EventsList"));
const VotesList = lazy(() => import("../pages/votes/VotesList"));
const ClientDownload = lazy(() => import("../pages/client-download/ClientDownload"));
const SecurityPage = lazy(() => import("../pages/account/SecurityPage"));

export const router = createBrowserRouter([
  {
    // Racine : réservée aux admin / superAdmin (ProtectedRoute), puis cadrée par quartier
    // (DistrictScopeProvider) et habillée par le layout admin partagé.
    element: (
      <ProtectedRoute roles={["admin", "superAdmin"]}>
        <DistrictScopeProvider>
          <AdminLayout />
        </DistrictScopeProvider>
      </ProtectedRoute>
    ),
    // Page 500 thématisée pour les vraies erreurs de loader/rendu (le 404 fourre-tout est NotFound plus bas).
    errorElement: <ServerError />,
    // `handle.title` porte la clé i18n du titre de page, lue par le layout pour la barre supérieure.
    children: [
      { path: "/", element: <Dashboard />, handle: { title: "nav.dashboard" } },
      { path: "/users", element: <UsersList />, handle: { title: "nav.users" } },
      { path: "/districts", element: <DistrictPage />, handle: { title: "nav.districts" } },
      { path: "/district-admins", element: <DistrictAdminsList />, handle: { title: "nav.districtAdmins" } },
      { path: "/tags", element: <TagsList />, handle: { title: "nav.tags" } },
      { path: "/incidents", element: <IncidentsList />, handle: { title: "nav.incidents" } },
      { path: "/listings", element: <ListingsList />, handle: { title: "nav.listings" } },
      { path: "/disputes", element: <DisputesList />, handle: { title: "nav.disputes" } },
      { path: "/events", element: <EventsList />, handle: { title: "nav.events" } },
      { path: "/votes", element: <VotesList />, handle: { title: "nav.votes" } },
      { path: "/client", element: <ClientDownload />, handle: { title: "nav.client" } },
      { path: "/security", element: <SecurityPage />, handle: { title: "nav.security" } },
      // Fourre-tout : toute route non reconnue rend le 404.
      { path: "*", element: <NotFound /> },
    ],
  },
]);
