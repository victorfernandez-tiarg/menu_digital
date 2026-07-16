import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ChefHat, Package, LogOut, Plus, Pencil, Trash2,
  ToggleLeft, ToggleRight, Star, Tag, ExternalLink, BarChart2, Building2,
  Calendar, Clock, MousePointerClick, AlertTriangle, GripVertical, ShieldCheck,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import type { Category, Product } from '../types'
import ProductForm from '../components/admin/ProductForm'
import CategoryForm from '../components/admin/CategoryForm'
import ConfirmModal from '../components/ui/ConfirmModal'

type Tab = 'products' | 'categories' | 'analytics' | 'branches'

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      <div className="mt-3 h-1 rounded-full" style={{ background: color, opacity: 0.4, width: '40%' }} />
    </div>
  )
}

interface Branch { id: number; restaurant_id: number; name: string; slug: string; address: string | null; phone: string | null; active: number; admin_count: number }

function BranchesPanel({ branches, onRefresh }: { branches: Branch[]; onRefresh: () => void }) {
  const [newBranch, setNewBranch] = useState({ name: '', slug: '', address: '', phone: '' })
  const [adminForm, setAdminForm] = useState<{ branchId: number | null; username: string; password: string }>({ branchId: null, username: '', password: '' })
  const [creating, setCreating] = useState(false)
  const [savingAdmin, setSavingAdmin] = useState(false)

  const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/restaurants/branches', newBranch)
      toast.success('Sucursal creada')
      setNewBranch({ name: '', slug: '', address: '', phone: '' })
      onRefresh()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al crear sucursal')
    } finally { setCreating(false) }
  }

  const handleToggle = async (branch: Branch) => {
    try {
      await api.put(`/restaurants/branches/${branch.id}`, { active: !branch.active })
      onRefresh()
    } catch { toast.error('Error') }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminForm.branchId) return
    setSavingAdmin(true)
    try {
      const { data } = await api.post(`/restaurants/branches/${adminForm.branchId}/admin`, { username: adminForm.username, password: adminForm.password })
      toast.success(`Admin "${data.username}" creado para ${data.branch_name}`)
      setAdminForm({ branchId: null, username: '', password: '' })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error')
    } finally { setSavingAdmin(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Lista de sucursales */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Sucursales</h3>
            <p className="text-xs text-gray-400 mt-0.5">{branches.length} sucursal{branches.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        {branches.length === 0 ? (
          <p className="text-center py-10 text-gray-300 text-sm">Sin sucursales adicionales</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {branches.map(b => (
              <li key={b.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{b.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">/menu/{b.slug}</p>
                  {b.address && <p className="text-xs text-gray-400 mt-0.5">{b.address}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => setAdminForm(f => ({ ...f, branchId: b.id }))}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ background: '#eff6ff', color: '#3b82f6' }}
                  >
                    + Admin
                  </button>
                  <button
                    onClick={() => handleToggle(b)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={b.active ? { background: '#ecfdf5', color: '#059669' } : { background: '#f3f4f6', color: '#9ca3af' }}
                  >
                    {b.active ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Crear sucursal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Nueva sucursal</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              className="input-admin text-sm w-full"
              placeholder="Nombre (ej: Palermo)"
              value={newBranch.name}
              onChange={e => setNewBranch(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
              required
            />
            <input
              className="input-admin text-sm w-full font-mono"
              placeholder="slug (ej: palermo)"
              value={newBranch.slug}
              onChange={e => setNewBranch(f => ({ ...f, slug: e.target.value }))}
              required
            />
            <input className="input-admin text-sm w-full" placeholder="Dirección (opcional)" value={newBranch.address} onChange={e => setNewBranch(f => ({ ...f, address: e.target.value }))} />
            <input className="input-admin text-sm w-full" placeholder="Teléfono (opcional)" value={newBranch.phone} onChange={e => setNewBranch(f => ({ ...f, phone: e.target.value }))} />
            <button
              type="submit" disabled={creating}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
            >
              {creating ? 'Creando...' : 'Crear sucursal'}
            </button>
          </form>
        </div>

        {/* Asignar admin */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Crear admin de sucursal</h3>
          <form onSubmit={handleCreateAdmin} className="space-y-3">
            <select
              className="input-admin text-sm w-full"
              value={adminForm.branchId ?? ''}
              onChange={e => setAdminForm(f => ({ ...f, branchId: Number(e.target.value) || null }))}
              required
            >
              <option value="">Seleccionar sucursal</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input className="input-admin text-sm w-full" placeholder="Usuario" value={adminForm.username} onChange={e => setAdminForm(f => ({ ...f, username: e.target.value }))} required />
            <input type="password" className="input-admin text-sm w-full" placeholder="Contraseña" value={adminForm.password} onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
            <button
              type="submit" disabled={savingAdmin}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}
            >
              {savingAdmin ? 'Guardando...' : 'Crear administrador'}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Sortable product row ─────────────────────────────────────
function SortableProductRow({
  product, onToggle, onEdit, onDelete,
}: {
  product: Product
  onToggle: (id: number, available: boolean) => void
  onEdit: (p: Product) => void
  onDelete: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? '#fffbeb' : undefined,
  }
  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-50 hover:bg-amber-50/20 transition-colors">
      <td className="pl-3 pr-1 py-3.5 w-8">
        <button
          {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={16} />
        </button>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{product.name}</p>
            {product.featured && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                <Star size={9} className="fill-current" /> Destacado
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-3.5 text-gray-400">{product.category_name || '—'}</td>
      <td className="px-6 py-3.5">
        <span className="font-bold text-gray-800">${product.price.toLocaleString('es-AR')}</span>
      </td>
      <td className="px-6 py-3.5 text-center">
        <button
          onClick={() => onToggle(product.id, !product.available)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
          style={product.available
            ? { background: '#ecfdf5', color: '#059669' }
            : { background: '#fef2f2', color: '#dc2626' }}
        >
          {product.available ? <><ToggleRight size={13} /> Disponible</> : <><ToggleLeft size={13} /> No disponible</>}
        </button>
      </td>
      <td className="px-6 py-3.5">
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => onEdit(product)} className="p-2 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-all" title="Editar">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(product.id)} className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Sortable category row ────────────────────────────────────
function SortableCategoryRow({
  cat, onEdit, onDelete,
}: {
  cat: Category
  onEdit: (c: Category) => void
  onDelete: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? '#fffbeb' : undefined,
  }
  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-50 hover:bg-amber-50/20 transition-colors">
      <td className="pl-3 pr-1 py-3.5 w-8">
        <button
          {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={16} />
        </button>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: cat.color + '22' }}>
            {cat.icon}
          </div>
          <p className="font-semibold text-gray-900">{cat.name}</p>
        </div>
      </td>
      <td className="px-6 py-3.5 text-gray-400 max-w-[200px] truncate">{cat.description || '—'}</td>
      <td className="px-6 py-3.5 text-center">
        <span className="font-semibold text-gray-700">{cat.product_count ?? 0}</span>
      </td>
      <td className="px-6 py-3.5 text-center">
        <span
          className="inline-flex px-3 py-1 rounded-full text-xs font-semibold"
          style={cat.active ? { background: '#ecfdf5', color: '#059669' } : { background: '#f3f4f6', color: '#9ca3af' }}
        >
          {cat.active ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td className="px-6 py-3.5">
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => onEdit(cat)} className="p-2 rounded-lg text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-all">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(cat.id)} className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('products')
  const nDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
  const todayStr = new Date().toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState(() => nDaysAgo(30))
  const [dateTo, setDateTo] = useState(todayStr)
  const [productModal, setProductModal] = useState<{ open: boolean; product?: Product }>({ open: false })
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category?: Category }>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'product' | 'category'; id: number } | null>(null)

  const navigate = useNavigate()
  const qc = useQueryClient()
  const username = localStorage.getItem('auth_username') || 'Admin'
  const role = localStorage.getItem('auth_role') || 'owner'
  const branchSlug = localStorage.getItem('auth_branch_slug') || ''

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: () => api.get('/products/all').then((r) => r.data),
  })

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/categories/all').then((r) => r.data),
  })

  // Local ordered copies for drag-and-drop
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([])
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([])
  useEffect(() => { setOrderedProducts(products) }, [products])
  useEffect(() => { setOrderedCategories(categories) }, [categories])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  interface Branch { id: number; restaurant_id: number; name: string; slug: string; address: string | null; phone: string | null; active: number; admin_count: number }

  const { data: branches = [], refetch: refetchBranches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/restaurants/branches').then(r => r.data),
    enabled: role === 'owner' && tab === 'branches',
  })

  interface DowntimeData {
    currentlyOff: { product_id: number; product_name: string; turned_off_at: number; minutes_off: number }[]
    history: { product_id: number; product_name: string; incidents: number; total_minutes: number; avg_minutes: number; last_incident_at: number }[]
    recent: { id: number; product_name: string; turned_off_at: number; turned_on_at: number | null; duration_minutes: number; still_off: number }[]
  }

  const { data: downtime } = useQuery<DowntimeData>({
    queryKey: ['analytics-downtime'],
    queryFn: () => api.get('/analytics/downtime').then(r => r.data),
    enabled: tab === 'analytics',
    refetchInterval: tab === 'analytics' ? 60_000 : false,
  })

  const formatDuration = (minutes: number) => {
    const m = Math.round(minutes)
    if (m < 1) return 'menos de 1m'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    const rem = m % 60
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`
  }

  interface AnalyticsStats {
    topProducts: { product: string; product_id: number; impressions: number }[]
    topClicks: { product: string; product_id: number; clicks: number }[]
    topCategories: { category: string; views: number }[]
    topSearches: { query: string; count: number }[]
    sessions: { total: number }
    avgTime: { avg_seconds: number | null }
    recentDays: { day: string; sessions: number }[]
    hourlyTraffic: { hour: number; sessions: number }[]
    weekdayTraffic: { weekday: string; sessions: number }[]
    productCTR: { product: string; impressions: number; clicks: number; ctr: number | null }[]
    sessionDepth: { avg_events: number | null }
    scrollDepth: { depth: number; sessions: number }[]
  }

  interface AnalyticsHealth {
    accepted_events: number
    rejected_events: number
    rejected_sessions: number
    acceptance_rate: number | null
    top_rejection_reasons: { reason: string; count: number }[]
    rejected_by_event: { event: string; count: number }[]
    recent_rejections: { event: string; primary_error: string; created_at: string }[]
  }

  const { data: analytics } = useQuery<AnalyticsStats>({
    queryKey: ['analytics-stats', dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams()
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo)   params.set('date_to',   dateTo)
      return api.get(`/analytics/stats?${params}`).then((r) => r.data)
    },
    enabled: tab === 'analytics',
    refetchInterval: tab === 'analytics' ? 30_000 : false,
  })

  const {
    data: analyticsHealth,
    refetch: refetchAnalyticsHealth,
    isFetching: isFetchingAnalyticsHealth,
  } = useQuery<AnalyticsHealth>({
    queryKey: ['analytics-health', dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams()
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      return api.get(`/analytics/health?${params}`).then((r) => r.data)
    },
    enabled: tab === 'analytics',
    refetchInterval: tab === 'analytics' ? 30_000 : false,
  })

  const healthStatus = (() => {
    const rate = analyticsHealth?.acceptance_rate
    if (rate == null) return { label: 'Sin datos', bg: '#f3f4f6', color: '#6b7280' }
    if (rate >= 98) return { label: 'Excelente', bg: '#ecfdf5', color: '#059669' }
    if (rate >= 95) return { label: 'Buena', bg: '#eff6ff', color: '#2563eb' }
    if (rate >= 90) return { label: 'Atención', bg: '#fff7ed', color: '#ea580c' }
    return { label: 'Crítica', bg: '#fef2f2', color: '#dc2626' }
  })()

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-products'] })
    qc.invalidateQueries({ queryKey: ['admin-categories'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['categories'] })
    qc.invalidateQueries({ queryKey: ['featured'] })
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, available }: { id: number; available: boolean }) =>
      api.patch(`/products/${id}/toggle`, { available }),
    onSuccess: () => {
      invalidateAll()
      qc.invalidateQueries({ queryKey: ['analytics-downtime'] })
    },
    onError: () => toast.error('Error al cambiar disponibilidad'),
  })

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => { invalidateAll(); toast.success('Producto eliminado'); setDeleteConfirm(null) },
    onError: () => toast.error('Error al eliminar producto'),
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => { invalidateAll(); toast.success('Categoría eliminada'); setDeleteConfirm(null) },
    onError: () => toast.error('Error al eliminar categoría'),
  })

  const reorderProductsMutation = useMutation({
    mutationFn: (order: { id: number; order_index: number }[]) => api.patch('/products/reorder', { order }),
    onSuccess: () => invalidateAll(),
    onError: () => toast.error('Error al guardar el orden'),
  })

  const reorderCategoriesMutation = useMutation({
    mutationFn: (order: { id: number; order_index: number }[]) => api.patch('/categories/reorder', { order }),
    onSuccess: () => invalidateAll(),
    onError: () => toast.error('Error al guardar el orden'),
  })

  function handleProductDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedProducts.findIndex(p => p.id === active.id)
    const newIndex = orderedProducts.findIndex(p => p.id === over.id)
    const reordered = arrayMove(orderedProducts, oldIndex, newIndex)
    setOrderedProducts(reordered)
    reorderProductsMutation.mutate(reordered.map((p, i) => ({ id: p.id, order_index: i })))
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedCategories.findIndex(c => c.id === active.id)
    const newIndex = orderedCategories.findIndex(c => c.id === over.id)
    const reordered = arrayMove(orderedCategories, oldIndex, newIndex)
    setOrderedCategories(reordered)
    reorderCategoriesMutation.mutate(reordered.map((c, i) => ({ id: c.id, order_index: i })))
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    navigate('/admin/login')
  }

  const navBtn = (value: Tab, label: string, icon: React.ReactNode, count: number) => (
    <button
      onClick={() => setTab(value)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        tab === value
          ? 'bg-amber-50 text-amber-700 border border-amber-100'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
      <span className="ml-auto text-xs bg-gray-100 text-gray-400 rounded-full px-2 py-0.5">{count}</span>
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ─── SIDEBAR ────────────────────────────────────────── */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shadow-sm flex-shrink-0">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
            >
              <ChefHat size={18} style={{ color: '#0a0a0a' }} />
            </div>
            <div>
              <p className="font-serif font-bold text-gray-900 text-sm leading-none">Menú Digital</p>
              <p className="text-xs text-gray-400 mt-0.5">Panel de control</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navBtn('products', 'Productos', <Package size={17} />, products.length)}
          {navBtn('categories', 'Categorías', <Tag size={17} />, categories.length)}
          {navBtn('analytics', 'Analytics', <BarChart2 size={17} />, 0)}
          {role === 'owner' && navBtn('branches', 'Sucursales', <Building2 size={17} />, 0)}

          <div className="pt-2">
            <Link
              to={`/menu/${branchSlug}`}
              target="_blank"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all"
            >
              <ExternalLink size={16} />
              Ver menú público
            </Link>
          </div>
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-700 font-bold text-sm">{username.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-700 truncate">{username}</p>
              <p className="text-xs text-gray-400">Administrador</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ─── MAIN ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto admin-scroll">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="font-serif text-2xl font-bold text-gray-900">
                {tab === 'products' ? 'Productos' : tab === 'categories' ? 'Categorías' : tab === 'analytics' ? 'Analytics' : 'Sucursales'}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {tab === 'products'
                  ? `${products.length} productos · ${products.filter((p) => p.available).length} disponibles`
                  : tab === 'categories'
                  ? `${categories.length} categorías · ${categories.filter((c) => c.active).length} activas`
                  : tab === 'analytics'
                  ? 'Comportamiento de usuarios en el menú'
                  : 'Gestioná tus sucursales y sus administradores'}
              </p>
            </div>
            {tab !== 'analytics' && tab !== 'branches' && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() =>
                tab === 'products' ? setProductModal({ open: true }) : setCategoryModal({ open: true })
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
            >
              <Plus size={17} />
              {tab === 'products' ? 'Nuevo producto' : 'Nueva categoría'}
            </motion.button>
            )}
          </div>

          {/* Stats */}
          {tab === 'products' && (
            <div className="grid grid-cols-3 gap-4 mb-7">
              <StatCard label="Total" value={products.length} color="#6b7280" />
              <StatCard label="Disponibles" value={products.filter((p) => p.available).length} color="#10b981" />
              <StatCard label="Destacados" value={products.filter((p) => p.featured).length} color="#f59e0b" />
            </div>
          )}
          {tab === 'categories' && (
            <div className="grid grid-cols-3 gap-4 mb-7">
              <StatCard label="Total" value={categories.length} color="#6b7280" />
              <StatCard label="Activas" value={categories.filter((c) => c.active).length} color="#10b981" />
              <StatCard label="Con productos" value={categories.filter((c) => (c.product_count ?? 0) > 0).length} color="#f59e0b" />
            </div>
          )}

          {tab === 'products' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {orderedProducts.length === 0 ? (
                <div className="py-24 text-center text-gray-300">
                  <Package size={44} className="mx-auto mb-3 opacity-40" />
                  <p className="text-base">Sin productos aún. ¡Crea el primero!</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                      <th className="w-8 px-3" />
                      <th className="text-left px-4 py-4 font-semibold">Producto</th>
                      <th className="text-left px-6 py-4 font-semibold">Categoría</th>
                      <th className="text-left px-6 py-4 font-semibold">Precio</th>
                      <th className="text-center px-6 py-4 font-semibold">Estado</th>
                      <th className="text-right px-6 py-4 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProductDragEnd}>
                    <SortableContext items={orderedProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                      <tbody>
                        {orderedProducts.map((p) => (
                          <SortableProductRow
                            key={p.id}
                            product={p}
                            onToggle={(id, available) => toggleMutation.mutate({ id, available })}
                            onEdit={(prod) => setProductModal({ open: true, product: prod })}
                            onDelete={(id) => setDeleteConfirm({ type: 'product', id })}
                          />
                        ))}
                      </tbody>
                    </SortableContext>
                  </DndContext>
                </table>
              )}
            </motion.div>
          )}

          {/* ─── TABLA CATEGORÍAS ─── */}
          {tab === 'categories' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {orderedCategories.length === 0 ? (
                <div className="py-24 text-center text-gray-300">
                  <Tag size={44} className="mx-auto mb-3 opacity-40" />
                  <p className="text-base">Sin categorías. ¡Crea la primera!</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                      <th className="w-8 px-3" />
                      <th className="text-left px-4 py-4 font-semibold">Categoría</th>
                      <th className="text-left px-6 py-4 font-semibold">Descripción</th>
                      <th className="text-center px-6 py-4 font-semibold">Productos</th>
                      <th className="text-center px-6 py-4 font-semibold">Estado</th>
                      <th className="text-right px-6 py-4 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                    <SortableContext items={orderedCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <tbody>
                        {orderedCategories.map((cat) => (
                          <SortableCategoryRow
                            key={cat.id}
                            cat={cat}
                            onEdit={(c) => setCategoryModal({ open: true, category: c })}
                            onDelete={(id) => setDeleteConfirm({ type: 'category', id })}
                          />
                        ))}
                      </tbody>
                    </SortableContext>
                  </DndContext>
                </table>
              )}
            </motion.div>
          )}
          {/* ─── ANALYTICS ─── */}
          {tab === 'analytics' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

              {/* ── Filtro de período ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 flex-shrink-0">
                  <Calendar size={14} className="text-amber-500" />
                  Período
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {([['Hoy', 0], ['7 días', 7], ['30 días', 30], ['Todo', null]] as [string, number | null][]).map(([label, days]) => {
                    const isActive = days === null
                      ? !dateFrom && !dateTo
                      : dateFrom === (days === 0 ? todayStr : nDaysAgo(days)) && dateTo === todayStr
                    return (
                      <button
                        key={label}
                        onClick={() => {
                          if (days === null) { setDateFrom(''); setDateTo(''); return }
                          const from = new Date(); from.setDate(from.getDate() - (days as number))
                          setDateFrom(days === 0 ? todayStr : from.toISOString().split('T')[0])
                          setDateTo(todayStr)
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={isActive ? { background: '#f59e0b', color: '#fff' } : { background: '#f3f4f6', color: '#6b7280' }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="date" value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-300"
                  />
                  <span className="text-gray-300 text-xs">→</span>
                  <input
                    type="date" value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-300"
                  />
                </div>
              </div>

              {/* ── Faltantes ahora ── */}
              {downtime && downtime.currentlyOff.length > 0 && (
                <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                  <div className="px-6 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid #fecaca' }}>
                    <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm" style={{ color: '#b91c1c' }}>
                        {downtime.currentlyOff.length} producto{downtime.currentlyOff.length !== 1 ? 's' : ''} sin stock en este momento
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>Apagados por el administrador — activalos cuando el insumo esté disponible</p>
                    </div>
                  </div>
                  <ul className="divide-y" style={{ borderColor: '#fee2e2' }}>
                    {downtime.currentlyOff.map((item) => (
                      <li key={item.product_id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{item.product_name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
                            Apagado hace <strong>{formatDuration(item.minutes_off)}</strong>
                            {item.minutes_off >= 60 && <span className="ml-1.5 text-red-300">⚠ más de 1h</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleMutation.mutate({ id: item.product_id, available: true })}
                          disabled={toggleMutation.isPending}
                          className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                          style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                        >
                          ✓ Activar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Historial de faltantes ── */}
              {downtime && downtime.history.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                  <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-orange-400 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Historial de faltantes</h3>
                      <p className="text-xs text-gray-400">Tiempo total apagado por producto — útil para detectar problemas de insumos</p>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                        <th className="text-left px-6 py-3 font-semibold">Producto</th>
                        <th className="text-right px-4 py-3 font-semibold">Incidentes</th>
                        <th className="text-right px-4 py-3 font-semibold">Tiempo total</th>
                        <th className="text-right px-4 py-3 font-semibold">Promedio</th>
                        <th className="text-right px-6 py-3 font-semibold">Último</th>
                      </tr>
                    </thead>
                    <tbody>
                      {downtime.history.map((item, i) => {
                        const isProblematic = item.total_minutes >= 120 || item.incidents >= 3
                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors">
                            <td className="px-6 py-3 font-medium text-gray-800 max-w-[200px] truncate">
                              {isProblematic && <span className="mr-1.5 text-orange-400" title="Alta frecuencia de faltantes">⚠</span>}
                              {item.product_name}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.incidents >= 3 ? 'text-orange-600' : 'text-gray-500'}`}
                                style={{ background: item.incidents >= 3 ? '#fff7ed' : '#f3f4f6' }}>
                                {item.incidents}x
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold tabular-nums"
                              style={{ color: item.total_minutes >= 120 ? '#dc2626' : '#374151' }}>
                              {formatDuration(item.total_minutes)}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-400 tabular-nums">
                              {formatDuration(item.avg_minutes)}
                            </td>
                            <td className="px-6 py-3 text-right text-xs text-gray-400">
                              {new Date(item.last_incident_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!analytics ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl skeleton" />)}
                </div>
              ) : (
                <>
                  {/* Salud de datos */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-6 mb-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldCheck size={15} className="text-sky-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm">Salud de datos</h3>
                            <p className="text-xs text-gray-400">Qué porcentaje del tracking llega válido al backend</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: healthStatus.bg, color: healthStatus.color }}
                            title="Estado actual del tracking"
                          >
                            {healthStatus.label}
                          </span>
                          <button
                            onClick={() => refetchAnalyticsHealth()}
                            disabled={isFetchingAnalyticsHealth}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                            style={{ background: '#f3f4f6', color: '#4b5563' }}
                            title="Actualizar diagnóstico de tracking"
                          >
                            {isFetchingAnalyticsHealth ? 'Actualizando...' : 'Actualizar diagnóstico'}
                          </button>
                        </div>
                      </div>
                      <div className="px-6 py-3 border-b border-gray-50">
                        <p className="text-xs" style={{ color: '#6b7280' }}>
                          Este bloque mide la confiabilidad del tracking. Si bajan los valores, las métricas de negocio pierden precisión.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 p-6">
                        <div className="rounded-2xl border border-gray-100 p-4" style={{ background: '#fafafa' }}>
                          <p className="text-xs text-gray-400">Eventos válidos</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">{analyticsHealth?.accepted_events ?? '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 p-4" style={{ background: '#fff7ed' }}>
                          <p className="text-xs text-orange-400">Eventos rechazados</p>
                          <p className="text-2xl font-bold text-orange-600 mt-1">{analyticsHealth?.rejected_events ?? '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 p-4" style={{ background: '#eff6ff' }}>
                          <p className="text-xs text-blue-400">Tasa de aceptación</p>
                          <p className="text-2xl font-bold text-blue-600 mt-1">
                            {analyticsHealth?.acceptance_rate != null ? `${analyticsHealth.acceptance_rate}%` : '—'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-gray-100 p-4" style={{ background: '#fdf4ff' }}>
                          <p className="text-xs text-fuchsia-400">Sesiones con rechazo</p>
                          <p className="text-2xl font-bold text-fuchsia-600 mt-1">{analyticsHealth?.rejected_sessions ?? '—'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Motivos más frecuentes</h3>
                        <p className="text-xs text-gray-400">Si esto sube, las métricas pierden confiabilidad</p>
                      </div>
                      {!analyticsHealth?.top_rejection_reasons.length ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin rechazos en el período</p>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {analyticsHealth.top_rejection_reasons.map((item, index) => (
                            <li key={`${item.reason}-${index}`} className="px-6 py-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm text-gray-700 break-words">{item.reason}</p>
                              </div>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: '#fff7ed', color: '#ea580c' }}>
                                {item.count}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                      <p className="text-2xl font-bold text-gray-900">{analytics.sessions.total}</p>
                      <p className="text-sm text-gray-400 mt-0.5">Sesiones únicas</p>
                      <div className="mt-3 h-1 rounded-full bg-amber-400/30 w-2/5" />
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                      <p className="text-2xl font-bold text-gray-900">
                        {analytics.avgTime.avg_seconds != null
                          ? `${Math.floor(analytics.avgTime.avg_seconds / 60)}m ${analytics.avgTime.avg_seconds % 60}s`
                          : '—'}
                      </p>
                      <p className="text-sm text-gray-400 mt-0.5">Tiempo promedio</p>
                      <div className="mt-3 h-1 rounded-full bg-emerald-400/30 w-3/5" />
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                      <p className="text-2xl font-bold text-gray-900">{analytics.topSearches.length}</p>
                      <p className="text-sm text-gray-400 mt-0.5">Términos buscados</p>
                      <div className="mt-3 h-1 rounded-full bg-blue-400/30 w-1/3" />
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                      <p className="text-2xl font-bold text-gray-900">
                        {analytics.sessionDepth?.avg_events ?? '—'}
                      </p>
                      <p className="text-sm text-gray-400 mt-0.5">Eventos por sesión</p>
                      <div className="mt-3 h-1 rounded-full bg-purple-400/30 w-1/2" />
                    </div>
                  </div>

                  {/* Tráfico por hora del día */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                      <Clock size={15} className="text-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm">Tráfico por hora del día</h3>
                        <p className="text-xs text-gray-400">Sesiones iniciadas por franja horaria</p>
                      </div>
                      {analytics.hourlyTraffic.some(h => h.sessions > 0) && (() => {
                        const peak = analytics.hourlyTraffic.reduce((a, b) => b.sessions > a.sessions ? b : a)
                        return (
                          <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: '#fef3c7', color: '#d97706' }}>
                            Pico: {String(peak.hour).padStart(2, '0')}:00h
                          </span>
                        )
                      })()}
                    </div>
                    {analytics.hourlyTraffic.every(h => h.sessions === 0) ? (
                      <p className="text-center py-10 text-gray-300 text-sm">Sin datos aún</p>
                    ) : (
                      <div className="px-4 pt-5 pb-4 overflow-x-auto">
                        <div className="flex items-end gap-px" style={{ minWidth: 480, height: 90 }}>
                          {(() => {
                            const maxS = Math.max(...analytics.hourlyTraffic.map(h => h.sessions), 1)
                            return analytics.hourlyTraffic.map(({ hour, sessions }) => {
                              const barH = sessions > 0 ? Math.max(5, (sessions / maxS) * 68) : 3
                              const isPeak = sessions === maxS && sessions > 0
                              const isNight = hour < 6 || hour >= 22
                              return (
                                <div key={hour} className="flex-1 flex flex-col items-center gap-0.5 group relative" style={{ minWidth: 0 }}>
                                  <div
                                    className="w-full rounded-sm transition-all"
                                    style={{
                                      height: barH,
                                      background: isPeak ? '#f59e0b' : sessions > 0 ? (isNight ? '#6366f1' : '#fcd34d') : '#f3f4f6',
                                    }}
                                    title={`${String(hour).padStart(2, '0')}:00 — ${sessions} sesiones`}
                                  />
                                  {hour % 4 === 0 && (
                                    <span style={{ fontSize: 9, color: '#9ca3af', lineHeight: 1.2 }}>
                                      {String(hour).padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                              )
                            })
                          })()}
                        </div>
                        <div className="flex gap-4 mt-2 justify-end">
                          <span className="flex items-center gap-1 text-xs text-gray-400"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#fcd34d' }} />Día</span>
                          <span className="flex items-center gap-1 text-xs text-gray-400"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#6366f1' }} />Noche</span>
                          <span className="flex items-center gap-1 text-xs text-gray-400"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#f59e0b' }} />Pico</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actividad semanal + Scroll depth */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Actividad por día de semana</h3>
                        <p className="text-xs text-gray-400">Sesiones acumuladas por jornada</p>
                      </div>
                      {analytics.weekdayTraffic.every(d => d.sessions === 0) ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin datos aún</p>
                      ) : (
                        <div className="px-5 pt-5 pb-4 flex items-end gap-2" style={{ height: 140 }}>
                          {(() => {
                            const maxS = Math.max(...analytics.weekdayTraffic.map(d => d.sessions), 1)
                            return analytics.weekdayTraffic.map(({ weekday, sessions }) => {
                              const barH = sessions > 0 ? Math.max(5, (sessions / maxS) * 72) : 3
                              const isWeekend = weekday === 'Sáb' || weekday === 'Dom'
                              return (
                                <div key={weekday} className="flex-1 flex flex-col items-center gap-1">
                                  {sessions > 0 && (
                                    <span className="font-bold text-gray-400" style={{ fontSize: 10 }}>{sessions}</span>
                                  )}
                                  <div
                                    className="w-full rounded-t"
                                    style={{ height: barH, background: sessions > 0 ? (isWeekend ? '#10b981' : '#6366f1') : '#f3f4f6' }}
                                  />
                                  <span className="font-medium text-gray-400" style={{ fontSize: 10 }}>{weekday}</span>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Profundidad de scroll</h3>
                        <p className="text-xs text-gray-400">Qué tan lejos llegan los usuarios en el menú</p>
                      </div>
                      {!analytics.scrollDepth.length ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin datos aún</p>
                      ) : (
                        <ul className="px-6 py-5 space-y-4">
                          {[10, 25, 50, 75, 90, 100].map(depth => {
                            const row = analytics.scrollDepth.find(s => Number(s.depth) === depth)
                            const ses = row ? Number(row.sessions) : 0
                            const pct = analytics.sessions.total > 0 ? Math.round((ses / analytics.sessions.total) * 100) : 0
                            const colors = ['#22c55e', '#10b981', '#3b82f6', '#8b5cf6', '#a855f7', '#f59e0b']
                            const labels = ['Primer vistazo', 'Inicio', 'Mitad', 'Casi todo', 'Final', 'Completo']
                            const idx = [10, 25, 50, 75, 90, 100].indexOf(depth)
                            return (
                              <li key={depth} className="flex items-center gap-3">
                                <div className="w-16 flex-shrink-0">
                                  <p className="text-xs font-bold text-gray-600">{depth}%</p>
                                  <p className="text-xs text-gray-400">{labels[idx]}</p>
                                </div>
                                <div className="flex-1 bg-gray-100 rounded-full h-2">
                                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: colors[idx] }} />
                                </div>
                                <span className="text-xs text-gray-500 w-14 text-right flex-shrink-0">{ses} ({pct}%)</span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Eventos más rechazados</h3>
                        <p className="text-xs text-gray-400">Dónde está fallando más el tracking</p>
                      </div>
                      {!analyticsHealth?.rejected_by_event.length ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin rechazos en el período</p>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {analyticsHealth.rejected_by_event.map((item, index) => (
                            <li key={`${item.event}-${index}`} className="px-6 py-3 flex items-center justify-between gap-3">
                              <span className="text-sm text-gray-700">{item.event}</span>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                {item.count}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Rechazos recientes</h3>
                        <p className="text-xs text-gray-400">Últimos errores detectados por el backend</p>
                      </div>
                      {!analyticsHealth?.recent_rejections.length ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin rechazos en el período</p>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {analyticsHealth.recent_rejections.map((item, index) => (
                            <li key={`${item.event}-${item.created_at}-${index}`} className="px-6 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium text-gray-700">{item.event}</span>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                  {new Date(item.created_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-red-500 mt-1 break-words">{item.primary_error}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Top productos vistos + clickeados */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Productos más vistos</h3>
                        <p className="text-xs text-gray-400">Por impresiones reales en pantalla</p>
                      </div>
                      {analytics.topProducts.length === 0 ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin datos aún</p>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {analytics.topProducts.map((p, i) => (
                            <li key={i} className="px-6 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                                <span className="text-sm text-gray-700 truncate">{p.product}</span>
                              </div>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-3" style={{ background: '#fef3c7', color: '#d97706' }}>
                                {p.impressions} vistas
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Productos más clickeados</h3>
                        <p className="text-xs text-gray-400">Abrieron el detalle del plato</p>
                      </div>
                      {analytics.topClicks.length === 0 ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin datos aún</p>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {analytics.topClicks.map((p, i) => (
                            <li key={i} className="px-6 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                                <span className="text-sm text-gray-700 truncate">{p.product}</span>
                              </div>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-3" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                                {p.clicks} clicks
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* CTR por producto */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                      <MousePointerClick size={15} className="text-emerald-500 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">CTR por producto</h3>
                        <p className="text-xs text-gray-400">Ratio clicks / impresiones — qué platos generan más interés</p>
                      </div>
                    </div>
                    {!analytics.productCTR.length ? (
                      <p className="text-center py-10 text-gray-300 text-sm">Sin datos aún</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                            <th className="text-left px-6 py-3 font-semibold">Producto</th>
                            <th className="text-right px-4 py-3 font-semibold">Vistas</th>
                            <th className="text-right px-4 py-3 font-semibold">Clicks</th>
                            <th className="text-left px-6 py-3 font-semibold w-36">CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.productCTR.map((p, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-2.5 text-gray-700 font-medium truncate max-w-[200px]">{p.product}</td>
                              <td className="px-4 py-2.5 text-right text-gray-400 text-xs tabular-nums">{p.impressions}</td>
                              <td className="px-4 py-2.5 text-right text-gray-400 text-xs tabular-nums">{p.clicks}</td>
                              <td className="px-6 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                    <div
                                      className="h-1.5 rounded-full"
                                      style={{ width: `${Math.min(p.ctr ?? 0, 100)}%`, background: '#10b981' }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-emerald-600 w-9 text-right tabular-nums">{p.ctr ?? 0}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Categorías + búsquedas */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Categorías más exploradas</h3>
                        <p className="text-xs text-gray-400">Clicks en filtro de categoría</p>
                      </div>
                      {analytics.topCategories.length === 0 ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin datos aún</p>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {analytics.topCategories.map((c, i) => (
                            <li key={i} className="px-6 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                                <span className="text-sm text-gray-700 truncate">{c.category}</span>
                              </div>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ml-3" style={{ background: '#ecfdf5', color: '#059669' }}>
                                {c.views} clicks
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-50">
                        <h3 className="font-semibold text-gray-900 text-sm">Búsquedas frecuentes</h3>
                        <p className="text-xs text-gray-400">Lo que los clientes buscan y no encuentran</p>
                      </div>
                      {analytics.topSearches.length === 0 ? (
                        <p className="text-center py-10 text-gray-300 text-sm">Sin búsquedas aún</p>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {analytics.topSearches.map((s, i) => (
                            <li key={i} className="px-6 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                                <span className="text-sm font-mono text-gray-700">"{s.query}"</span>
                              </div>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                {s.count}x
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Sesiones por día */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-50">
                      <h3 className="font-semibold text-gray-900 text-sm">Sesiones por día</h3>
                      <p className="text-xs text-gray-400">Últimos 14 días</p>
                    </div>
                    {analytics.recentDays.length === 0 ? (
                      <p className="text-center py-10 text-gray-300 text-sm">Sin datos aún</p>
                    ) : (
                      <ul className="divide-y divide-gray-50">
                        {analytics.recentDays.map((d, i) => (
                          <li key={i} className="px-6 py-3 flex items-center justify-between">
                            <span className="text-sm text-gray-500">{d.day}</span>
                            <div className="flex items-center gap-3">
                              <div
                                className="h-2 rounded-full bg-amber-400/60"
                                style={{ width: `${Math.max(8, (d.sessions / Math.max(...analytics.recentDays.map((x) => x.sessions))) * 120)}px` }}
                              />
                              <span className="text-sm font-bold text-gray-700 w-6 text-right">{d.sessions}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
          {/* ─── SUCURSALES ─── */}
          {tab === 'branches' && (
            <BranchesPanel
              branches={branches}
              onRefresh={refetchBranches}
            />
          )}
        </div>
      </main>

      {/* Modales */}
      {productModal.open && (
        <ProductForm
          product={productModal.product}
          categories={categories}
          onClose={() => setProductModal({ open: false })}
          onSuccess={() => { setProductModal({ open: false }); invalidateAll() }}
        />
      )}
      {categoryModal.open && (
        <CategoryForm
          category={categoryModal.category}
          onClose={() => setCategoryModal({ open: false })}
          onSuccess={() => { setCategoryModal({ open: false }); invalidateAll() }}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal
          message={`¿Eliminar este ${deleteConfirm.type === 'product' ? 'producto' : 'categoría'}? Esta acción no se puede deshacer.`}
          onConfirm={() =>
            deleteConfirm.type === 'product'
              ? deleteProductMutation.mutate(deleteConfirm.id)
              : deleteCategoryMutation.mutate(deleteConfirm.id)
          }
          onCancel={() => setDeleteConfirm(null)}
          loading={deleteProductMutation.isPending || deleteCategoryMutation.isPending}
        />
      )}
    </div>
  )
}
