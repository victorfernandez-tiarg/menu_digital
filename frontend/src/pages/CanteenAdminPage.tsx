import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UtensilsCrossed, Coffee, Apple, Moon, LogOut,
  ClipboardList, ChefHat, Users, Plus, Pencil,
  Trash2, ToggleLeft, ToggleRight, CheckCircle,
  BarChart3, Download, Image as ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import canteenApi from '../lib/canteen-api'
import CanteenAdminDashboard from './CanteenAdminDashboard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CanteenItem {
  id: number
  name: string
  description: string | null
  period: string
  available: number
  order_index: number
  image_url: string | null
  weight_grams: number | null
  calories: number | null
}

interface AdminOrder {
  id: number
  period: string
  date: string
  ordered_at: string
  username: string
  full_name: string
  department: string | null
  shift: string | null
  item_name: string
  item_description: string | null
}

interface CanteenUser {
  id: number
  username: string
  full_name: string
  department: string | null
  role: string
  shift: string | null
  active: number
  created_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const PERIOD_ORDER = ['desayuno', 'almuerzo', 'merienda', 'cena']

export const PERIOD_CONFIG: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  desayuno: { label: 'Desayuno', Icon: Coffee,          color: 'text-amber-600',  bg: 'bg-amber-50' },
  almuerzo: { label: 'Almuerzo', Icon: UtensilsCrossed, color: 'text-teal-600',   bg: 'bg-teal-50' },
  merienda: { label: 'Merienda', Icon: Apple,           color: 'text-orange-500', bg: 'bg-orange-50' },
  cena:     { label: 'Cena',     Icon: Moon,            color: 'text-indigo-600', bg: 'bg-indigo-50' },
}

