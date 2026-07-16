const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function toCleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidUsername(value) {
  return /^[a-zA-Z0-9._-]{3,40}$/.test(value);
}

function isStrongPassword(value) {
  return typeof value === 'string'
    && value.length >= 8
    && value.length <= 72
    && /[A-Za-z]/.test(value)
    && /\d/.test(value);
}

function isValidSlug(value) {
  return /^[a-z0-9-]{3,60}$/.test(value);
}

function makeToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, restaurant_id: user.restaurant_id, branch_id: user.branch_id, role: user.role || 'owner' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// POST /api/auth/register — crea restaurante + sucursal principal + owner
router.post('/register', (req, res) => {
  const restaurant_name = toCleanString(req.body?.restaurant_name);
  const slug = toCleanString(req.body?.slug);
  const username = toCleanString(req.body?.username);
  const password = req.body?.password;

  if (!restaurant_name || !slug || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'El slug solo puede contener letras minúsculas, números y guiones' });
  }
  if (restaurant_name.length < 2 || restaurant_name.length > 80) {
    return res.status(400).json({ error: 'El nombre del restaurante debe tener entre 2 y 80 caracteres' });
  }
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Usuario inválido: usa 3-40 caracteres (letras, números, punto, guion o guion bajo)' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Contraseña débil: mínimo 8 caracteres y al menos una letra y un número' });
  }

  const db = getDb();
  if (db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(slug)) {
    return res.status(409).json({ error: 'Ese slug ya está en uso' });
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Ese usuario ya existe' });
  }

  const rRes = db.prepare('INSERT INTO restaurants (name, slug) VALUES (?, ?)').run(restaurant_name, slug);
  const restaurant_id = rRes.lastInsertRowid;

  const bRes = db.prepare('INSERT INTO branches (restaurant_id, name, slug) VALUES (?, ?, ?)').run(restaurant_id, restaurant_name, slug);
  const branch_id = bRes.lastInsertRowid;

  const hashed = bcrypt.hashSync(password, 10);
  const uRes = db.prepare(
    'INSERT INTO users (username, password, restaurant_id, branch_id, role) VALUES (?, ?, ?, ?, ?)'
  ).run(username, hashed, restaurant_id, branch_id, 'owner');

  const user = { id: uRes.lastInsertRowid, username, restaurant_id, branch_id, role: 'owner' };
  res.status(201).json({ token: makeToken(user), username, role: 'owner', branch_slug: slug });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const username = toCleanString(req.body?.username);
  const password = req.body?.password;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  if (!isValidUsername(username) || typeof password !== 'string' || password.length > 72) {
    return res.status(400).json({ error: 'Formato de credenciales inválido' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const branch = db.prepare('SELECT slug FROM branches WHERE id = ?').get(user.branch_id);
  res.json({
    token: makeToken(user),
    username: user.username,
    role: user.role || 'owner',
    branch_slug: branch?.slug || null,
  });
});

module.exports = router;
