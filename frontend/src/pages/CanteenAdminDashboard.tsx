import { useQuery } from '@tanstack/react-query'
import { TrendingUp, AlertTriangle, ChefHat, UtensilsCrossed } from 'lucide-react'
import canteenApi from '../lib/canteen-api'
import { PERIOD_CONFIG, PERIOD_ORDER } from './CanteenAdminPage'

interface Summary {
  date: string
  total: number
  byPeriod: Array<{ period: string; count: number }>
}

interface TopItem {
  id: number
  name: string
  description: string | null
  period: string
  order_count: number
}

interface DisabledItem {
  id: number
  name: string
  description: string | null
  period: string
}

export default function CanteenAdminDashboard() {
  // Resumen de hoy
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['canteen-admin-dashboard-summary'],
    queryFn: async () => {
      const { data } = await canteenApi.get<Summary>('/admin/dashboard/summary')
      return data
    },
    refetchInterval: 30000, // Refresh cada 30s
  })

  // Top 3 platos más solicitados
  const { data: topItems, isLoading: topLoading } = useQuery({
    queryKey: ['canteen-admin-dashboard-top-items'],
    queryFn: async () => {
      const { data } = await canteenApi.get<TopItem[]>('/admin/dashboard/top-items')
      return data
    },
    refetchInterval: 30000,
  })

  // Items deshabilitados
  const { data: disabledItems, isLoading: disabledLoading } = useQuery({
    queryKey: ['canteen-admin-dashboard-disabled-items'],
    queryFn: async () => {
      const { data } = await canteenApi.get<DisabledItem[]>('/admin/dashboard/disabled-items')
      return data
    },
    refetchInterval: 60000,
  })

  return (
    <div className="space-y-6">
      {/* ── Título ── */}
      <div className="flex items-center gap-2">
        <ChefHat className="w-6 h-6 text-teal-700" />
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <span className="text-xs text-gray-500">
          {summary?.date ? new Date(summary.date).toLocaleDateString('es-AR', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Hoy'}
        </span>
      </div>

      {/* ── Resumen de Hoy (Cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Pedidos</p>
          <p className="text-3xl font-bold text-teal-700 mt-2">
            {summaryLoading ? '—' : summary?.total ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">Hoy</p>
        </div>

        {/* Desayuno */}
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Desayuno</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">
            {summaryLoading ? '—' : summary?.byPeriod?.find(p => p.period === 'desayuno')?.count ?? 0}
          </p>
          <p className="text-xs text-yellow-600 mt-1">☕</p>
        </div>

        {/* Almuerzo */}
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Almuerzo</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            {summaryLoading ? '—' : summary?.byPeriod?.find(p => p.period === 'almuerzo')?.count ?? 0}
          </p>
          <p className="text-xs text-orange-600 mt-1">🍽️</p>
        </div>

        {/* Merienda */}
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Merienda</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">
            {summaryLoading ? '—' : summary?.byPeriod?.find(p => p.period === 'merienda')?.count ?? 0}
          </p>
          <p className="text-xs text-purple-600 mt-1">🥐</p>
        </div>

        {/* Cena */}
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Cena</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">
            {summaryLoading ? '—' : summary?.byPeriod?.find(p => p.period === 'cena')?.count ?? 0}
          </p>
          <p className="text-xs text-indigo-600 mt-1">🌙</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Platos Más Solicitados ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-teal-700" />
            <h3 className="font-semibold text-gray-900">Top 3 Platos Hoy</h3>
          </div>

          {topLoading ? (
            <div className="flex justify-center py-8">
              <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : topItems && topItems.length > 0 ? (
            <div className="space-y-3">
              {topItems.map((item, idx) => {
                const cfg = PERIOD_CONFIG[item.period as keyof typeof PERIOD_CONFIG]
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'

                return (
                  <div key={item.id} className="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-0">
                    <span className="text-2xl">{medal}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${cfg.color}`} />
                        <span className="text-xs text-gray-500">{cfg.label}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-teal-700">{item.order_count}</p>
                      <p className="text-xs text-gray-500">pedidos</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Ningún pedido registrado hoy</p>
            </div>
          )}
        </div>

        {/* ── Viandas Sin Stock ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Viandas Deshabilitadas</h3>
            {disabledItems && disabledItems.length > 0 && (
              <span className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                {disabledItems.length}
              </span>
            )}
          </div>

          {disabledLoading ? (
            <div className="flex justify-center py-8">
              <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : disabledItems && disabledItems.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {PERIOD_ORDER.map((period) => {
                const itemsInPeriod = disabledItems.filter(item => item.period === period)
                if (itemsInPeriod.length === 0) return null

                const cfg = PERIOD_CONFIG[period as keyof typeof PERIOD_CONFIG]

                return (
                  <div key={period}>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-3 mb-2">
                      {cfg.label}
                    </p>
                    <div className="space-y-1 pl-2 border-l-2 border-red-300">
                      {itemsInPeriod.map((item) => (
                        <div key={item.id} className="bg-red-50 rounded-lg p-2.5">
                          <p className="text-sm font-medium text-red-900 truncate">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-red-700 truncate mt-0.5">{item.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">✓ Todos los platos disponibles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
