import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import { config } from "@repo/config";
import MainLayout from "../layouts/MainLayout";
import NotFound from "../pages/NotFound";

// Route components are code-split: each becomes its own chunk fetched on
// navigation, keeping the initial bundle small. NotFound stays eager since it
// doubles as the router errorElement.
const Home = lazy(() => import("../pages/Home"));
const Search = lazy(() => import("../pages/Search"));
const ListingDetail = lazy(() => import("../pages/ListingDetail"));
const PostListing = lazy(() => import("../pages/PostListing"));
const MyListings = lazy(() => import("../pages/MyListings"));
const Messages = lazy(() => import("../pages/Messages"));
const Events = lazy(() => import("../pages/Events"));
const Votes = lazy(() => import("../pages/Votes"));
const Settings = lazy(() => import("../pages/Settings"));
const Contracts = lazy(() => import("../pages/Contracts"));
const Profile = lazy(() => import("../pages/Profile"));
const Incidents = lazy(() => import("../pages/Incidents"));

export const router = createBrowserRouter([
  {
    element: (
      <ProtectedRoute roles={["user", "admin"]} forbiddenRedirect={config.adminUrl}>
        <MainLayout />
      </ProtectedRoute>
    ),
    // Renders a themed page for router errors instead of the raw dev screen.
    errorElement: <NotFound />,
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
      { path: "*", element: <NotFound /> },
    ],
  },
]);
