import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
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

const LandingPage = lazy(() => import('./routes/LandingPage'))
const QuizPage = lazy(() => import('./routes/QuizPage'))
const ResultsPage = lazy(() => import('./routes/ResultsPage'))
const DispensaryPage = lazy(() => import('./routes/DispensaryPage'))
const DashboardPage = lazy(() => import('./routes/DashboardPage'))
const JournalPage = lazy(() => import('./routes/JournalPage'))
const ComparePage = lazy(() => import('./routes/ComparePage'))
const LearnPage = lazy(() => import('./routes/LearnPage'))
const LoginPage = lazy(() => import('./routes/LoginPage'))
const SignupPage = lazy(() => import('./routes/SignupPage'))
const AdminPage = lazy(() => import('./routes/AdminPage'))
const CheckoutSuccessPage = lazy(() => import('./routes/CheckoutSuccessPage'))
const ForgotPasswordPage = lazy(() => import('./routes/ForgotPasswordPage'))
const TermsPage = lazy(() => import('./routes/TermsPage'))
const PrivacyPage = lazy(() => import('./routes/PrivacyPage'))
const NotFoundPage = lazy(() => import('./routes/NotFoundPage'))

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
                    <Route path="checkout-success" element={<ProtectedRoute><CheckoutSuccessPage /></ProtectedRoute>} />

                    {/* Legal pages — public, own layout */}
                    <Route path="terms" element={<TermsPage />} />
                    <Route path="privacy" element={<PrivacyPage />} />

                    {/* App pages — inside AppShell with NavBar */}
                    <Route element={<AppShell />}>
                      {/* Guest-accessible — quiz & results work without login (freemium gated) */}
                      <Route path="quiz" element={<QuizPage />} />
                      <Route path="results" element={<ResultsPage />} />
                      <Route path="dispensaries" element={<DispensaryPage />} />

                      {/* Protected routes — require login */}
                      <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                      <Route path="journal" element={<ProtectedRoute><JournalPage /></ProtectedRoute>} />
                      <Route path="compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />

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
