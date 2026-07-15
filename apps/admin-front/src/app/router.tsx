import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import { DistrictScopeProvider } from "./DistrictScopeProvider";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/dashboard/Dashboard";
import UsersList from "../pages/users/UsersList";
import DistrictPage from "../pages/districts/DistrictPage";
import TagsList from "../pages/tags/TagsList";
import IncidentsList from "../pages/incidents/IncidentsList";
import ListingsList from "../pages/listings/ListingsList";
import EventsList from "../pages/events/EventsList";
import VotesList from "../pages/votes/VotesList";

export const router = createBrowserRouter([
  {
    element: (
      <ProtectedRoute roles={["admin", "superAdmin"]}>
        <DistrictScopeProvider>
          <AdminLayout />
        </DistrictScopeProvider>
      </ProtectedRoute>
    ),
    children: [
      { path: "/", element: <Dashboard />, handle: { titleKey: "nav.dashboard" } },
      { path: "/users", element: <UsersList />, handle: { titleKey: "nav.users" } },
      { path: "/districts", element: <DistrictPage />, handle: { titleKey: "nav.districts" } },
      { path: "/tags", element: <TagsList />, handle: { titleKey: "nav.tags" } },
      { path: "/incidents", element: <IncidentsList />, handle: { titleKey: "nav.incidents" } },
      { path: "/listings", element: <ListingsList />, handle: { titleKey: "nav.listings" } },
      { path: "/events", element: <EventsList />, handle: { titleKey: "nav.events" } },
      { path: "/votes", element: <VotesList />, handle: { titleKey: "nav.votes" } },
    ],
  },
]);
