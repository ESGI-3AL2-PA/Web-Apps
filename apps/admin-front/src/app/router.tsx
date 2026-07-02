import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/dashboard/Dashboard";
import UsersList from "../pages/users/UsersList";
import DistrictsList from "../pages/districts/DistrictsList";
import TagsList from "../pages/tags/TagsList";
import IncidentsList from "../pages/incidents/IncidentsList";
import TransactionsList from "../pages/transactions/TransactionsList";
import NotificationsList from "../pages/notifications/NotificationsList";
import ListingsList from "../pages/listings/ListingsList";
import EventsList from "../pages/events/EventsList";
import VotesList from "../pages/votes/VotesList";
import ContractsList from "../pages/contracts/ContractsList";

export const router = createBrowserRouter([
  {
    element: (
      <ProtectedRoute roles={["admin", "superAdmin"]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/users", element: <UsersList /> },
      { path: "/districts", element: <DistrictsList /> },
      { path: "/tags", element: <TagsList /> },
      { path: "/incidents", element: <IncidentsList /> },
      { path: "/transactions", element: <TransactionsList /> },
      { path: "/notifications", element: <NotificationsList /> },
      { path: "/listings", element: <ListingsList /> },
      { path: "/events", element: <EventsList /> },
      { path: "/votes", element: <VotesList /> },
      { path: "/contracts", element: <ContractsList /> },
    ],
  },
]);
