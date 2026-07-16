import { useState, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import type { Category } from '../../types'

const PRESET_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4']
const PRESET_ICONS  = ['🍽️', '🥗', '🍖', '🍝', '🍰', '🥤', '🍕', '🌮', '🍣', '🍔', '🥩', '🍜', '🥪', '🧆', '🍷']

interface Props {
  category?: Category
  onClose: () => void
  onSuccess: () => void
}

export default function CategoryForm({ category, onClose, onSuccess }: Props) {
  const isEdit = !!category
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name:        category?.name ?? '',
    description: category?.description ?? '',
    icon:        category?.icon ?? '🍽️',
    color:       category?.color ?? '#f59e0b',
    order_index: category?.order_index?.toString() ?? '0',
    active:      category?.active ?? true,
  })

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name) return
    setLoading(true)
    try {
      if (isEdit) {
        await api.put(`/categories/${category.id}`, form)
        toast.success('Categoría actualizada')
      } else {
        await api.post('/categories', form)
        toast.success('Categoría creada')
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const labelClass = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-serif text-xl font-bold text-gray-900">
            {isEdit ? 'Editar categoría' : 'Nueva categoría'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Vista previa */}
          <div className="flex justify-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl transition-all"
              style={{ background: form.color + '25' }}
            >
              {form.icon}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className={labelClass}>Nombre *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className="input-admin text-sm" placeholder="Ej: Platos principales" required />
          </div>

          {/* Descripción */}
          <div>
            <label className={labelClass}>Descripción</label>
            <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)} className="input-admin text-sm" placeholder="Breve descripción..." />
          </div>

          {/* Íconos */}
          <div>
            <label className={labelClass}>Ícono</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map((icon) => (
                <button
                  key={icon} type="button" onClick={() => set('icon', icon)}
                  className="w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all hover:scale-110"
                  style={form.icon === icon ? { background: '#fef3c7', boxShadow: '0 0 0 2px #f59e0b' } : { background: '#f9fafb' }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Colores */}
          <div>
            <label className={labelClass}>Color</label>
            <div className="flex gap-2.5 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color} type="button" onClick={() => set('color', color)}
                  className="w-8 h-8 rounded-full transition-all hover:scale-110"
                  style={
                    form.color === color
                      ? { backgroundColor: color, boxShadow: `0 0 0 3px white, 0 0 0 5px ${color}` }
                      : { backgroundColor: color }
                  }
                />
              ))}
            </div>
          </div>

          {/* Orden y Activa */}
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className={labelClass}>Orden</label>
              <input type="number" value={form.order_index} onChange={(e) => set('order_index', e.target.value)} className="input-admin text-sm" min="0" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer pb-2.5">
              <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
              <span className="text-sm font-medium text-gray-600">Activa</span>
            </label>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <motion.button
              type="submit" disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
            >
              {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear categoría'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
