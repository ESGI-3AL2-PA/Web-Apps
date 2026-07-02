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
      { path: "/", element: <Dashboard />, handle: { title: "Dashboard" } },
      { path: "/users", element: <UsersList />, handle: { title: "Users" } },
      { path: "/districts", element: <DistrictPage />, handle: { title: "District" } },
      { path: "/tags", element: <TagsList />, handle: { title: "Tags" } },
      { path: "/incidents", element: <IncidentsList />, handle: { title: "Incidents" } },
      { path: "/listings", element: <ListingsList />, handle: { title: "Listings" } },
      { path: "/events", element: <EventsList />, handle: { title: "Events" } },
      { path: "/votes", element: <VotesList />, handle: { title: "Votes" } },
    ],
  },
]);
