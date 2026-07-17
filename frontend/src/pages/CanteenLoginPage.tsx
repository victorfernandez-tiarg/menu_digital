import { useState, FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { UtensilsCrossed, Lock, User, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import canteenApi from '../lib/canteen-api'

export default function CanteenLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  if (localStorage.getItem('canteen_token')) {
    const role = localStorage.getItem('canteen_role')
    return <Navigate to={role === 'admin' ? '/comedor/admin' : '/comedor'} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await canteenApi.post('/auth/login', { username, password })
      localStorage.setItem('canteen_token', data.token)
      localStorage.setItem('canteen_role', data.role)
      localStorage.setItem('canteen_user', JSON.stringify(data))
      toast.success(`Bienvenido/a, ${data.full_name}`)
      navigate(data.role === 'admin' ? '/comedor/admin' : '/comedor')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600 shadow-lg mb-4">
            <UtensilsCrossed className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sistema de Viandas</h1>
          <p className="text-sm text-gray-500 mt-1">Ingresá con tu usuario institucional</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuario Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-900 mb-2">
                Usuario
              </label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${
                  loading ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder="tu_usuario"
                  required
                  autoComplete="username"
                  aria-label="Nombre de usuario"
                  aria-required="true"
                  aria-disabled={loading}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border-2 border-gray-300 bg-white text-sm font-medium text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700 focus:bg-teal-50 transition-all duration-200 hover:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Contraseña Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors ${
                  loading ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  aria-label="Contraseña"
                  aria-required="true"
                  aria-disabled={loading}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border-2 border-gray-300 bg-white text-sm font-medium text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700 focus:bg-teal-50 transition-all duration-200 hover:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded p-1 transition-colors disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showPwd ? 'Ocultar' : 'Mostrar'}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md disabled:shadow-none disabled:hover:bg-gray-500"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Ingresando…</span>
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Acceso exclusivo para personal autorizado
        </p>
      </div>
    </div>
  )
}
