const jwt = require('jsonwebtoken');

const DEFAULT_WEAK_SECRETS = new Set([
  'menu_digital_secret_key_change_in_production',
  'menu_digital_super_secret_key_change_in_production',
  'changeme',
  'default',
]);

function resolveJwtSecret() {
  const value = process.env.JWT_SECRET;

  if (!value || !value.trim()) {
    throw new Error('JWT_SECRET is required. Configure a strong per-environment secret in backend/.env');
  }

  const secret = value.trim();
  if (secret.length < 32 || DEFAULT_WEAK_SECRETS.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET is too weak. Use at least 32 characters and avoid default/common values');
  }

  return secret;
}

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
