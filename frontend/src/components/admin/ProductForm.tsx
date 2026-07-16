import { useState, useRef, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { X, Upload, ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import type { Product, Category } from '../../types'

interface Props {
  product?: Product
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}

export default function ProductForm({ product, categories, onClose, onSuccess }: Props) {
  const isEdit = !!product
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name:        product?.name ?? '',
    description: product?.description ?? '',
    price:       product?.price?.toString() ?? '',
    category_id: product?.category_id?.toString() ?? '',
    available:   product?.available ?? true,
    featured:    product?.featured ?? false,
    order_index: product?.order_index?.toString() ?? '0',
  })

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price) { toast.error('Nombre y precio son requeridos'); return }

    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
      if (fileRef.current?.files?.[0]) fd.append('image', fileRef.current.files[0])

      if (isEdit) {
        await api.put(`/products/${product.id}`, fd)
        toast.success('Producto actualizado')
      } else {
        await api.post('/products', fd)
        toast.success('Producto creado')
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'input-admin text-sm'
  const labelClass = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-serif text-xl font-bold text-gray-900">
            {isEdit ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto admin-scroll p-6 space-y-5 flex-1">
          {/* Imagen */}
          <div>
            <label className={labelClass}>Imagen del producto</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative h-44 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-all group"
              style={{ borderColor: preview ? 'transparent' : '#e5e7eb' }}
              onMouseEnter={(e) => { if (!preview) (e.currentTarget as HTMLElement).style.borderColor = '#f59e0b' }}
              onMouseLeave={(e) => { if (!preview) (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb' }}
            >
              {preview ? (
                <>
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <div className="flex flex-col items-center gap-1.5 text-white">
                      <Upload size={22} />
                      <span className="text-xs font-medium">Cambiar imagen</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-300">
                  <ImageIcon size={32} />
                  <p className="text-sm text-gray-400">Clic para subir imagen</p>
                  <p className="text-xs text-gray-300">JPG, PNG, WebP — máx. 5 MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          {/* Nombre */}
          <div>
            <label className={labelClass}>Nombre *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} placeholder="Ej: Bife de chorizo" required />
          </div>

          {/* Descripción */}
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="Describí el plato..." />
          </div>

          {/* Precio y Orden */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Precio (ARS) *</label>
              <input type="number" value={form.price} onChange={(e) => set('price', e.target.value)} className={inputClass} placeholder="0" min="0" step="0.01" required />
            </div>
            <div>
              <label className={labelClass}>Orden</label>
              <input type="number" value={form.order_index} onChange={(e) => set('order_index', e.target.value)} className={inputClass} min="0" />
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className={labelClass}>Categoría</label>
            <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className={inputClass}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            {[
              { key: 'available', label: 'Disponible' },
              { key: 'featured', label: 'Destacado' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => set(key, e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="text-sm font-medium text-gray-600">{label}</span>
              </label>
            ))}
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <motion.button
            type="submit"
            form="product-form"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleSubmit as any}
            className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
          >
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
