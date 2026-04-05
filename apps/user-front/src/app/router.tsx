import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '../layouts/MainLayouts'
import ServicePage from '../pages/Service'
import EvenementPage from '../pages/Evenement'
import MessageriePage from '../pages/Messagerie'

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <Navigate to="/service" replace /> },
      { path: '/service', element: <ServicePage /> },
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