const jwt = require('jsonwebtoken');
const { resolveJwtSecret } = require('../lib/jwt-secret');

const JWT_SECRET = resolveJwtSecret();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { authenticateToken, JWT_SECRET };