const SHIFT_LABELS: Record<string, string> = {
  morning:   'Mañana',
  afternoon: 'Tarde',
  night:     'Noche',
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function PedidosPanel() {
  const today = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ['canteen-admin-orders', date],
    queryFn:  () => canteenApi.get('/admin/orders', { params: { date } }).then((r) => r.data),
  })

  const grouped = PERIOD_ORDER.reduce((acc, p) => {
    acc[p] = orders.filter((o) => o.period === p)
    return acc
  }, {} as Record<string, AdminOrder[]>)

  const toggleExpand = (key: string) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const downloadCSV = async () => {
    try {
      const response = await canteenApi.get('/admin/orders/export/csv', {
        params: { date },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `pedidos_${date}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('CSV descargado')
    } catch (err) {
      toast.error('Error al descargar CSV')
    }
  }

  const downloadComanda = async () => {
    try {
      const response = await canteenApi.get('/admin/orders/export/comanda', {
        params: { date },
      })
      const { comanda } = response.data
      
      // Formatear comanda para impresión
      let comandaText = `COMANDA DE COCINA\n`
      comandaText += `Fecha: ${new Date(date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`
      comandaText += `${'='.repeat(60)}\n\n`

      PERIOD_ORDER.forEach(period => {
        const items = comanda[period]
        if (items && items.length > 0) {
          comandaText += `\n📋 ${PERIOD_CONFIG[period].label.toUpperCase()}\n`
          comandaText += `${'-'.repeat(60)}\n`
          items.forEach((item: any) => {
            comandaText += `[${item.qty}x] ${item.name}\n`
            if (item.description) {
              comandaText += `    ${item.description}\n`
            }
          })
        }
      })

      comandaText += `\n${'='.repeat(60)}\n`
      comandaText += `Total de platos a preparar: ${orders.length}\n`
      comandaText += `Hora de impresión: ${new Date().toLocaleTimeString('es-AR')}\n`

      const blob = new Blob([comandaText], { type: 'text/plain; charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comanda_${date}.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Comanda descargada')
    } catch (err) {
      toast.error('Error al descargar comanda')
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar: 2 filas en móvil, 1 fila en sm+ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-gray-500 min-w-0 truncate">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} para esta fecha
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={downloadCSV}
              disabled={orders.length === 0}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              title={orders.length === 0 ? 'Sin pedidos para descargar' : 'Descargar como CSV'}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={downloadComanda}
              disabled={orders.length === 0}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              title={orders.length === 0 ? 'Sin pedidos para comanda' : 'Descargar comanda de cocina'}
            >
              <Download className="w-3.5 h-3.5" />
              Comanda
            </button>
          </div>
        </div>
        <input
          type="date"
          value={date}
          min={today}
          max={nextWeek}
          onChange={(e) => setDate(e.target.value)}
          className="w-full sm:w-auto text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-sm">No hay pedidos para esta fecha</p>
        </div>
      ) : (
        PERIOD_ORDER.map((period) => {
          const pOrders = grouped[period]
          if (!pOrders.length) return null
          const cfg = PERIOD_CONFIG[period]

          // Agrupar por item_name y contar
          const itemsMap = pOrders.reduce((acc, o) => {
            if (!acc[o.item_name]) {
              acc[o.item_name] = { orders: [], name: o.item_name, description: o.item_description }
            }
            acc[o.item_name].orders.push(o)
            return acc
          }, {} as Record<string, { orders: AdminOrder[]; name: string; description: string | null }>)

          const items = Object.values(itemsMap)

          return (
            <div key={period} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className={`flex items-center gap-2 px-4 py-2.5 ${cfg.bg} border-b border-gray-100`}>
                <cfg.Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className="ml-auto text-xs text-gray-500">{pOrders.length} pedido{pOrders.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map((item) => {
                  const key = `${period}-${item.name}`
                  const isExpanded = expandedItems[key]
                  return (
                    <div key={key}>
                      {/* Item agregado */}
                      <button
                        onClick={() => toggleExpand(key)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-teal-100 text-teal-700">
                              ×{item.orders.length}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                          )}
                        </div>
                        <span className="text-gray-400 ml-3 shrink-0">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </button>

                      {/* Detalles expandidos */}
                      {isExpanded && (
                        <div className="bg-gray-50 border-t border-gray-100 divide-y divide-gray-100">
                          {item.orders.map((o) => (
                            <div key={o.id} className="px-4 py-2 flex items-center gap-3 text-xs">
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-700 font-medium">{o.full_name}</p>
                                <p className="text-gray-400">
                                  {o.department ?? '—'}
                                  {o.shift ? ` · ${SHIFT_LABELS[o.shift] ?? o.shift}` : ''}
                                </p>
                              </div>
                              <span className="text-gray-400 shrink-0">
                                {new Date(o.ordered_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Platos panel ──────────────────────────────────────────────────────────────

const BLANK_ITEM = { name: '', description: '', period: 'almuerzo', order_index: 0, image_url: '', weight_grams: '', calories: '' }

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (ev) => {
      const img = new window.Image()
      img.onerror = reject
      img.onload = () => {
        const MAX = 400
        let { width, height } = img
        if (width > height) {
          if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
        } else {
          if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

function PlatosPanel() {
  const queryClient = useQueryClient()
  const [filterPeriod, setFilterPeriod] = useState<string>('all')
  const [showAdd, setShowAdd]           = useState(false)
  const [newItem, setNewItem]           = useState({ ...BLANK_ITEM })
  const [editingItem, setEditingItem]   = useState<CanteenItem | null>(null)
  const [editForm, setEditForm]         = useState({ name: '', description: '', period: '', order_index: 0, image_url: '', weight_grams: '', calories: '' })

  const { data: items = [], isLoading } = useQuery<CanteenItem[]>({
    queryKey: ['canteen-admin-items'],
    queryFn:  () => canteenApi.get('/admin/items').then((r) => r.data),
  })

  const createItem = useMutation({
    mutationFn: (data: typeof BLANK_ITEM) => canteenApi.post('/admin/items', data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-admin-items'] })
      setNewItem({ ...BLANK_ITEM })
      setShowAdd(false)
      toast.success('Plato agregado')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al crear plato'),
  })

  const updateItem = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; description: string; period: string; order_index: number; available: number; image_url: string | null; weight_grams: string; calories: string }) =>
      canteenApi.put(`/admin/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-admin-items'] })
      setEditingItem(null)
      toast.success('Plato actualizado')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al actualizar'),
  })

  const toggleItem = useMutation({
    mutationFn: (item: CanteenItem) =>
      canteenApi.put(`/admin/items/${item.id}`, {
        name: item.name,
        description: item.description,
        period: item.period,
        order_index: item.order_index,
        available: item.available ? 0 : 1,
        image_url: item.image_url,
        weight_grams: item.weight_grams,
        calories: item.calories,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canteen-admin-items'] }),
    onError:   (err: any) => toast.error(err.response?.data?.error || 'Error'),
  })

  const deleteItem = useMutation({
    mutationFn: (id: number) => canteenApi.delete(`/admin/items/${id}`),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-admin-items'] })
      toast.success('Plato eliminado')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al eliminar'),
  })

  const startEdit = (item: CanteenItem) => {
    setEditingItem(item)
    setEditForm({ name: item.name, description: item.description ?? '', period: item.period, order_index: item.order_index, image_url: item.image_url ?? '', weight_grams: item.weight_grams?.toString() ?? '', calories: item.calories?.toString() ?? '' })
  }

  const filtered = filterPeriod === 'all' ? items : items.filter((i) => i.period === filterPeriod)

  return (
    <div className="space-y-4">
      {/* Filter + Add button */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', ...PERIOD_ORDER] as string[]).map((p) => {
            const cfg = p === 'all' ? null : PERIOD_CONFIG[p]
            return (
              <button
                key={p}
                onClick={() => setFilterPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                  filterPeriod === p ? 'bg-gray-800 text-white border-transparent' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {cfg && <cfg.Icon className="w-3.5 h-3.5" />}
                {cfg ? cfg.label : 'Todos'}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar plato
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-teal-800">Agregar nuevo plato</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Milanesa con puré"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                aria-label="Nombre del plato"
                aria-required="true"
                aria-invalid={newItem.name.length > 0 && !newItem.name.trim()}
                className={`w-full text-sm text-gray-900 placeholder-gray-500 border-2 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-all ${
                  newItem.name.trim() ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                  newItem.name !== '' ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
                  'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
                }`}
              />
              {!newItem.name.trim() && newItem.name !== '' && (
                <p className="text-xs text-red-600 mt-1">✗ El nombre es obligatorio</p>
              )}
              {newItem.name.trim() && (
                <p className="text-xs text-green-600 mt-1">✓ Nombre válido</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Período</label>
              <select
                value={newItem.period}
                onChange={(e) => setNewItem({ ...newItem, period: e.target.value })}
                aria-label="Período del día"
                className="w-full text-sm text-gray-900 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              >
                {PERIOD_ORDER.map((p) => (
                  <option key={p} value={p}>{PERIOD_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción (opcional)</label>
              <input
                type="text"
                placeholder="Ej: Acompañado con puré casero"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                aria-label="Descripción del plato"
                maxLength={100}
                className="w-full text-sm text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">{newItem.description.length}/100 caracteres</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Peso (g) <span className="font-normal text-gray-400">opcional</span></label>
              <input
                type="number"
                min="0"
                placeholder="Ej: 380"
                value={newItem.weight_grams}
                onChange={(e) => setNewItem({ ...newItem, weight_grams: e.target.value })}
                aria-label="Peso en gramos"
                className="w-full text-sm text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Calorías (kcal) <span className="font-normal text-gray-400">opcional</span></label>
              <input
                type="number"
                min="0"
                placeholder="Ej: 620"
                value={newItem.calories}
                onChange={(e) => setNewItem({ ...newItem, calories: e.target.value })}
                aria-label="Calorías en kcal"
                className="w-full text-sm text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-2">Imagen (opcional)</label>
              <div className="flex items-center gap-3">
                {newItem.image_url ? (
                  <div className="relative shrink-0">
                    <img src={newItem.image_url} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                    <button type="button" onClick={() => setNewItem({ ...newItem, image_url: '' })} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 leading-none" aria-label="Quitar imagen">×</button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 shrink-0 text-2xl">🍽️</div>
                )}
                <div className="space-y-1">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {newItem.image_url ? 'Cambiar' : 'Subir imagen'}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setNewItem({ ...newItem, image_url: await compressImage(file) }) }} />
                  </label>
                  <p className="text-xs text-gray-400">Máx. 400×400 px · JPEG</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button 
              onClick={() => setShowAdd(false)} 
              disabled={createItem.isPending} 
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
            <div className="flex flex-col items-end">
              <button
                onClick={() => createItem.mutate(newItem)}
                disabled={createItem.isPending || !newItem.name.trim()}
                aria-busy={createItem.isPending}
                title={!newItem.name.trim() ? 'Completa el nombre del plato' : ''}
                className="px-4 py-1.5 text-sm font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 active:bg-teal-900 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow disabled:shadow-none"
              >
                {createItem.isPending ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Guardando…</span>
                  </>
                ) : (
                  'Guardar'
                )}
              </button>
              {!newItem.name.trim() && (
                <p className="text-xs text-red-600 mt-1">⚠ Campo requerido</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-sm">Sin platos configurados para este período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const cfg = PERIOD_CONFIG[item.period]
            const isEditing = editingItem?.id === item.id
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border ${isEditing ? 'border-teal-300' : 'border-gray-200'} overflow-hidden`}
              >
                {isEditing ? (
                  <div className="p-4 space-y-3 bg-teal-50">
                    <p className="text-xs font-semibold text-teal-800">Editar plato</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Nombre del plato"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          aria-label="Nombre del plato"
                          aria-required="true"
                          aria-invalid={editForm.name.length > 0 && !editForm.name.trim()}
                          className={`w-full text-sm text-gray-900 placeholder-gray-500 border-2 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-all ${
                            editForm.name.trim() ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                            editForm.name !== '' ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
                            'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
                          }`}
                        />
                        {!editForm.name.trim() && editForm.name !== '' && (
                          <p className="text-xs text-red-600 mt-1">✗ El nombre es obligatorio</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Período</label>
                        <select
                          value={editForm.period}
                          onChange={(e) => setEditForm({ ...editForm, period: e.target.value })}
                          aria-label="Período del día"
                          className="w-full text-sm text-gray-900 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                        >
                          {PERIOD_ORDER.map((p) => (
                            <option key={p} value={p}>{PERIOD_CONFIG[p].label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción (opcional)</label>
                        <input
                          type="text"
                          placeholder="Descripción del plato"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          aria-label="Descripción del plato"
                          maxLength={100}
                          className="w-full text-sm text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">{editForm.description.length}/100 caracteres</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Peso (g) <span className="font-normal text-gray-400">opcional</span></label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Ej: 380"
                          value={editForm.weight_grams}
                          onChange={(e) => setEditForm({ ...editForm, weight_grams: e.target.value })}
                          aria-label="Peso en gramos"
                          className="w-full text-sm text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Calorías (kcal) <span className="font-normal text-gray-400">opcional</span></label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Ej: 620"
                          value={editForm.calories}
                          onChange={(e) => setEditForm({ ...editForm, calories: e.target.value })}
                          aria-label="Calorías en kcal"
                          className="w-full text-sm text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Imagen (opcional)</label>
                        <div className="flex items-center gap-3">
                          {editForm.image_url ? (
                            <div className="relative shrink-0">
                              <img src={editForm.image_url} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                              <button type="button" onClick={() => setEditForm({ ...editForm, image_url: '' })} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 leading-none" aria-label="Quitar imagen">×</button>
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 shrink-0 text-2xl">🍽️</div>
                          )}
                          <div className="space-y-1">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors">
                              <ImageIcon className="w-3.5 h-3.5" />
                              {editForm.image_url ? 'Cambiar' : 'Subir imagen'}
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setEditForm({ ...editForm, image_url: await compressImage(file) }) }} />
                            </label>
                            <p className="text-xs text-gray-400">Máx. 400×400 px · JPEG</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button 
                        onClick={() => setEditingItem(null)} 
                        disabled={updateItem.isPending} 
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                      >
                        Cancelar
                      </button>
                      <div className="flex flex-col items-end">
                        <button
                          onClick={() => updateItem.mutate({ id: item.id, ...editForm, available: item.available })}
                          disabled={updateItem.isPending || !editForm.name.trim()}
                          aria-busy={updateItem.isPending}
                          title={!editForm.name.trim() ? 'Completa el nombre del plato' : ''}
                          className="px-4 py-1.5 text-sm font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 active:bg-teal-900 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow disabled:shadow-none"
                        >
                          {updateItem.isPending ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Guardando…</span>
                            </>
                          ) : (
                            'Guardar cambios'
                          )}
                        </button>
                        {!editForm.name.trim() && (
                          <p className="text-xs text-red-600 mt-1">⚠ Campo requerido</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 flex items-center gap-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-100" />
                    ) : (
                      <div className={`shrink-0 p-1.5 rounded-lg ${cfg.bg}`}>
                        <cfg.Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${item.available ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 truncate">{item.description}</p>
                      )}
                      {(item.weight_grams || item.calories) && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                          {item.weight_grams && <span>⚖️ {item.weight_grams}g</span>}
                          {item.weight_grams && item.calories && <span className="text-gray-300">·</span>}
                          {item.calories && <span>🔥 {item.calories} kcal</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleItem.mutate(item)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors" title={item.available ? 'Deshabilitar' : 'Habilitar'}>
                        {item.available ? <ToggleRight className="w-4 h-4 text-teal-500" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => startEdit(item)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar "${item.name}"?`)) deleteItem.mutate(item.id)
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Personal panel ─────────────────────────────────────────────────────────────

const BLANK_USER = { username: '', password: '', full_name: '', department: '', role: 'staff', shift: 'morning' }

function PersonalPanel() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ ...BLANK_USER })

  const { data: users = [], isLoading } = useQuery<CanteenUser[]>({
    queryKey: ['canteen-admin-users'],
    queryFn:  () => canteenApi.get('/admin/users').then((r) => r.data),
  })

  const createUser = useMutation({
    mutationFn: (data: typeof BLANK_USER) => canteenApi.post('/admin/users', data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-admin-users'] })
      setNewUser({ ...BLANK_USER })
      setShowAdd(false)
      toast.success('Usuario creado')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al crear usuario'),
  })

  const toggleUser = useMutation({
    mutationFn: (id: number) => canteenApi.put(`/admin/users/${id}/toggle`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['canteen-admin-users'] }),
    onError:    (err: any) => toast.error(err.response?.data?.error || 'Error'),
  })

  const admins = users.filter((u) => u.role === 'admin')
  const staff  = users.filter((u) => u.role === 'staff')

  const UserRow = ({ u }: { u: CanteenUser }) => (
    <div className={`px-4 py-3 flex items-center gap-3 ${!u.active ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
        <p className="text-xs text-gray-400 truncate">
          @{u.username}
          {u.department ? ` · ${u.department}` : ''}
          {u.shift ? ` · ${SHIFT_LABELS[u.shift] ?? u.shift}` : ''}
        </p>
      </div>
      {u.active ? (
        <CheckCircle className="w-4 h-4 text-teal-500 shrink-0" />
      ) : (
        <span className="text-xs text-gray-400 shrink-0">inactivo</span>
      )}
      <button
        onClick={() => toggleUser.mutate(u.id)}
        className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
        title={u.active ? 'Desactivar' : 'Activar'}
      >
        {u.active ? <ToggleRight className="w-4 h-4 text-teal-500" /> : <ToggleLeft className="w-4 h-4" />}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar usuario
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-teal-800">Agregar nuevo usuario</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Usuario <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="nombre_usuario"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                aria-label="Nombre de usuario"
                aria-required="true"
                aria-invalid={newUser.username.length > 0 && !newUser.username.trim()}
                className={`w-full text-sm text-gray-900 placeholder-gray-500 border-2 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-all ${
                  newUser.username.trim() ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                  newUser.username !== '' ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
                  'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
                }`}
              />
              {!newUser.username.trim() && newUser.username !== '' && (
                <p className="text-xs text-red-600 mt-1">✗ Campo obligatorio</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="•••••••• (mín. 6 caracteres)"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                aria-label="Contraseña"
                aria-required="true"
                aria-invalid={newUser.password.length > 0 && newUser.password.length < 6}
                className={`w-full text-sm text-gray-900 placeholder-gray-500 border-2 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-all ${
                  newUser.password && newUser.password.length >= 6 ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                  newUser.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
                  'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
                }`}
              />
              {newUser.password && newUser.password.length < 6 && (
                <p className="text-xs text-red-600 mt-1">✗ Mínimo 6 caracteres ({newUser.password.length}/6)</p>
              )}
              {newUser.password && newUser.password.length >= 6 && (
                <p className="text-xs text-green-600 mt-1">✓ Contraseña válida</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Juan García"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                aria-label="Nombre completo"
                aria-required="true"
                aria-invalid={newUser.full_name.length > 0 && !newUser.full_name.trim()}
                className={`w-full text-sm text-gray-900 placeholder-gray-500 border-2 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-all ${
                  newUser.full_name.trim() ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                  newUser.full_name !== '' ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
                  'border-gray-300 focus:ring-teal-500 focus:border-teal-500'
                }`}
              />
              {!newUser.full_name.trim() && newUser.full_name !== '' && (
                <p className="text-xs text-red-600 mt-1">✗ Campo obligatorio</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Área / Departamento</label>
              <input
                type="text"
                placeholder="Ej: Enfermería"
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                aria-label="Departamento"
                className="w-full text-sm text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Rol</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                aria-label="Rol del usuario"
                className="w-full text-sm text-gray-900 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              >
                <option value="staff">Personal (Staff)</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {newUser.role === 'staff' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Turno</label>
                <select
                  value={newUser.shift}
                  onChange={(e) => setNewUser({ ...newUser, shift: e.target.value })}
                  aria-label="Turno de trabajo"
                  className="w-full text-sm text-gray-900 border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                >
                  <option value="morning">Turno Mañana (Desayuno + Almuerzo)</option>
                  <option value="afternoon">Turno Tarde (Almuerzo + Merienda + Cena)</option>
                  <option value="night">Turno Noche (Cena + Desayuno)</option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">✓ Requisitos:</p>
            <ul className="space-y-1 text-xs text-gray-600">
              <li className={newUser.username.trim() ? '✓ text-green-600' : '○ text-gray-400'}>
                <span className={newUser.username.trim() ? 'text-green-600' : 'text-gray-400'}>
                  {newUser.username.trim() ? '✓' : '○'} Usuario único (alfanumérico)
                </span>
              </li>
              <li className={newUser.password && newUser.password.length >= 6 ? 'text-green-600' : 'text-gray-400'}>
                <span className={newUser.password && newUser.password.length >= 6 ? 'text-green-600' : 'text-gray-400'}>
                  {newUser.password && newUser.password.length >= 6 ? '✓' : '○'} Contraseña mínimo 6 caracteres
                </span>
              </li>
              <li className={newUser.full_name.trim() ? 'text-green-600' : 'text-gray-400'}>
                <span className={newUser.full_name.trim() ? 'text-green-600' : 'text-gray-400'}>
                  {newUser.full_name.trim() ? '✓' : '○'} Nombre completo
                </span>
              </li>
            </ul>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button 
              onClick={() => setShowAdd(false)} 
              disabled={createUser.isPending} 
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg disabled:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
            <div className="flex flex-col items-end">
              <button
                onClick={() => createUser.mutate(newUser)}
                disabled={createUser.isPending || !newUser.username.trim() || !newUser.full_name.trim() || !newUser.password || newUser.password.length < 6}
                aria-busy={createUser.isPending}
                title={
                  !newUser.username.trim() ? 'Completa el usuario' :
                  !newUser.full_name.trim() ? 'Completa el nombre' :
                  !newUser.password ? 'Ingresa contraseña' :
                  newUser.password.length < 6 ? 'Contraseña muy corta (mín. 6)' :
                  ''
                }
                className="px-4 py-1.5 text-sm font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 active:bg-teal-900 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow disabled:shadow-none"
              >
                {createUser.isPending ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creando…</span>
                  </>
                ) : (
                  'Crear usuario'
                )}
              </button>
              {createUser.isPending === false && (!newUser.username.trim() || !newUser.full_name.trim() || !newUser.password || newUser.password.length < 6) && (
                <p className="text-xs text-red-600 mt-1">⚠ Completa todos los campos requeridos</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {admins.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                Administradores
              </p>
              <div className="divide-y divide-gray-50">
                {admins.map((u) => <UserRow key={u.id} u={u} />)}
              </div>
            </div>
          )}
          {staff.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                Personal
              </p>
              <div className="divide-y divide-gray-50">
                {staff.map((u) => <UserRow key={u.id} u={u} />)}
              </div>
            </div>
          )}
          {users.length === 0 && (
            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
              <p className="text-sm">No hay usuarios registrados</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'pedidos' | 'platos' | 'personal'

export default function CanteenAdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('canteen_token')
    localStorage.removeItem('canteen_role')
    localStorage.removeItem('canteen_user')
    navigate('/comedor/login')
  }

  const TABS: { key: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
    { key: 'pedidos',  label: 'Pedidos',  Icon: ClipboardList },
    { key: 'platos',   label: 'Platos',   Icon: ChefHat },
    { key: 'personal', label: 'Personal', Icon: Users },
  ]

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-clip">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-600 shrink-0">
              <UtensilsCrossed className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">Sistema de Viandas</p>
              <p className="text-xs text-gray-400 leading-tight">Panel de administración</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto">
          <div className="flex w-full border-b border-gray-100">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                title={label}
                aria-label={label}
                className={`flex flex-1 items-center justify-center gap-1 sm:gap-1.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                  tab === key
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        {tab === 'dashboard' && <CanteenAdminDashboard />}
        {tab === 'pedidos'  && <PedidosPanel />}
        {tab === 'platos'   && <PlatosPanel />}
        {tab === 'personal' && <PersonalPanel />}
      </main>
    </div>
  )
}
