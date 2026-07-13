import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import { config } from "@repo/config";
import MainLayout from "../layouts/MainLayout";
import Home from "../pages/Home";
import Search from "../pages/Search";
import ListingDetail from "../pages/ListingDetail";
import PostListing from "../pages/PostListing";
import MyListings from "../pages/MyListings";
import Messages from "../pages/Messages";
import Events from "../pages/Events";
import Votes from "../pages/Votes";
import Settings from "../pages/Settings";
import Contracts from "../pages/Contracts";
import Profile from "../pages/Profile";
import Incidents from "../pages/Incidents";

export const router = createBrowserRouter([
  {
    element: (
      <ProtectedRoute roles={["user", "admin"]} forbiddenRedirect={config.adminUrl}>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "/", element: <Home /> },
      { path: "/recherche", element: <Search /> },
      { path: "/annonce/:id", element: <ListingDetail /> },
      { path: "/deposer", element: <PostListing /> },
      { path: "/mes-annonces", element: <MyListings /> },
      { path: "/mes-contrats", element: <Contracts /> },
      { path: "/profil", element: <Profile /> },
      { path: "/incidents", element: <Incidents /> },
      { path: "/parametres", element: <Settings /> },
      { path: "/evenements", element: <Events /> },
      { path: "/sondages", element: <Votes /> },
      { path: "/messages", element: <Messages /> },
      { path: "/messages/:conversationId", element: <Messages /> },
    ],
  },
]);
