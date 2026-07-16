import { useState, FormEvent } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChefHat, Building2, Link2, User, Lock, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ restaurant_name: '', slug: '', username: '', password: '' })

  if (localStorage.getItem('auth_token')) return <Navigate to="/admin" replace />

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleNameChange = (v: string) => {
    setForm(f => ({ ...f, restaurant_name: v, slug: slugify(v) }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.restaurant_name || !form.slug || !form.username || !form.password) {
      return toast.error('Completá todos los campos')
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_username', data.username)
      localStorage.setItem('auth_role', data.role)
      localStorage.setItem('auth_branch_slug', data.branch_slug)
      toast.success('¡Restaurante creado!')
      navigate('/admin')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a0a0a' }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 30% 60%, rgba(245,158,11,0.05) 0%, transparent 50%)' }}
      />
      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <ChefHat size={26} style={{ color: '#0a0a0a' }} />
          </div>
          <h1 className="font-serif text-3xl font-bold text-white">Crear restaurante</h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Tu menú digital en minutos</p>
        </div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 p-7 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Nombre del restaurante */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              NOMBRE DEL RESTAURANTE
            </label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <input
                type="text"
                value={form.restaurant_name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="La Parrilla del Chef"
                className="input-dark pl-10 text-sm w-full"
                required
              />
            </div>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              URL DEL MENÚ
            </label>
            <div className="relative">
              <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <input
                type="text"
                value={form.slug}
                onChange={e => set('slug', slugify(e.target.value))}
                placeholder="la-parrilla"
                className="input-dark pl-10 text-sm w-full font-mono"
                required
              />
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
              /menu/<span style={{ color: '#f59e0b' }}>{form.slug || 'tu-slug'}</span>
            </p>
          </div>

          <div className="pt-1 pb-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Usuario */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              USUARIO ADMINISTRADOR
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <input
                type="text"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                placeholder="admin"
                className="input-dark pl-10 text-sm w-full"
                required
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              CONTRASEÑA
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
                className="input-dark pl-10 text-sm w-full"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold mt-2"
            style={{ background: loading ? 'rgba(245,158,11,0.4)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0a0a0a' }}
          >
            {loading ? 'Creando...' : (<>Crear restaurante <ArrowRight size={15} /></>)}
          </button>
        </motion.form>

        <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
          ¿Ya tenés cuenta?{' '}
          <Link to="/admin/login" style={{ color: '#f59e0b' }}>Iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
