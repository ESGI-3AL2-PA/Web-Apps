import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '../layouts/MainLayouts'
import ServicePage from '../pages/service/Service'
import EvenementPage from '../pages/Evenement'
import MessageriePage from '../pages/Messagerie'
import Annonces from '../pages/service/Annonces'
import AnnoncesUser from '../pages/service/AnnoncesUser'
import Contrat from '../pages/service/Contrat'

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <Navigate to="/service" replace /> },
      {
        path: '/service',
        element: <ServicePage />,
        children: [
          { index: true, element: <Navigate to="annonces" replace /> },
          { path: 'annonces', element: <Annonces /> },
          { path: 'mes-annonces', element: <AnnoncesUser /> },
          { path: 'mes-contrats', element: <Contrat /> },
        ]
      },
      { path: '/evenement', element: <EvenementPage /> },
      { path: '/messagerie', element: <MessageriePage /> },
    ]
  },
  {
    path: '/auth',
    children: [
      // ajout de l'auth
    ]
  }
])