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
      { path: "/", element: <Dashboard />, handle: { title: "nav.dashboard" } },
      { path: "/users", element: <UsersList />, handle: { title: "nav.users" } },
      { path: "/districts", element: <DistrictPage />, handle: { title: "nav.districts" } },
      { path: "/tags", element: <TagsList />, handle: { title: "nav.tags" } },
      { path: "/incidents", element: <IncidentsList />, handle: { title: "nav.incidents" } },
      { path: "/listings", element: <ListingsList />, handle: { title: "nav.listings" } },
      { path: "/events", element: <EventsList />, handle: { title: "nav.events" } },
      { path: "/votes", element: <VotesList />, handle: { title: "nav.votes" } },
    ],
  },
]);
