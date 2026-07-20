import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UtensilsCrossed, Coffee, Apple, Moon, LogOut,
  CheckCircle, ShieldCheck, History, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import canteenApi from '../lib/canteen-api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CanteenUser {
  id: number
  username: string
  full_name: string
  department: string | null
  role: string
  shift: string | null
  available_periods: string[]
}

interface CanteenItem {
  id: number
  name: string
  description: string | null
  period: string
  available: number
  order_index: number
  image_url: string | null
}

interface CanteenOrder {
  id: number
  period: string
  date: string
  ordered_at: string
  item_id: number
  item_name: string
  item_description: string | null
}

interface HistoryOrder extends CanteenOrder {
  can_cancel: number
}

interface MenuData {
  periods: string[]
  menu: Record<string, CanteenItem[]>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIOD_ORDER = ['desayuno', 'almuerzo', 'merienda', 'cena']

const PERIOD_CONFIG: Record<
  string,
  {
    label: string
    Icon: React.ComponentType<{ className?: string }>
    color: string
    lightBg: string
    border: string
    activeBg: string
  }
> = {
  desayuno: { label: 'Desayuno', Icon: Coffee,          color: 'text-amber-600',  lightBg: 'bg-amber-50',  border: 'border-amber-300',  activeBg: 'bg-amber-600' },
  almuerzo: { label: 'Almuerzo', Icon: UtensilsCrossed, color: 'text-teal-600',   lightBg: 'bg-teal-50',   border: 'border-teal-300',   activeBg: 'bg-teal-600' },
  merienda: { label: 'Merienda', Icon: Apple,           color: 'text-orange-500', lightBg: 'bg-orange-50', border: 'border-orange-300', activeBg: 'bg-orange-500' },
  cena:     { label: 'Cena',     Icon: Moon,            color: 'text-indigo-600', lightBg: 'bg-indigo-50', border: 'border-indigo-300', activeBg: 'bg-indigo-600' },
}

const SHIFT_LABELS: Record<string, string> = {
  morning:   'Turno Mañana',
  afternoon: 'Turno Tarde',
  night:     'Turno Noche',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CanteenPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const user: CanteenUser | null = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('canteen_user') ?? '') }
    catch { return null }
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [tab, setTab] = useState<'pedir' | 'historial'>('pedir')

  const sortedPeriods = useMemo(
    () =>
      [...(user?.available_periods ?? [])].sort(
        (a, b) => PERIOD_ORDER.indexOf(a) - PERIOD_ORDER.indexOf(b)
      ),
    [user]
  )

  const [selectedPeriod, setSelectedPeriod] = useState<string>(sortedPeriods[0] ?? 'desayuno')

  const { data: menuData, isLoading: menuLoading } = useQuery<MenuData>({
    queryKey: ['canteen-menu'],
    queryFn:  () => canteenApi.get('/menu').then((r) => r.data),
    enabled:  !!user,
  })

  const { data: myOrders = [], isLoading: ordersLoading } = useQuery<CanteenOrder[]>({
    queryKey: ['canteen-orders-mine', user?.id, selectedDate],
    queryFn:  () => canteenApi.get('/orders/mine', { params: { date: selectedDate } }).then((r) => r.data),
    enabled:  !!user,
  })

  const { data: historyOrders = [], isLoading: historyLoading } = useQuery<HistoryOrder[]>({
    queryKey: ['canteen-orders-history', user?.id],
    queryFn:  () => canteenApi.get('/orders/history').then((r) => r.data),
    enabled:  !!user,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const ordersByPeriod = useMemo(() => {
    const map: Record<string, CanteenOrder> = {}
    for (const o of myOrders) map[o.period] = o
    return map
  }, [myOrders])

  const placeOrder = useMutation({
    mutationFn: (item_id: number) => canteenApi.post('/orders', { item_id, date: selectedDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-orders-mine'] })
      queryClient.invalidateQueries({ queryKey: ['canteen-orders-history'] })
      toast.success('¡Pedido registrado!')
    },
    onError: (err: any) => {
      const errorCode = err.response?.data?.code
      const errorMsg = err.response?.data?.error || 'Error al pedir'

      // Si el plato fue deshabilitado, refrescar menú automáticamente
      if (errorCode === 'ITEM_DISABLED') {
        queryClient.invalidateQueries({ queryKey: ['canteen-menu'] })
        toast.error(errorMsg, { 
          duration: 4000,
          icon: '🚫'
        })
      } else {
        toast.error(errorMsg)
      }
    },
  })

  const cancelOrder = useMutation({
    mutationFn: (id: number) => canteenApi.delete(`/orders/${id}`),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-orders-mine'] })
      queryClient.invalidateQueries({ queryKey: ['canteen-orders-history'] })
      toast.success('Pedido cancelado')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Error al cancelar'),
  })

  const handleLogout = () => {
    queryClient.clear()
    localStorage.removeItem('canteen_token')
    localStorage.removeItem('canteen_role')
    localStorage.removeItem('canteen_user')
    navigate('/comedor/login')
  }

  if (!user) {
    navigate('/comedor/login')
    return null
  }

  const currentItems   = menuData?.menu[selectedPeriod] ?? []
  const periodOrder    = ordersByPeriod[selectedPeriod]
  const cfg            = PERIOD_CONFIG[selectedPeriod]
  const orderedCount   = Object.keys(ordersByPeriod).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-600 shrink-0">
              <UtensilsCrossed className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">
              Sistema de Viandas
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 leading-tight">{user.full_name}</p>
              {user.department && (
                <p className="text-xs text-gray-400 leading-tight">{user.department}</p>
              )}
            </div>
            {user.shift && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700 whitespace-nowrap">
                {SHIFT_LABELS[user.shift] ?? user.shift}
              </span>
            )}
            {user.role === 'admin' && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setTab('pedir')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'pedir'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            Pedir
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'historial'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4" />
            Historial
            {historyOrders.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-teal-100 text-teal-700">
                {historyOrders.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* ── Pestaña: Pedir ── */}
        {tab === 'pedir' && (
        <>
        {/* ── Date selector ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="date-picker" className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Selecciona fecha
            </label>
            <span className="text-xs text-gray-500">
              {selectedDate === today ? '📍 Hoy' : 
               selectedDate === nextDay ? '📍 Mañana' :
               '📍 ' + new Date(selectedDate).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="date-picker"
              type="date"
              value={selectedDate}
              min={today}
              max={tomorrow}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Selector de fecha para pedir"
              aria-describedby="date-help-text"
              className="text-sm border-2 border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700 focus:bg-teal-50 transition-all hover:border-gray-400"
            />
            {selectedDate !== today && (
              <button
                onClick={() => setSelectedDate(today)}
                className="text-xs px-2.5 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg font-medium transition-colors"
                title="Volver a hoy"
              >
                Hoy
              </button>
            )}
          </div>
          <p id="date-help-text" className="text-xs text-gray-600 flex items-center gap-1">
            <span>✓ Podés pedir para:</span> hoy hasta en 7 días
          </p>
        </div>

        {/* ── Summary / Period tabs ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Períodos disponibles
            </p>
            {orderedCount > 0 && (
              <span className="text-xs text-teal-600 font-medium">
                {orderedCount} pedido{orderedCount !== 1 ? 's' : ''} {selectedDate !== today ? `el ${new Date(selectedDate).toLocaleDateString('es-AR')}` : 'hoy'}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {sortedPeriods.map((p) => {
              const c       = PERIOD_CONFIG[p]
              const ordered = !!ordersByPeriod[p]
              const active  = selectedPeriod === p
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    active
                      ? `${c.activeBg} text-white border-transparent shadow-sm`
                      : ordered
                      ? `${c.color} ${c.lightBg} ${c.border}`
                      : 'text-gray-500 bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <c.Icon className="w-4 h-4" />
                  {c.label}
                  {ordered && !active && <CheckCircle className="w-3.5 h-3.5" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Period header ── */}
        {cfg && (
          <div className={`flex items-center gap-2 ${cfg.color}`}>
            <cfg.Icon className="w-5 h-5" />
            <h2 className="font-semibold text-base">{cfg.label}</h2>
          </div>
        )}

        {/* ── Items list ── */}
        {menuLoading || ordersLoading ? (
          <div className="flex justify-center py-14">
            <span className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Already ordered banner */}
            {periodOrder && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-green-700">Pedido registrado</p>
                    <p className="text-sm font-semibold text-green-900 truncate">{periodOrder.item_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => cancelOrder.mutate(periodOrder.id)}
                  disabled={cancelOrder.isPending}
                  aria-busy={cancelOrder.isPending}
                  className="text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    color: cancelOrder.isPending ? '#9CA3AF' : '#EF4444'
                  }}
                >
                  {cancelOrder.isPending ? (
                    <>
                      <span className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                      <span>Cancelando…</span>
                    </>
                  ) : (
                    'Cancelar'
                  )}
                </button>
              </div>
            )}

            {/* Items */}
            {currentItems.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
                <p className="text-sm">Todos los platos están deshabilitados para este período</p>
              </div>
            ) : (
              currentItems.map((item) => {
                const isOrdered  = periodOrder?.item_id === item.id
                const isDisabled = !!periodOrder && !isOrdered

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border p-4 flex items-center gap-3 transition-opacity ${
                      isDisabled  ? 'opacity-35 pointer-events-none' : ''
                    } ${isOrdered ? 'border-green-300' : 'border-gray-200'}`}
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-gray-100"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${isOrdered ? 'text-green-800' : 'text-gray-900'}`}>
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{item.description}</p>
                      )}
                    </div>

                    {isOrdered ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-semibold shrink-0">
                        <CheckCircle className="w-4 h-4" /> Pedido
                      </span>
                    ) : (
                      <button
                        onClick={() => placeOrder.mutate(item.id)}
                        disabled={placeOrder.isPending}
                        aria-busy={placeOrder.isPending}
                        className="px-3.5 py-1.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg transition-all duration-200 flex items-center gap-1.5 shrink-0 shadow-sm hover:shadow disabled:shadow-none"
                      >
                        {placeOrder.isPending ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Pidiendo…</span>
                          </>
                        ) : (
                          'Pedir'
                        )}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
        </>
        )}

        {/* ── Pestaña: Historial ── */}
        {tab === 'historial' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-teal-700" />
              Mis pedidos
            </h2>
            {historyOrders.length > 0 && (
              <span className="text-xs text-gray-400">{historyOrders.length} pedido{historyOrders.length !== 1 ? 's' : ''} — 30 días</span>
            )}
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-12">
              <span className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : historyOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
              <p className="text-sm">No tienes pedidos en los últimos 30 días</p>
            </div>
          ) : (() => {
            // Separar futuros (> hoy) de pasados/hoy (<= hoy)
            const futureOrders   = historyOrders.filter(o => o.date > today)
            const pastOrders     = historyOrders.filter(o => o.date <= today)

            // Agrupar por fecha
            const grouped = (list: HistoryOrder[]) =>
              list.reduce((acc, order) => {
                if (!acc[order.date]) acc[order.date] = []
                acc[order.date].push(order)
                return acc
              }, {} as Record<string, HistoryOrder[]>)

            const tomorrow = nextDay

            const dayLabel = (date: string) => {
              if (date === today)    return '📍 Hoy'
              if (date === tomorrow) return '📅 Mañana'
              const d = new Date(date + 'T00:00:00')
              return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
            }

            const renderGroup = (groupedDates: Record<string, HistoryOrder[]>, isFuture: boolean) => {
              const sortedDates = Object.keys(groupedDates).sort((a, b) =>
                isFuture ? a.localeCompare(b) : b.localeCompare(a)
              )
              return sortedDates.map((date) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      date === today   ? 'bg-teal-100 text-teal-700' :
                      isFuture         ? 'bg-blue-100 text-blue-700' :
                                         'bg-gray-100 text-gray-600'
                    }`}>
                      {dayLabel(date)}
                    </span>
                    <span className="text-xs text-gray-300">
                      {groupedDates[date].length} plato{groupedDates[date].length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {groupedDates[date].map((order) => {
                      const cfg = PERIOD_CONFIG[order.period]
                      const isToday = date === today
                      return (
                        <div key={order.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow ${
                          isFuture && !isToday ? 'border-blue-100' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${cfg.activeBg}`}>
                              <cfg.Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 text-sm truncate">{order.item_name}</p>
                              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                              {order.item_description && (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{order.item_description}</p>
                              )}
                            </div>
                          </div>

                          {isToday && order.can_cancel ? (
                            <button
                              onClick={() => cancelOrder.mutate(order.id)}
                              disabled={cancelOrder.isPending}
                              aria-busy={cancelOrder.isPending}
                              className="text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {cancelOrder.isPending ? (
                                <>
                                  <span className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                                  <span>Cancelando…</span>
                                </>
                              ) : (
                                <><Trash2 className="w-3 h-3" /> Cancelar</>
                              )}
                            </button>
                          ) : isFuture ? (
                            <button
                              onClick={() => cancelOrder.mutate(order.id)}
                              disabled={cancelOrder.isPending}
                              aria-busy={cancelOrder.isPending}
                              className="text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {cancelOrder.isPending ? (
                                <>
                                  <span className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                                  <span>Cancelando…</span>
                                </>
                              ) : (
                                <><Trash2 className="w-3 h-3" /> Cancelar</>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300 shrink-0">Entregado</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            }

            return (
              <div className="space-y-5">
                {/* Pedidos futuros */}
                {futureOrders.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Próximos</span>
                      <span className="flex-1 h-px bg-blue-100" />
                      <span className="text-xs text-blue-400">{futureOrders.length} pedido{futureOrders.length !== 1 ? 's' : ''}</span>
                    </div>
                    {renderGroup(grouped(futureOrders), true)}
                  </div>
                )}

                {/* Pedidos de hoy y pasados */}
                {pastOrders.length > 0 && (
                  <div className="space-y-4">
                    {futureOrders.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Historial</span>
                        <span className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400">{pastOrders.length} pedido{pastOrders.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {renderGroup(grouped(pastOrders), false)}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
        )}
      </main>
    </div>
  )
}
