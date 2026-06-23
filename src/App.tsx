import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import IncomeSourcesPage from './pages/IncomeSourcesPage';
import ExpenseSectorsPage from './pages/ExpenseSectorsPage';
import TransactionsPage from './pages/TransactionsPage';
import RecurringBillsPage from './pages/RecurringBillsPage';
import GoalsPage from './pages/GoalsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import { ReactNode } from 'react';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn('[APP] Auth loading timeout reached after 10 seconds');
        setTimeoutReached(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !timeoutReached) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-dark-950">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  // If timeout reached and still loading, show error state
  if (loading && timeoutReached) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-dark-950">
        <p className="text-error-600 dark:text-error-400 mb-4">Tempo de carregamento excedido</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Recarregar página
        </button>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn('[APP] Auth loading timeout reached after 10 seconds');
        setTimeoutReached(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !timeoutReached) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-dark-950">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
      </div>
    );
  }

  // If timeout reached and still loading, proceed to show content
  // This prevents infinite loading
  if (loading && timeoutReached) {
    console.log('[APP] Proceeding despite timeout');
    return <>{children}</>;
  }

  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="income-sources" element={<IncomeSourcesPage />} />
        <Route path="expense-sectors" element={<ExpenseSectorsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/new" element={<TransactionsPage />} />
        <Route path="recurring-bills" element={<RecurringBillsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  console.log('[APP] App component loaded');

  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
