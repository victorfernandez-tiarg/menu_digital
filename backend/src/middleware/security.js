const rateLimit = require('express-rate-limit')

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function makeLimiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  })
}

const apiRateLimiter = makeLimiter(
  toPositiveInt(process.env.API_RATE_WINDOW_MS, 15 * 60 * 1000),
  toPositiveInt(process.env.API_RATE_MAX, 600),
  'Demasiadas solicitudes desde esta IP. Intenta nuevamente en unos minutos.'
)

const authRateLimiter = makeLimiter(
  toPositiveInt(process.env.AUTH_RATE_WINDOW_MS, 15 * 60 * 1000),
  toPositiveInt(process.env.AUTH_RATE_MAX, 25),
  'Demasiados intentos de autenticación. Intenta nuevamente más tarde.'
)

const analyticsBatchRateLimiter = makeLimiter(
  toPositiveInt(process.env.ANALYTICS_RATE_WINDOW_MS, 60 * 1000),
  toPositiveInt(process.env.ANALYTICS_RATE_MAX, 120),
  'Demasiados envíos de analytics. Reduce la frecuencia e intenta nuevamente.'
)

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  analyticsBatchRateLimiter,
}