import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import { DistrictScopeProvider } from "./DistrictScopeProvider";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/dashboard/Dashboard";
import UsersList from "../pages/users/UsersList";
import DistrictsList from "../pages/districts/DistrictsList";
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
      { path: "/", element: <Dashboard /> },
      { path: "/users", element: <UsersList /> },
      { path: "/districts", element: <DistrictsList /> },
      { path: "/tags", element: <TagsList /> },
      { path: "/incidents", element: <IncidentsList /> },
      { path: "/listings", element: <ListingsList /> },
      { path: "/events", element: <EventsList /> },
      { path: "/votes", element: <VotesList /> },
    ],
  },
]);
