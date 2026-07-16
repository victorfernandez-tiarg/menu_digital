const express = require('express')
const { getDb } = require('../db/database')

const router = express.Router()

// Resuelve el slug a branch en todos los endpoints de este router
router.param('slug', (req, res, next, slug) => {
  const db = getDb()
  const branch = db.prepare(`
    SELECT b.*, r.name as restaurant_name, r.description as restaurant_description, r.logo_url
    FROM branches b
    JOIN restaurants r ON r.id = b.restaurant_id
    WHERE b.slug = ? AND b.active = 1
  `).get(slug)
  if (!branch) return res.status(404).json({ error: 'Menú no encontrado' })
  req.branch = branch
  next()
})

// GET /api/menu/:slug/info
router.get('/:slug/info', (req, res) => {
  res.json(req.branch)
})

// GET /api/menu/:slug/categories
router.get('/:slug/categories', (req, res) => {
  const db = getDb()
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.available = 1 AND p.branch_id = ?
    WHERE c.active = 1 AND c.branch_id = ?
    GROUP BY c.id
    ORDER BY c.order_index ASC, c.name ASC
  `).all(req.branch.id, req.branch.id)
  res.json(categories)
})

// GET /api/menu/:slug/products
router.get('/:slug/products', (req, res) => {
  const db = getDb()
  const { category_id } = req.query
  let query = `
    SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.available = 1 AND p.branch_id = ?
  `
  const params = [req.branch.id]
  if (category_id) { query += ' AND p.category_id = ?'; params.push(category_id) }
  query += ' ORDER BY p.featured DESC, p.order_index ASC, p.name ASC'
  res.json(db.prepare(query).all(...params))
})

// GET /api/menu/:slug/featured
router.get('/:slug/featured', (req, res) => {
  const db = getDb()
  res.json(db.prepare(`
    SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.available = 1 AND p.featured = 1 AND p.branch_id = ?
    ORDER BY p.order_index ASC LIMIT 6
  `).all(req.branch.id))
})

// GET /api/menu/:slug/recommendations
router.get('/:slug/recommendations', (req, res) => {
  const db = getDb()
  const branchId = req.branch.id
  const limit = Math.max(1, Math.min(6, Number.parseInt(req.query.limit, 10) || 4))
  const excludeId = Number.parseInt(req.query.exclude_product_id, 10)
  const categoryId = Number.parseInt(req.query.category_id, 10)
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : ''

  const analyticsRows = db.prepare(`
    SELECT p.id,
           p.category_id,
           p.name,
           p.description,
           p.price,
           p.image_url,
           p.available,
           p.featured,
           p.order_index,
           p.created_at,
           c.name AS category_name,
           c.icon AS category_icon,
           c.color AS category_color,
           COUNT(CASE WHEN ae.event = 'product_impression' THEN 1 END) AS impressions,
           COUNT(CASE WHEN ae.event = 'product_click' THEN 1 END) AS clicks
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN analytics_events ae ON ae.branch_id = p.branch_id
      AND json_extract(ae.data, '$.product_id') = p.id
      AND ae.event IN ('product_impression', 'product_click')
    WHERE p.branch_id = ? AND p.available = 1
    GROUP BY p.id
  `).all(branchId)

  const scoredRows = analyticsRows
    .filter((row) => !Number.isFinite(excludeId) || row.id !== excludeId)
    .filter((row) => !Number.isFinite(categoryId) || row.category_id === categoryId)
    .filter((row) => {
      if (!search) return true
      const haystack = `${row.name || ''} ${row.description || ''}`.toLowerCase()
      return haystack.includes(search)
    })
    .map((row) => {
      const impressions = Number(row.impressions || 0)
      const clicks = Number(row.clicks || 0)
      const ctr = impressions > 0 ? clicks / impressions : 0
      const confidence = Math.min(1, impressions / 20)
      const score = ctr * 0.7 + confidence * 0.3 + (row.featured ? 0.05 : 0)

      return {
        ...row,
        score,
        ctr,
      }
    })
    .sort((a, b) => b.score - a.score || b.clicks - a.clicks || a.order_index - b.order_index)

  let recommendations = scoredRows.slice(0, limit)

  if (recommendations.length < limit) {
    const fallbackRows = db.prepare(`
      SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.branch_id = ? AND p.available = 1
      ORDER BY p.featured DESC, p.order_index ASC, p.name ASC
      LIMIT 24
    `).all(branchId)

    const selected = new Set(recommendations.map((item) => item.id))
    const fallback = fallbackRows
      .filter((row) => !selected.has(row.id))
      .filter((row) => !Number.isFinite(excludeId) || row.id !== excludeId)
      .filter((row) => !Number.isFinite(categoryId) || row.category_id === categoryId)
      .filter((row) => {
        if (!search) return true
        const haystack = `${row.name || ''} ${row.description || ''}`.toLowerCase()
        return haystack.includes(search)
      })
      .slice(0, limit - recommendations.length)

    recommendations = recommendations.concat(fallback)
  }

  res.json(recommendations)
})

module.exports = router
