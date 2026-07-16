const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const path = require('path')

const authRoutes = require('./routes/auth')
const categoriesRoutes = require('./routes/categories')
const productsRoutes = require('./routes/products')
const analyticsRoutes = require('./routes/analytics')
const menuRoutes = require('./routes/menu')
const restaurantsRoutes = require('./routes/restaurants')
const { apiRateLimiter, authRateLimiter } = require('./middleware/security')

function createApp() {
  const app = express()

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }))
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(express.json())
  app.use(apiRateLimiter)
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

  app.use('/api/auth', authRateLimiter, authRoutes)
  app.use('/api/categories', categoriesRoutes)
  app.use('/api/products', productsRoutes)
  app.use('/api/analytics', analyticsRoutes)
  app.use('/api/menu', menuRoutes)
  app.use('/api/restaurants', restaurantsRoutes)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  return app
}

module.exports = { createApp }