import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { QuizProvider } from './context/QuizContext'
import { ResultsProvider } from './context/ResultsContext'
import { UserProvider } from './context/UserContext'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/shared/ErrorBoundary'

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

                  {/* App pages — inside AppShell with NavBar */}
                  <Route element={<AppShell />}>
                    <Route path="quiz" element={<QuizPage />} />
                    <Route path="results" element={<ResultsPage />} />
                    <Route path="dispensaries" element={<DispensaryPage />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="journal" element={<JournalPage />} />
                    <Route path="compare" element={<ComparePage />} />
                    <Route path="learn" element={<LearnPage />} />
                    <Route path="learn/:topic" element={<LearnPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </ResultsProvider>
          </QuizProvider>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
