export interface Category {
  id: number
  name: string
  description?: string
  icon: string
  color: string
  order_index: number
  active: boolean
  product_count?: number
  created_at: string
}

export interface Product {
  id: number
  category_id?: number
  category_name?: string
  category_icon?: string
  category_color?: string
  name: string
  description?: string
  price: number
  image_url?: string
  available: boolean
  featured: boolean
  order_index: number
  created_at: string
  score?: number
  ctr?: number
}
