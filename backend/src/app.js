const express = require('express')
const helmet = require('helmet')
const fs = require('fs')
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
  const frontendDistPath = path.join(__dirname, '../../frontend/dist')
  const hasFrontendBuild = fs.existsSync(frontendDistPath)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(express.json())
  app.use(apiRateLimiter)
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
  if (hasFrontendBuild) {
    app.use(express.static(frontendDistPath))
  }

  app.use('/api/auth', authRateLimiter, authRoutes)
  app.use('/api/categories', categoriesRoutes)
  app.use('/api/products', productsRoutes)
  app.use('/api/analytics', analyticsRoutes)
  app.use('/api/menu', menuRoutes)
  app.use('/api/restaurants', restaurantsRoutes)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  if (hasFrontendBuild) {
    app.get(/^(?!\/api).*/, (req, res, next) => {
      if (req.method !== 'GET') return next()
      if (!req.accepts('html')) return next()
      return res.sendFile(path.join(frontendDistPath, 'index.html'))
    })
  }

  return app
}

module.exports = { createApp }