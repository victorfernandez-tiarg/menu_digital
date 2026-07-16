const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET categorias activas (publico)
router.get('/', (_req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.available = 1
    WHERE c.active = 1
    GROUP BY c.id
    ORDER BY c.order_index ASC, c.name ASC
  `).all();
  res.json(categories);
});

// GET todas (admin)
router.get('/all', authenticateToken, (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    WHERE c.branch_id = ?
    GROUP BY c.id
    ORDER BY c.order_index ASC, c.name ASC
  `).all(req.user.branch_id);
  res.json(categories);
});

// POST crear
router.post('/', authenticateToken, (req, res) => {
  const { name, description, icon, color, order_index } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO categories (branch_id, name, description, icon, color, order_index) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.branch_id, name, description || null, icon || '🍽️', color || '#f59e0b', order_index || 0);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(category);
});

// PUT actualizar
router.put('/:id', authenticateToken, (req, res) => {
  const { name, description, icon, color, order_index, active } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM categories WHERE id = ? AND branch_id = ?').get(req.params.id, req.user.branch_id);
  if (!existing) return res.status(404).json({ error: 'Categoría no encontrada' });

  db.prepare(
    'UPDATE categories SET name=?, description=?, icon=?, color=?, order_index=?, active=? WHERE id=?'
  ).run(name, description, icon, color, order_index, active ? 1 : 0, req.params.id);

  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

// DELETE eliminar
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM categories WHERE id = ? AND branch_id = ?').run(req.params.id, req.user.branch_id);
  if (result.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
  res.json({ message: 'Categoría eliminada' });
});

// PATCH reordenar categorías
router.patch('/reorder', authenticateToken, (req, res) => {
  const { order } = req.body; // [{ id, order_index }, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order debe ser un array' });
  const db = getDb();
  const update = db.prepare('UPDATE categories SET order_index = ? WHERE id = ? AND branch_id = ?');
  const transaction = db.transaction((items) => {
    for (const item of items) {
      update.run(item.order_index, item.id, req.user.branch_id);
    }
  });
  transaction(order);
  res.json({ success: true });
});

module.exports = router;
