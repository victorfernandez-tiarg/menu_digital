import { fireEvent, render, screen } from '@testing-library/react'

import type { Category } from '../../types'
import CategoryFilter from './CategoryFilter'

const categories: Category[] = [
  {
    id: 1,
    name: 'Entradas',
    icon: '🥟',
    color: '#f59e0b',
    order_index: 1,
    active: true,
    created_at: '2026-06-17T00:00:00.000Z',
    product_count: 3,
  },
]

describe('CategoryFilter', () => {
  it('calls onSelect with category id when category is clicked', () => {
    const onSelect = vi.fn()

    render(
      <CategoryFilter
        categories={categories}
        selected={null}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByText('Entradas'))

    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('calls onSelect with null when Todos is clicked', () => {
    const onSelect = vi.fn()

    render(
      <CategoryFilter
        categories={categories}
        selected={1}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByText('✨ Todos'))

    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
