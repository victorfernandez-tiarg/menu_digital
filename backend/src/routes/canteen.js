const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const VALID_PERIODS = ['desayuno', 'almuerzo', 'merienda', 'cena'];
const VALID_SHIFTS  = ['morning', 'afternoon', 'night'];
const VALID_ROLES   = ['staff', 'admin'];

const SHIFT_PERIODS = {
  morning:   ['desayuno', 'almuerzo'],
  afternoon: ['almuerzo', 'merienda', 'cena'],
  night:     ['cena', 'desayuno'],
};

function getAvailablePeriods(role, shift) {
  if (role === 'admin') return VALID_PERIODS;
  return SHIFT_PERIODS[shift] || [];
}

function toStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// ── Auth middleware ──────────────────────────────────────────────────────────

function authenticateCanteen(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'canteen') return res.status(401).json({ error: 'Token inválido' });
    req.cu = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.cu.role !== 'admin') return res.status(403).json({ error: 'Se requiere rol de administrador' });
  next();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post('/auth/login', (req, res) => {
  const username = toStr(req.body?.username);
  const password = req.body?.password;
  if (!username || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM canteen_users WHERE username = ? AND active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const periods = getAvailablePeriods(user.role, user.shift);
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, shift: user.shift, type: 'canteen' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    id:                user.id,
    token,
    username:          user.username,
    full_name:         user.full_name,
    department:        user.department,
    role:              user.role,
    shift:             user.shift,
    available_periods: periods,
  });
});

// ── Menu ──────────────────────────────────────────────────────────────────────

router.get('/menu', authenticateCanteen, (req, res) => {
  const db = getDb();
  const periods = getAvailablePeriods(req.cu.role, req.cu.shift);

  const placeholders = periods.map(() => '?').join(',');
  const items = placeholders.length
    ? db.prepare(
        `SELECT * FROM canteen_items WHERE available = 1 AND period IN (${placeholders}) ORDER BY period, order_index ASC`
      ).all(...periods)
    : [];

  const grouped = Object.fromEntries(periods.map((p) => [p, []]));
  for (const item of items) {
    if (grouped[item.period]) grouped[item.period].push(item);
  }

  res.json({ periods, menu: grouped });
});

// ── Orders (staff) ────────────────────────────────────────────────────────────

router.get('/orders/mine', authenticateCanteen, (req, res) => {
  const db   = getDb();
  const date =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : new Date().toISOString().split('T')[0];
  const orders = db.prepare(`
    SELECT o.id, o.period, o.date, o.ordered_at,
           i.id   AS item_id,
           i.name AS item_name,
           i.description AS item_description
    FROM canteen_orders o
    JOIN canteen_items i ON o.item_id = i.id
    WHERE o.user_id = ? AND o.date = ?
    ORDER BY o.period ASC
  `).all(req.cu.id, date);
  res.json(orders);
});

router.get('/orders/history', authenticateCanteen, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const orders = db.prepare(`
    SELECT o.id, o.period, o.date, o.ordered_at,
           i.id   AS item_id,
           i.name AS item_name,
           i.description AS item_description,
           CASE WHEN o.date = ? THEN 1 ELSE 0 END AS can_cancel
    FROM canteen_orders o
    JOIN canteen_items i ON o.item_id = i.id
    WHERE o.user_id = ? AND o.date >= ? AND o.date <= ?
    ORDER BY o.date DESC, o.period DESC
  `).all(today, req.cu.id, thirtyDaysAgo, sevenDaysAhead);

  res.json(orders);
});

