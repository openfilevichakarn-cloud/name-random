import { lazy } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppShell } from './AppShell'
import { RouteError } from './RouteError'

// Route-level code splitting: each page (and its heavy dependencies) loads on demand.
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ClassroomsPage = lazy(() => import('@/pages/ClassroomsPage'))
const ClassroomDetailPage = lazy(() => import('@/pages/ClassroomDetailPage'))
const StudioPage = lazy(() => import('@/pages/StudioPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const BattlePage = lazy(() => import('@/pages/BattlePage'))
const RankingPage = lazy(() => import('@/pages/RankingPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'classrooms', element: <ClassroomsPage /> },
      { path: 'classrooms/:classroomId', element: <ClassroomDetailPage /> },
      { path: 'studio', element: <StudioPage /> },
      { path: 'battle', element: <BattlePage /> },
      { path: 'ranking', element: <RankingPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
