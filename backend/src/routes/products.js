const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { upload, UPLOADS_DIR } = require('../middleware/upload');

const router = express.Router();

const PRODUCT_SELECT = `
  SELECT p.*, c.name as category_name, c.icon as category_icon, c.color as category_color
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
`;

// GET productos publicos
router.get('/', (req, res) => {
  const db = getDb();
  const { category_id } = req.query;
  let query = PRODUCT_SELECT + ' WHERE p.available = 1';
  const params = [];
  if (category_id) { query += ' AND p.category_id = ?'; params.push(category_id); }
  query += ' ORDER BY p.featured DESC, p.order_index ASC, p.name ASC';
  res.json(db.prepare(query).all(...params));
});

// GET destacados (publico)
router.get('/featured', (_req, res) => {
  const db = getDb();
  res.json(db.prepare(
    PRODUCT_SELECT + ' WHERE p.available = 1 AND p.featured = 1 ORDER BY p.order_index ASC LIMIT 6'
  ).all());
});

// GET todos (admin) - debe ir antes de /:id
router.get('/all', authenticateToken, (req, res) => {
  const db = getDb();
  res.json(db.prepare(
    `SELECT p.*, c.name as category_name FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.branch_id = ?
     ORDER BY c.name ASC, p.order_index ASC, p.name ASC`
  ).all(req.user.branch_id));
});

// POST crear
router.post('/', authenticateToken, upload.single('image'), (req, res) => {
  const { category_id, name, description, price, available, featured, order_index } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Nombre y precio son requeridos' });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO products (branch_id, category_id, name, description, price, image_url, available, featured, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.branch_id, category_id || null, name, description || null, parseFloat(price), imageUrl,
    available === 'false' ? 0 : 1,
    featured === 'true' || featured === true ? 1 : 0,
    order_index || 0
  );

  res.status(201).json(db.prepare(PRODUCT_SELECT + ' WHERE p.id = ?').get(result.lastInsertRowid));
});

// PUT actualizar
router.put('/:id', authenticateToken, upload.single('image'), (req, res) => {
  const { category_id, name, description, price, available, featured, order_index } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND branch_id = ?').get(req.params.id, req.user.branch_id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  let imageUrl = existing.image_url;
  if (req.file) {
    // Eliminar imagen anterior de forma segura (sin path traversal)
    if (existing.image_url) {
      const safeName = path.basename(existing.image_url);
      const oldPath = path.join(UPLOADS_DIR, safeName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    imageUrl = `/uploads/${req.file.filename}`;
  }

  const nowAvail = (available === 'false' || available === false) ? 0 : 1;
  db.prepare(
    `UPDATE products SET category_id=?, name=?, description=?, price=?, image_url=?,
     available=?, featured=?, order_index=? WHERE id=?`
  ).run(
    category_id || null, name, description || null, parseFloat(price), imageUrl,
    nowAvail,
    featured === 'true' || featured === true ? 1 : 0,
    order_index || 0, req.params.id
  );

  // Registrar cambio de disponibilidad si cambió
  const now = Date.now();
  if (existing.available === 1 && nowAvail === 0) {
    db.prepare('INSERT INTO product_downtime (product_id, branch_id, product_name, turned_off_at) VALUES (?, ?, ?, ?)')
      .run(existing.id, existing.branch_id, name || existing.name, now);
  } else if (existing.available === 0 && nowAvail === 1) {
    db.prepare(`UPDATE product_downtime
      SET turned_on_at = ?, duration_minutes = ROUND((? - turned_off_at) / 60000.0, 1)
      WHERE product_id = ? AND branch_id = ? AND turned_on_at IS NULL`)
      .run(now, now, existing.id, existing.branch_id);
  }

  res.json(db.prepare(PRODUCT_SELECT + ' WHERE p.id = ?').get(req.params.id));
});

// PATCH toggle disponibilidad
router.patch('/:id/toggle', authenticateToken, (req, res) => {
  const { available } = req.body;
  const db = getDb();

  const product = db.prepare('SELECT id, name, branch_id, available FROM products WHERE id = ? AND branch_id = ?')
    .get(req.params.id, req.user.branch_id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const newAvail = available ? 1 : 0;
  db.prepare('UPDATE products SET available = ? WHERE id = ?').run(newAvail, product.id);

  const now = Date.now();
  if (newAvail === 0 && product.available === 1) {
    // Se apaga: abrir registro de faltante
    db.prepare('INSERT INTO product_downtime (product_id, branch_id, product_name, turned_off_at) VALUES (?, ?, ?, ?)')
      .run(product.id, product.branch_id, product.name, now);
  } else if (newAvail === 1 && product.available === 0) {
    // Se enciende: cerrar registro abierto
    db.prepare(`UPDATE product_downtime
      SET turned_on_at = ?, duration_minutes = ROUND((? - turned_off_at) / 60000.0, 1)
      WHERE product_id = ? AND branch_id = ? AND turned_on_at IS NULL`)
      .run(now, now, product.id, product.branch_id);
  }

  res.json({ success: true });
});

// DELETE eliminar
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND branch_id = ?').get(req.params.id, req.user.branch_id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  if (product.image_url) {
    const safeName = path.basename(product.image_url);
    const imgPath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ message: 'Producto eliminado' });
});

// PATCH reordenar productos
router.patch('/reorder', authenticateToken, (req, res) => {
  const { order } = req.body; // [{ id, order_index }, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order debe ser un array' });
  const db = getDb();
  const update = db.prepare('UPDATE products SET order_index = ? WHERE id = ? AND branch_id = ?');
  const transaction = db.transaction((items) => {
    for (const item of items) {
      update.run(item.order_index, item.id, req.user.branch_id);
    }
  });
  transaction(order);
  res.json({ success: true });
});

module.exports = router;
