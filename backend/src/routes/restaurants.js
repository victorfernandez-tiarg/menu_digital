const express = require('express')
const bcrypt = require('bcryptjs')
const { getDb } = require('../db/database')
const { authenticateToken } = require('../middleware/auth')

const router = express.Router()

function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede realizar esta acción' })
  next()
}

// GET /api/restaurants/me
router.get('/me', authenticateToken, (req, res) => {
  const db = getDb()
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.user.restaurant_id)
  res.json(restaurant)
})

// GET /api/restaurants/branches
router.get('/branches', authenticateToken, requireOwner, (req, res) => {
  const db = getDb()
  const branches = db.prepare(`
    SELECT b.*, COUNT(u.id) as admin_count
    FROM branches b
    LEFT JOIN users u ON u.branch_id = b.id AND u.role = 'branch_admin'
    WHERE b.restaurant_id = ?
    GROUP BY b.id
    ORDER BY b.created_at ASC
  `).all(req.user.restaurant_id)
  res.json(branches)
})

// POST /api/restaurants/branches
router.post('/branches', authenticateToken, requireOwner, (req, res) => {
  const { name, slug, address, phone } = req.body
  if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' })
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'Slug inválido: solo letras minúsculas, números y guiones' })

  const db = getDb()
  if (db.prepare('SELECT id FROM branches WHERE slug = ?').get(slug)) {
    return res.status(409).json({ error: 'Ese slug ya está en uso' })
  }

  const result = db.prepare(
    'INSERT INTO branches (restaurant_id, name, slug, address, phone) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.restaurant_id, name, slug, address || null, phone || null)

  res.status(201).json(db.prepare('SELECT * FROM branches WHERE id = ?').get(result.lastInsertRowid))
})

// PUT /api/restaurants/branches/:id
router.put('/branches/:id', authenticateToken, requireOwner, (req, res) => {
  const { name, slug, address, phone, active } = req.body
  const db = getDb()

  const branch = db.prepare('SELECT * FROM branches WHERE id = ? AND restaurant_id = ?').get(req.params.id, req.user.restaurant_id)
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' })

  if (slug && slug !== branch.slug) {
    if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'Slug inválido' })
    if (db.prepare('SELECT id FROM branches WHERE slug = ? AND id != ?').get(slug, req.params.id)) {
      return res.status(409).json({ error: 'Ese slug ya está en uso' })
    }
  }

  db.prepare('UPDATE branches SET name=?, slug=?, address=?, phone=?, active=? WHERE id=?').run(
    name ?? branch.name,
    slug ?? branch.slug,
    address ?? branch.address,
    phone ?? branch.phone,
    active !== undefined ? (active ? 1 : 0) : branch.active,
    req.params.id
  )

  res.json(db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id))
})

// POST /api/restaurants/branches/:id/admin — crea credenciales para una sucursal
router.post('/branches/:id/admin', authenticateToken, requireOwner, (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' })

  const db = getDb()
  const branch = db.prepare('SELECT * FROM branches WHERE id = ? AND restaurant_id = ?').get(req.params.id, req.user.restaurant_id)
  if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada' })

  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Ese usuario ya existe' })
  }

  const hashed = bcrypt.hashSync(password, 10)
  db.prepare(
    'INSERT INTO users (username, password, restaurant_id, branch_id, role) VALUES (?, ?, ?, ?, ?)'
  ).run(username, hashed, req.user.restaurant_id, req.params.id, 'branch_admin')

  res.status(201).json({ username, branch_name: branch.name, branch_slug: branch.slug })
})

module.exports = router
