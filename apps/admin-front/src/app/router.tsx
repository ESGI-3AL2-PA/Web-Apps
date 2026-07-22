import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import { DistrictScopeProvider } from "./DistrictScopeProvider";
import AdminLayout from "../layouts/AdminLayout";
import NotFound from "../pages/NotFound";
import ServerError from "../pages/ServerError";

// Route components are code-split: each becomes its own chunk fetched on
// navigation, keeping the initial bundle small.
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

export const router = createBrowserRouter([
  {
    element: (
      <ProtectedRoute roles={["admin", "superAdmin"]}>
        <DistrictScopeProvider>
          <AdminLayout />
        </DistrictScopeProvider>
      </ProtectedRoute>
    ),
    // Themed 500 for genuine loader/render throws (NotFound is the catch-all 404 below).
    errorElement: <ServerError />,
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
      { path: "*", element: <NotFound /> },
    ],
  },
]);
