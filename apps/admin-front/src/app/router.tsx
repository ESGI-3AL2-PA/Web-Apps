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
const TagsList = lazy(() => import("../pages/tags/TagsList"));
const IncidentsList = lazy(() => import("../pages/incidents/IncidentsList"));
const ListingsList = lazy(() => import("../pages/listings/ListingsList"));
const EventsList = lazy(() => import("../pages/events/EventsList"));
const VotesList = lazy(() => import("../pages/votes/VotesList"));

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
      { path: "/", element: <Dashboard />, handle: { title: "Dashboard" } },
      { path: "/users", element: <UsersList />, handle: { title: "Users" } },
      { path: "/districts", element: <DistrictPage />, handle: { title: "District" } },
      { path: "/tags", element: <TagsList />, handle: { title: "Tags" } },
      { path: "/incidents", element: <IncidentsList />, handle: { title: "Incidents" } },
      { path: "/listings", element: <ListingsList />, handle: { title: "Listings" } },
      { path: "/events", element: <EventsList />, handle: { title: "Events" } },
      { path: "/votes", element: <VotesList />, handle: { title: "Votes" } },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
