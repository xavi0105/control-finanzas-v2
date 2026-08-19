import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Loader from './components/Loader'
import { FinanceProvider } from './context/FinanceContext'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Recommender from './pages/Recommender'
import Transactions from './pages/Transactions'
import Accounts from './pages/Accounts'
import Goals from './pages/Goals'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import PlannedExpenses from './pages/PlannedExpenses'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <FinanceProvider>
              <Layout />
            </FinanceProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="recomendador" element={<Recommender />} />
        <Route path="transacciones" element={<Transactions />} />
        <Route path="cuentas" element={<Accounts />} />
        <Route path="gastos" element={<PlannedExpenses />} />
        <Route path="metas" element={<Goals />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="ajustes" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}