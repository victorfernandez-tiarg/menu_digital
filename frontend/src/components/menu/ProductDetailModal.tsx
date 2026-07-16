import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, ImageOff } from 'lucide-react'
import type { Product } from '../../types'
import { getTimeSinceSessionStartMs, track } from '../../lib/tracker'

interface Props {
  product: Product
  position: number
  listType: 'featured' | 'category' | 'search_results' | 'full_menu'
  onClose: () => void
}

export default function ProductDetailModal({ product, position, listType, onClose }: Props) {
  const openedAtRef = useRef(Date.now())
  const closedRef = useRef(false)

  const price = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(product.price)

  const closeWithReason = (reason: 'backdrop' | 'button' | 'escape' | 'unmount') => {
    if (!closedRef.current) {
      closedRef.current = true
      track('product_modal_close', {
        product_id: product.id,
        product_name: product.name,
        category_id: product.category_id,
        category_name: product.category_name,
        product_position: position,
        list_type: listType,
        close_reason: reason,
        dwell_time_ms: Date.now() - openedAtRef.current,
        time_since_session_start_ms: getTimeSinceSessionStartMs(),
      })
    }
    onClose()
  }

  useEffect(() => {
    track('product_modal_open', {
      product_id: product.id,
      product_name: product.name,
      category_id: product.category_id,
      category_name: product.category_name,
      product_position: position,
      list_type: listType,
      entry_point: 'product_card',
      time_since_session_start_ms: getTimeSinceSessionStartMs(),
    })

    return () => {
      if (!closedRef.current) {
        track('product_modal_close', {
          product_id: product.id,
          product_name: product.name,
          category_id: product.category_id,
          category_name: product.category_name,
          product_position: position,
          list_type: listType,
          close_reason: 'unmount',
          dwell_time_ms: Date.now() - openedAtRef.current,
          time_since_session_start_ms: getTimeSinceSessionStartMs(),
        })
        closedRef.current = true
      }
    }
  }, [listType, onClose, position, product.category_id, product.category_name, product.id, product.name])

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWithReason('escape') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => closeWithReason('backdrop')}
      >
        <motion.div
          className="relative w-full sm:max-w-md overflow-hidden flex flex-col"
          style={{
            background: '#141414',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '1.5rem 1.5rem 0 0',
            maxHeight: '92dvh',
          }}
          // En desktop: esquinas redondeadas completas
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle drag indicator (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>

          {/* Imagen */}
          <div className="relative flex-shrink-0" style={{ height: '240px', background: '#1a1a1a' }}>
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #222 100%)' }}
              >
                <ImageOff size={40} style={{ color: 'rgba(255,255,255,0.08)' }} />
              </div>
            )}
            {/* Gradiente bottom */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, #141414 0%, transparent 55%)' }}
            />

            {/* Botón cerrar */}
            <button
              onClick={() => closeWithReason('button')}
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <X size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />
            </button>

            {/* Badges sobre imagen */}
            <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5">
              {product.featured && (
                <span
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0a0a0a' }}
                >
                  <Star size={9} className="fill-current" /> Destacado
                </span>
              )}
              {product.category_name && (
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: (product.category_color ?? '#f59e0b') + '33',
                    color: product.category_color ?? '#f59e0b',
                    border: `1px solid ${(product.category_color ?? '#f59e0b')}44`,
                  }}
                >
                  {product.category_icon} {product.category_name}
                </span>
              )}
            </div>
          </div>

          {/* Contenido */}
          <div className="px-6 py-5 overflow-y-auto">
            <h2 className="font-serif text-2xl font-bold text-white mb-3">
              {product.name}
            </h2>

            {product.description && (
              <p
                className="text-sm leading-relaxed mb-6"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                {product.description}
              </p>
            )}

            {/* Precio + disponibilidad */}
            <div
              className="flex items-center justify-between pt-5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span
                className="font-serif text-3xl font-bold"
                style={{ color: '#f59e0b' }}
              >
                {price}
              </span>

              {product.available ? (
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Disponible
                </span>
              ) : (
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  No disponible
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
