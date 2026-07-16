import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, Star, Search, Settings, Phone, MapPin, Sparkles, RotateCcw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import api from '../lib/api'
import type { Category, Product } from '../types'
import ProductCard from '../components/menu/ProductCard'
import CategoryFilter from '../components/menu/CategoryFilter'
import { track, setBranchSlug, setTrackingContext } from '../lib/tracker'

interface BranchInfo {
  id: number
  restaurant_name: string
  name: string
  slug: string
  address: string | null
  phone: string | null
}

export default function MenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const base = `/menu/${slug}`
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadStartedAt = useRef(Date.now())
  const menuLoadedTracked = useRef(false)

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', slug],
    queryFn: () => api.get(`${base}/categories`).then((r) => r.data),
    enabled: !!slug,
  })

  const { data: branchInfo } = useQuery<BranchInfo>({
    queryKey: ['branch-info', slug],
    queryFn: () => api.get(`${base}/info`).then((r) => r.data),
    enabled: !!slug,
  })

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', slug, selectedCategory],
    queryFn: () =>
      api.get(`${base}/products`, { params: selectedCategory ? { category_id: selectedCategory } : {} }).then((r) => r.data),
    enabled: !!slug,
  })

  const { data: featured = [] } = useQuery<Product[]>({
    queryKey: ['featured', slug],
    queryFn: () => api.get(`${base}/featured`).then((r) => r.data),
    enabled: !!slug,
  })

  const recommendationParams: Record<string, string | number> = { limit: 4 }
  if (selectedCategory) recommendationParams.category_id = selectedCategory
  if (searchQuery.trim()) recommendationParams.search = searchQuery.trim()

  const { data: recommendations = [] } = useQuery<Product[]>({
    queryKey: ['recommendations', slug, selectedCategory, searchQuery],
    queryFn: () => api.get(`${base}/recommendations`, { params: recommendationParams }).then((r) => r.data),
    enabled: !!slug,
  })

  // Session start — una sola vez al montar
  useEffect(() => {
    if (!slug) return
    setBranchSlug(slug)
    setTrackingContext({
      page_type: 'menu',
      route: `/menu/${slug}`,
    })
    track('session_start')
  }, [slug])

  // Tracking de búsqueda con debounce de 600ms
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  // Tracking de categoría seleccionada
  const handleCategorySelect = useCallback((id: number | null) => {
    const previousCategory = categories.find((c) => c.id === selectedCategory)
    setSelectedCategory(id)
    if (id !== null) {
      const cat = categories.find((c) => c.id === id)
      track('category_view', {
        category_id: id,
        category_name: cat?.name ?? '',
        category_product_count: products.filter((product) => product.category_id === id).length,
        previous_category_id: selectedCategory,
        previous_category_name: previousCategory?.name ?? null,
      })
      return
    }

    if (selectedCategory !== null) {
      track('category_clear', {
        previous_category_id: selectedCategory,
        previous_category_name: previousCategory?.name ?? '',
      })
    }
  }, [categories, products, selectedCategory])

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const showFeatured = !selectedCategory && !searchQuery && featured.length > 0
  const selectedCategoryData = categories.find((category) => category.id === selectedCategory)
  const listType = searchQuery.trim()
    ? 'search_results'
    : selectedCategory
      ? 'category'
      : 'full_menu'
  const hasNoResults = !isLoading && filtered.length === 0
  const recommendationList = recommendations.filter((product) => !filtered.some((item) => item.id === product.id)).slice(0, 4)
  const showRecommendations = !isLoading && recommendationList.length > 0

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    if (selectedCategory !== null) {
      handleCategorySelect(null)
    }
  }, [handleCategorySelect, selectedCategory])

  useEffect(() => {
    setTrackingContext({
      page_type: 'menu',
      route: slug ? `/menu/${slug}` : window.location.pathname,
      selected_category_id: selectedCategory,
      selected_category_name: selectedCategoryData?.name ?? null,
      active_search: searchQuery.trim().length > 0,
      search_query: searchQuery.trim(),
      search_results_count: searchQuery.trim() ? filtered.length : null,
    })
  }, [filtered.length, searchQuery, selectedCategory, selectedCategoryData?.name, slug])

  useEffect(() => {
    if (!slug || isLoading || menuLoadedTracked.current) return
    menuLoadedTracked.current = true
    track('menu_loaded', {
      load_time_ms: Date.now() - loadStartedAt.current,
      products_count: products.length,
      categories_count: categories.length,
      featured_count: featured.length,
      has_phone_cta: Boolean(branchInfo?.phone),
    })
  }, [branchInfo?.phone, categories.length, featured.length, isLoading, products.length, slug])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)

    const normalizedQuery = searchQuery.trim()
    if (normalizedQuery.length <= 2) return

    searchTimer.current = setTimeout(() => {
      track('search', {
        query: normalizedQuery,
        query_length: normalizedQuery.length,
        results_count: filtered.length,
        selected_category_id: selectedCategory,
        selected_category_name: selectedCategoryData?.name ?? null,
      })

      if (filtered.length === 0) {
        track('search_no_results', {
          query: normalizedQuery,
          query_length: normalizedQuery.length,
          results_count: 0,
          selected_category_id: selectedCategory,
          selected_category_name: selectedCategoryData?.name ?? null,
        })
      }
    }, 600)

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [filtered.length, searchQuery, selectedCategory, selectedCategoryData?.name])

  const normalizedPhone = branchInfo?.phone?.replace(/[^\d+]/g, '') ?? ''

  const handleCallClick = useCallback(() => {
    if (!branchInfo?.phone) return
    track('cta_call_click', {
      cta_type: 'call',
      destination: branchInfo.phone,
      branch_name: branchInfo.name,
      placement: 'menu_header',
    })
  }, [branchInfo?.name, branchInfo?.phone])

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden pb-0">
        {/* Fondo con patrón sutil */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(245,158,11,0.06) 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, rgba(245,158,11,0.04) 0%, transparent 40%)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a]" />

        {/* Acceso admin discreto */}
        <Link
          to="/admin"
          className="absolute top-5 right-5 z-10 p-2.5 rounded-xl transition-colors"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          title="Panel de administración"
        >
          <Settings size={16} className="text-white/30 hover:text-white/60 transition-colors" />
        </Link>

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
          {/* Ornamento superior */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-4 mb-8"
          >
            <div
              className="h-px w-16"
              style={{ background: 'linear-gradient(to right, transparent, #f59e0b)' }}
            />
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <ChefHat size={20} className="text-[#0a0a0a]" />
            </div>
            <div
              className="h-px w-16"
              style={{ background: 'linear-gradient(to left, transparent, #f59e0b)' }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <p
              className="text-xs font-semibold tracking-[0.3em] uppercase mb-4"
              style={{ color: '#f59e0b' }}
            >
              Experiencia gastronómica
            </p>
            <h1 className="font-serif font-black text-gradient mb-5" style={{ fontSize: 'clamp(3rem,8vw,5.5rem)', lineHeight: 1.1 }}>
              Nuestra Carta
            </h1>
            <p className="text-lg font-light max-w-lg mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Ingredientes frescos, sabores únicos.<br />
              Una experiencia culinaria inigualable.
            </p>

            {(branchInfo?.phone || branchInfo?.address) && (
              <div className="mt-8 flex flex-col items-center gap-3">
                {branchInfo.address && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    <MapPin size={14} />
                    <span>{branchInfo.address}</span>
                  </div>
                )}

                {branchInfo.phone && (
                  <a
                    href={`tel:${normalizedPhone}`}
                    onClick={handleCallClick}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#0a0a0a',
                      boxShadow: '0 10px 30px rgba(245,158,11,0.18)',
                    }}
                  >
                    <Phone size={16} />
                    <span>Llamar al local</span>
                  </a>
                )}
              </div>
            )}
          </motion.div>

          {/* Buscador */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative mt-10 max-w-sm mx-auto"
          >
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            />
            <input
              type="text"
              placeholder="Buscar en el menú..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="input-dark pl-10 text-sm"
              style={{ borderRadius: '999px', paddingTop: '0.875rem', paddingBottom: '0.875rem' }}
            />
          </motion.div>
        </div>
      </header>

      {/* ─── CONTENIDO PRINCIPAL ───────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 pb-24">
        {/* Destacados */}
        <AnimatePresence>
          {showFeatured && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-14"
            >
              <div className="flex items-center gap-2 mb-6">
                <Star size={18} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                <h2 className="font-serif text-xl font-semibold text-white">Destacados del día</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featured.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <ProductCard product={product} highlighted position={i + 1} listType="featured" />
                  </motion.div>
                ))}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 mt-14 mb-2">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  Todo el menú
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Filtro de categorías */}
        <div className="mb-8">
          <CategoryFilter categories={categories} selected={selectedCategory} onSelect={handleCategorySelect} />
        </div>

        {/* Grilla de productos */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl skeleton h-72" />
            ))}
          </div>
        ) : hasNoResults ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-10"
          >
            <div
              className="rounded-3xl border p-8 text-center"
              style={{
                borderColor: 'rgba(245,158,11,0.2)',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))',
              }}
            >
              <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.18)' }}>
                <Search size={22} style={{ color: '#f59e0b' }} />
              </div>
              <h3 className="font-serif text-2xl text-white mb-2">No encontramos resultados para tu búsqueda</h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.58)' }}>
                Prueba con otra palabra, quita filtros o explora sugerencias recomendadas según lo más elegido por otros clientes.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                {searchQuery.trim() && (
                  <span className="px-3 py-1 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>
                    Búsqueda: {searchQuery.trim()}
                  </span>
                )}
                {selectedCategoryData?.name && (
                  <span className="px-3 py-1 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }}>
                    Categoría: {selectedCategoryData.name}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#0a0a0a',
                  }}
                >
                  <RotateCcw size={14} />
                  Limpiar filtros
                </button>

                {!selectedCategory && categories.slice(0, 3).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleCategorySelect(category.id)}
                    className="rounded-full px-4 py-2 text-xs"
                    style={{
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: 'rgba(255,255,255,0.72)',
                    }}
                  >
                    Ver {category.name}
                  </button>
                ))}
              </div>
            </div>

            {showRecommendations && (
              <section className="mt-10">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles size={18} style={{ color: '#f59e0b' }} />
                  <h4 className="font-serif text-xl text-white">Recomendados para ti</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recommendationList.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                    >
                      <ProductCard product={product} position={index + 1} listType="full_menu" />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={selectedCategory ?? 'all'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filtered.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                layout
              >
                <ProductCard product={product} position={i + 1} listType={listType} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {!hasNoResults && showRecommendations && (
          <section className="mt-14">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={18} style={{ color: '#f59e0b' }} />
              <h3 className="font-serif text-xl text-white">Sugeridos para continuar explorando</h3>
            </div>
            <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Seleccionados según interacción reciente del menú y popularidad de cada plato.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendationList.map((product, index) => (
                <motion.div
                  key={`rec-${product.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ProductCard product={product} position={index + 1} listType="full_menu" />
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer
        className="text-center py-8 text-xs"
        style={{ color: 'rgba(255,255,255,0.15)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center justify-center gap-2">
          <ChefHat size={13} />
          <span>Menú Digital · Actualizado en tiempo real</span>
        </div>
      </footer>
    </div>
  )
}
