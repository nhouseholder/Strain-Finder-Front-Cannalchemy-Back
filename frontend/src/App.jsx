import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { QuizProvider } from './context/QuizContext'
import { ResultsProvider } from './context/ResultsContext'
import { UserProvider } from './context/UserContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/shared/ErrorBoundary'
import ProtectedRoute from './components/shared/ProtectedRoute'
import AgeGate from './components/shared/AgeGate'
import lazyRetry from './utils/lazyRetry'

const LandingPage = lazy(() => lazyRetry(() => import('./routes/LandingPage'), 'LandingPage'))
const QuizPage = lazy(() => lazyRetry(() => import('./routes/QuizPage'), 'QuizPage'))
const ResultsPage = lazy(() => lazyRetry(() => import('./routes/ResultsPage'), 'ResultsPage'))
// const DispensaryPage = lazy(() => lazyRetry(() => import('./routes/DispensaryPage'), 'DispensaryPage')) // Silenced — feature not ready
const JournalPage = lazy(() => lazyRetry(() => import('./routes/JournalPage'), 'JournalPage'))
const ComparePage = lazy(() => lazyRetry(() => import('./routes/ComparePage'), 'ComparePage'))
const StrainSearchPage = lazy(() => lazyRetry(() => import('./routes/StrainSearchPage'), 'StrainSearchPage'))
const StrainExplorerPage = lazy(() => lazyRetry(() => import('./routes/StrainExplorerPage'), 'StrainExplorerPage'))
const ExploreStrainsPage = lazy(() => lazyRetry(() => import('./routes/ExploreStrainsPage'), 'ExploreStrainsPage'))
const LearnPage = lazy(() => lazyRetry(() => import('./routes/LearnPage'), 'LearnPage'))
const LoginPage = lazy(() => lazyRetry(() => import('./routes/LoginPage'), 'LoginPage'))
const SignupPage = lazy(() => lazyRetry(() => import('./routes/SignupPage'), 'SignupPage'))
const AdminPage = lazy(() => lazyRetry(() => import('./routes/AdminPage'), 'AdminPage'))
const ForgotPasswordPage = lazy(() => lazyRetry(() => import('./routes/ForgotPasswordPage'), 'ForgotPasswordPage'))
const TermsPage = lazy(() => lazyRetry(() => import('./routes/TermsPage'), 'TermsPage'))
const PrivacyPage = lazy(() => lazyRetry(() => import('./routes/PrivacyPage'), 'PrivacyPage'))
const NotFoundPage = lazy(() => lazyRetry(() => import('./routes/NotFoundPage'), 'NotFoundPage'))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 rounded-full border-2 border-leaf-500/20 border-t-leaf-500 animate-spin-slow" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AgeGate>
      <AuthProvider>
        <ToastProvider>
        <ThemeProvider>
          <UserProvider>
            <QuizProvider>
              <ResultsProvider>
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    {/* Public pages — own layout (no AppShell) */}
                    <Route index element={<LandingPage />} />
                    <Route path="login" element={<LoginPage />} />
                    <Route path="signup" element={<SignupPage />} />
                    <Route path="forgot-password" element={<ForgotPasswordPage />} />

                    {/* Legal pages — public, own layout */}
                    <Route path="terms" element={<TermsPage />} />
                    <Route path="privacy" element={<PrivacyPage />} />

                    {/* App pages — inside AppShell with NavBar */}
                    <Route element={<AppShell />}>
                      {/* Guest-accessible — quiz & results work without login (freemium gated) */}
                      <Route path="quiz" element={<QuizPage />} />
                      <Route path="results" element={<ResultsPage />} />
                      {/* <Route path="dispensaries" element={<DispensaryPage />} /> — Silenced: feature not ready */}
                      <Route path="dispensaries" element={<Navigate to="/results" replace />} />

                      {/* Protected routes — require login */}
                      <Route path="dashboard" element={<Navigate to="/journal" replace />} />
                      <Route path="search" element={<StrainSearchPage />} />
                      <Route path="explore" element={<StrainExplorerPage />} />
                      <Route path="explore-strains" element={<ExploreStrainsPage />} />
                      <Route path="explore-strains/:category" element={<ExploreStrainsPage />} />
                      <Route path="top-strains" element={<Navigate to="/explore-strains" replace />} />
                      <Route path="top-strains/:category" element={<Navigate to="/explore-strains" replace />} />
                      <Route path="journal" element={<ProtectedRoute><JournalPage /></ProtectedRoute>} />
                      <Route path="compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
                      <Route path="preferences" element={<Navigate to="/journal" replace />} />

                      {/* Public — SEO funnel, accessible without login */}
                      <Route path="learn" element={<LearnPage />} />
                      <Route path="learn/:topic" element={<LearnPage />} />

                      {/* Admin — protected + requires admin role */}
                      <Route path="admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                    </Route>

                    {/* 404 catch-all */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </ResultsProvider>
            </QuizProvider>
          </UserProvider>
        </ThemeProvider>
        </ToastProvider>
      </AuthProvider>
      </AgeGate>
    </ErrorBoundary>
  )
}
