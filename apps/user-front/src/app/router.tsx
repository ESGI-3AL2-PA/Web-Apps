import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@repo/hooks";
import { config } from "@repo/config";
import MainLayout from "../layouts/MainLayout";
import { DistrictGuard } from "./DistrictGuard";
import NotFound from "../pages/NotFound";
import ServerError from "../pages/ServerError";

// Définition du routeur de l'app user-front. Toutes les routes sont protégées et
// imbriquées sous le MainLayout ; les chemins sont en français (ex. /recherche, /annonce/:id).

// Composants de route code-splittés : chacun devient son propre chunk chargé à la
// navigation, ce qui garde le bundle initial léger. NotFound et ServerError restent
// importés en dur (eager) car ils servent aussi de gestionnaires d'erreur du routeur.
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
    // Branche unique : n'admet que les rôles "user" et "admin" ; tout autre rôle
    // (superAdmin) est redirigé vers la console admin. Le DistrictGuard bloque ensuite
    // les utilisateurs sans quartier avant d'atteindre le layout.
    element: (
      <ProtectedRoute roles={["user", "admin"]} forbiddenRedirect={config.adminUrl}>
        <DistrictGuard>
          <MainLayout />
        </DistrictGuard>
      </ProtectedRoute>
    ),
    // Affiche une page 500 thémée pour les vraies erreurs de loader/rendu (le 404 fourre-tout est la route "*" ci-dessous).
    errorElement: <ServerError />,
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
