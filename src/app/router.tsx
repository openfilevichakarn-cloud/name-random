import { lazy } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppShell } from './AppShell'
import { RouteError } from './RouteError'

// Route-level code splitting: each page (and its heavy dependencies) loads on demand.
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ClassroomsPage = lazy(() => import('@/pages/ClassroomsPage'))
const StudioPage = lazy(() => import('@/pages/StudioPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'classrooms', element: <ClassroomsPage /> },
      { path: 'studio', element: <StudioPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
