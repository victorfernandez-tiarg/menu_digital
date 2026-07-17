import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MenuPage from './pages/MenuPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import RegisterPage from './pages/RegisterPage'
import CanteenLoginPage from './pages/CanteenLoginPage'
import CanteenPage from './pages/CanteenPage'
import CanteenAdminPage from './pages/CanteenAdminPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('auth_token')
  return token ? <>{children}</> : <Navigate to="/admin/login" replace />
}

function CanteenRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('canteen_token')
  return token ? <>{children}</> : <Navigate to="/comedor/login" replace />
}

function CanteenAdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('canteen_token')
  const role  = localStorage.getItem('canteen_role')
  if (!token) return <Navigate to="/comedor/login" replace />
  if (role !== 'admin') return <Navigate to="/comedor" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/register" replace />} />
        <Route path="/menu/:slug" element={<MenuPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        {/* Comedor */}
        <Route path="/comedor/login" element={<CanteenLoginPage />} />
        <Route path="/comedor" element={<CanteenRoute><CanteenPage /></CanteenRoute>} />
        <Route path="/comedor/admin" element={<CanteenAdminRoute><CanteenAdminPage /></CanteenAdminRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
