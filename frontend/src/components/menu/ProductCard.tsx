import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Star, ImageOff } from 'lucide-react'
import type { Product } from '../../types'
import { getTimeSinceSessionStartMs, track } from '../../lib/tracker'
import ProductDetailModal from './ProductDetailModal'

interface Props {
  product: Product
  highlighted?: boolean
  position: number
  listType: 'featured' | 'category' | 'search_results' | 'full_menu'
}

export default function ProductCard({ product, highlighted, position, listType }: Props) {
  const cardRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)

  const handleClick = () => {
    track('product_click', {
      product_id: product.id,
      product_name: product.name,
      category_id: product.category_id,
      category_name: product.category_name,
      product_price: product.price,
      product_available: Boolean(product.available),
      product_featured: Boolean(product.featured),
      product_position: position,
      list_type: listType,
      time_since_session_start_ms: getTimeSinceSessionStartMs(),
    })
    setOpen(true)
  }

  // Registra impresión cuando el 50% de la card es visible en pantalla
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          track('product_impression', {
            product_id: product.id,
            product_name: product.name,
            category_id: product.category_id,
            category_name: product.category_name,
            product_price: product.price,
            product_available: Boolean(product.available),
            product_featured: Boolean(product.featured),
            product_position: position,
            list_type: listType,
            visibility_ratio: entry.intersectionRatio,
            time_since_session_start_ms: getTimeSinceSessionStartMs(),
          })
          if (!product.available) {
            track('out_of_stock_view', {
              product_id: product.id,
              product_name: product.name,
              category_id: product.category_id,
              category_name: product.category_name,
              product_position: position,
              list_type: listType,
            })
          }
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [listType, position, product.available, product.category_id, product.category_name, product.featured, product.id, product.name, product.price])

  const price = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(product.price)

  return (
    <>
    <motion.article
      ref={cardRef}
      onClick={handleClick}
      data-product-card="true"
      data-product-id={product.id}
      data-product-position={position}
      data-list-type={listType}
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="glass-card overflow-hidden group h-full flex flex-col cursor-pointer"
      style={highlighted ? { boxShadow: '0 0 0 1px rgba(245,158,11,0.25), 0 8px 32px rgba(0,0,0,0.4)' } : {}}
    >
      {/* Imagen */}
      <div className="relative h-48 flex-shrink-0 overflow-hidden" style={{ background: '#1a1a1a' }}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #222222 100%)',
            }}
          >
            <ImageOff size={28} style={{ color: 'rgba(255,255,255,0.1)' }} />
          </div>
        )}

        {/* Gradiente overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(10,10,10,0.85) 0%, transparent 60%)' }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {product.featured && (
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                color: '#0a0a0a',
              }}
            >
              <Star size={9} className="fill-current" />
              Destacado
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
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-serif text-lg font-semibold text-white mb-1 line-clamp-1">
          {product.name}
        </h3>

        {product.description && (
          <p
            className="text-sm leading-relaxed line-clamp-2 flex-1"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          <span
            className="font-serif text-2xl font-bold"
            style={{ color: '#f59e0b' }}
          >
            {price}
          </span>

          {!product.available && (
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              No disponible
            </span>
          )}
        </div>
      </div>
    </motion.article>

    {open && <ProductDetailModal product={product} position={position} listType={listType} onClose={() => setOpen(false)} />}
    </>
  )
}