router.post('/orders', authenticateCanteen, (req, res) => {
  const item_id = req.body?.item_id;
  const date    = req.body?.date || new Date().toISOString().split('T')[0];
  
  if (!item_id) return res.status(400).json({ error: 'item_id requerido' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Fecha inválida' });

  // Validar que la fecha esté dentro del rango permitido: hoy o mañana (máximo 24h de anticipación)
  const today = new Date().toISOString().split('T')[0];
  const todayObj = new Date();
  todayObj.setDate(todayObj.getDate() + 1);
  const tomorrow = todayObj.toISOString().split('T')[0];

  if (date < today) {
    return res.status(400).json({ error: 'No podés pedir para fechas pasadas' });
  }
  if (date > tomorrow) {
    return res.status(400).json({ error: 'Solo podés pedir con hasta 24 horas de anticipación (hoy o mañana)' });
  }

  const db = getDb();
  
  // Validar que el plato exista
  const itemExists = db.prepare('SELECT id, name, period, available FROM canteen_items WHERE id = ?').get(item_id);
  if (!itemExists) {
    return res.status(404).json({ error: 'Plato no encontrado' });
  }

  // Validar que el plato esté disponible (validación crucial: puede haber sido deshabilitado entre el GET /menu y el POST /orders)
  if (!itemExists.available) {
    return res.status(409).json({ 
      error: `"${itemExists.name}" fue deshabilitado y no está disponible para pedidos. Elige otro plato.`,
      code: 'ITEM_DISABLED'
    });
  }

  const item = itemExists;
  const periods = getAvailablePeriods(req.cu.role, req.cu.shift);
  if (!periods.includes(item.period)) {
    return res.status(403).json({ error: 'Ese período no está disponible para tu turno' });
  }

  const existing = db.prepare(
    'SELECT id FROM canteen_orders WHERE user_id = ? AND period = ? AND date = ?'
  ).get(req.cu.id, item.period, date);
  if (existing) {
    return res.status(409).json({ error: `Ya tenés un pedido para ese período el ${new Date(date).toLocaleDateString('es-AR')}. Cancelalo primero.` });
  }

  const result = db.prepare(
    'INSERT INTO canteen_orders (user_id, item_id, period, date, ordered_at) VALUES (?, ?, ?, ?, ?)'
  ).run(req.cu.id, item.id, item.period, date, new Date().toISOString());

  res.status(201).json({
    id:               result.lastInsertRowid,
    period:           item.period,
    date:             date,
    item_id:          item.id,
    item_name:        item.name,
    item_description: item.description,
  });
});

router.delete('/orders/:id', authenticateCanteen, (req, res) => {
  const db    = getDb();
  const today = new Date().toISOString().split('T')[0];
  const order = db.prepare(
    'SELECT * FROM canteen_orders WHERE id = ? AND user_id = ? AND date = ?'
  ).get(req.params.id, req.cu.id, today);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado o no se puede cancelar' });
  db.prepare('DELETE FROM canteen_orders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Admin: items ──────────────────────────────────────────────────────────────

router.get('/admin/items', authenticateCanteen, requireAdmin, (_req, res) => {
  res.json(
    getDb().prepare('SELECT * FROM canteen_items ORDER BY period, order_index ASC').all()
  );
});

router.post('/admin/items', authenticateCanteen, requireAdmin, (req, res) => {
  const name        = toStr(req.body?.name);
  const description = toStr(req.body?.description) || null;
  const period      = toStr(req.body?.period);
  const order_index = parseInt(req.body?.order_index) || 0;

  if (!name)                           return res.status(400).json({ error: 'El nombre es requerido' });
  if (!VALID_PERIODS.includes(period)) return res.status(400).json({ error: 'Período inválido' });

  const db     = getDb();
  const result = db.prepare(
    'INSERT INTO canteen_items (name, description, period, available, order_index) VALUES (?, ?, ?, 1, ?)'
  ).run(name, description, period, order_index);

  res.status(201).json(db.prepare('SELECT * FROM canteen_items WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/admin/items/:id', authenticateCanteen, requireAdmin, (req, res) => {
  const db   = getDb();
  const item = db.prepare('SELECT * FROM canteen_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Plato no encontrado' });

  const name        = toStr(req.body?.name);
  const description = toStr(req.body?.description) || null;
  const period      = toStr(req.body?.period);
  const order_index = parseInt(req.body?.order_index) || 0;
  const available   = req.body?.available ? 1 : 0;

  if (!name)                           return res.status(400).json({ error: 'El nombre es requerido' });
  if (!VALID_PERIODS.includes(period)) return res.status(400).json({ error: 'Período inválido' });

  db.prepare(
    'UPDATE canteen_items SET name=?, description=?, period=?, available=?, order_index=? WHERE id=?'
  ).run(name, description, period, available, order_index, req.params.id);

  res.json(db.prepare('SELECT * FROM canteen_items WHERE id = ?').get(req.params.id));
});

router.delete('/admin/items/:id', authenticateCanteen, requireAdmin, (req, res) => {
  const db   = getDb();
  const item = db.prepare('SELECT id FROM canteen_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Plato no encontrado' });
  db.prepare('DELETE FROM canteen_orders WHERE item_id = ?').run(req.params.id);
  db.prepare('DELETE FROM canteen_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Admin: orders ──────────────────────────────────────────────────────────────

router.get('/admin/orders', authenticateCanteen, requireAdmin, (req, res) => {
  const date =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : new Date().toISOString().split('T')[0];

  const orders = getDb().prepare(`
    SELECT o.id, o.period, o.date, o.ordered_at,
           u.username, u.full_name, u.department, u.shift,
           i.name AS item_name, i.description AS item_description
    FROM canteen_orders o
    JOIN canteen_users u ON o.user_id = u.id
    JOIN canteen_items i ON o.item_id = i.id
    WHERE o.date = ?
    ORDER BY o.period, u.full_name ASC
  `).all(date);

  res.json(orders);
});

router.get('/admin/orders/export/csv', authenticateCanteen, requireAdmin, (req, res) => {
  const date =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : new Date().toISOString().split('T')[0];

  const orders = getDb().prepare(`
    SELECT o.id, o.period, o.date, o.ordered_at,
           u.username, u.full_name, u.department, u.shift,
           i.name AS item_name, i.description AS item_description
    FROM canteen_orders o
    JOIN canteen_users u ON o.user_id = u.id
    JOIN canteen_items i ON o.item_id = i.id
    WHERE o.date = ?
    ORDER BY o.period, u.full_name ASC
  `).all(date);

  // Construir CSV
  const headers = ['ID', 'Usuario', 'Nombre Completo', 'Departamento', 'Turno', 'Período', 'Plato', 'Descripción', 'Fecha', 'Hora Pedido'];
  const rows = orders.map(o => [
    o.id,
    o.username || '',
    o.full_name || '',
    o.department || '',
    o.shift || '',
    o.period || '',
    o.item_name || '',
    (o.item_description || '').replace(/"/g, '""'),  // Escape quotes
    o.date || '',
    o.ordered_at || '',
  ]);

  // Escapar valores con comas o comillas
  const escapeCsv = (val) => {
    const str = String(val || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv =
    headers.map(escapeCsv).join(',') + '\n' +
    rows.map(row => row.map(escapeCsv).join(',')).join('\n');

  const fileName = `pedidos_${date}_${new Date().toISOString().split('T')[0]}.csv`;
  
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.header('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send('\uFEFF' + csv);  // BOM para Excel con UTF-8
});

router.get('/admin/orders/export/comanda', authenticateCanteen, requireAdmin, (req, res) => {
  const date =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : new Date().toISOString().split('T')[0];

  const orders = getDb().prepare(`
    SELECT o.period, i.id, i.name AS item_name, i.description AS item_description, COUNT(*) as qty
    FROM canteen_orders o
    JOIN canteen_items i ON o.item_id = i.id
    WHERE o.date = ?
    GROUP BY o.period, i.id
    ORDER BY o.period ASC, i.name ASC
  `).all(date);

  // Agrupar por período
  const commandaByPeriod = {};
  
  VALID_PERIODS.forEach(period => {
    const periodItems = orders.filter(o => o.period === period);
    if (periodItems.length > 0) {
      commandaByPeriod[period] = periodItems.map(o => ({
        name: o.item_name,
        description: o.item_description,
        qty: o.qty
      }));
    }
  });

  res.json({ date, comanda: commandaByPeriod });
});

// ── Admin: users ───────────────────────────────────────────────────────────────

router.get('/admin/users', authenticateCanteen, requireAdmin, (_req, res) => {
  res.json(
    getDb().prepare(
      'SELECT id, username, full_name, department, role, shift, active, created_at FROM canteen_users ORDER BY role DESC, full_name ASC'
    ).all()
  );
});

router.post('/admin/users', authenticateCanteen, requireAdmin, (req, res) => {
  const username   = toStr(req.body?.username);
  const password   = req.body?.password;
  const full_name  = toStr(req.body?.full_name);
  const department = toStr(req.body?.department) || null;
  const role       = toStr(req.body?.role);
  const shift      = toStr(req.body?.shift) || null;

  if (!username || !full_name || !role) {
    return res.status(400).json({ error: 'username, full_name y role son requeridos' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Rol inválido (staff | admin)' });
  }
  if (role === 'staff' && (!shift || !VALID_SHIFTS.includes(shift))) {
    return res.status(400).json({ error: 'El turno es requerido para usuarios staff (morning | afternoon | night)' });
  }
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({ error: 'Username inválido: 3-40 caracteres alfanuméricos' });
  }

  const db = getDb();
  if (db.prepare('SELECT id FROM canteen_users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Ese usuario ya existe' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO canteen_users (username, password, full_name, department, role, shift, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(username, hashed, full_name, department, role, role === 'admin' ? null : shift);

  res.status(201).json({
    id:         result.lastInsertRowid,
    username,
    full_name,
    department,
    role,
    shift:      role === 'admin' ? null : shift,
    active:     1,
  });
});

router.put('/admin/users/:id/toggle', authenticateCanteen, requireAdmin, (req, res) => {
  const db   = getDb();
  const user = db.prepare('SELECT id, active FROM canteen_users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const newActive = user.active ? 0 : 1;
  db.prepare('UPDATE canteen_users SET active = ? WHERE id = ?').run(newActive, user.id);
  res.json({ ok: true, active: newActive === 1 });
});

// ── Dashboard endpoints ──────────────────────────────────────────────────────

router.get('/admin/dashboard/summary', authenticateCanteen, requireAdmin, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Total de pedidos de hoy
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM canteen_orders WHERE date = ?').get(today);
  
  // Pedidos por período
  const byPeriod = db.prepare(
    'SELECT period, COUNT(*) as count FROM canteen_orders WHERE date = ? GROUP BY period'
  ).all(today);

  const summary = {
    date: today,
    total: totalOrders?.count || 0,
    byPeriod: VALID_PERIODS.map(p => ({
      period: p,
      count: byPeriod.find(bp => bp.period === p)?.count || 0,
    })),
  };

  res.json(summary);
});

router.get('/admin/dashboard/top-items', authenticateCanteen, requireAdmin, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // Top 3 platos más solicitados hoy
  const topItems = db.prepare(`
    SELECT 
      ci.id,
      ci.name,
      ci.description,
      ci.period,
      COUNT(co.id) as order_count
    FROM canteen_orders co
    JOIN canteen_items ci ON co.item_id = ci.id
    WHERE co.date = ?
    GROUP BY ci.id, ci.name, ci.description, ci.period
    ORDER BY order_count DESC
    LIMIT 3
  `).all(today);

  res.json(topItems);
});

router.get('/admin/dashboard/disabled-items', authenticateCanteen, requireAdmin, (req, res) => {
  const db = getDb();

  // Items deshabilitados
  const disabledItems = db.prepare(
    'SELECT id, name, description, period FROM canteen_items WHERE available = 0 ORDER BY period, name'
  ).all();

  res.json(disabledItems);
});

module.exports = router;
