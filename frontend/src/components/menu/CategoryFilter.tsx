import { motion } from 'framer-motion'
import type { Category } from '../../types'

interface Props {
  categories: Category[]
  selected: number | null
  onSelect: (id: number | null) => void
}

export default function CategoryFilter({ categories, selected, onSelect }: Props) {
  const base =
    'flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer'
  const inactive = 'text-white/50 hover:text-white/80'

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
      {/* Todos */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => onSelect(null)}
        className={base}
        style={
          !selected
            ? {
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                color: '#0a0a0a',
                fontWeight: 700,
                boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
              }
            : {
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
              }
        }
      >
        ✨ Todos
      </motion.button>

      {categories.map((cat) => {
        const isActive = selected === cat.id
        return (
          <motion.button
            key={cat.id}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(cat.id)}
            className={`${base} ${!isActive ? inactive : ''}`}
            style={
              isActive
                ? {
                    backgroundColor: cat.color,
                    color: '#0a0a0a',
                    fontWeight: 700,
                    boxShadow: `0 4px 20px ${cat.color}55`,
                  }
                : {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }
            }
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
            {cat.product_count !== undefined && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)',
                }}
              >
                {cat.product_count}
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
