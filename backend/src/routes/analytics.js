const express = require('express')
const { getDb } = require('../db/database')
const { authenticateToken } = require('../middleware/auth')
const { validateAnalyticsEvent } = require('../lib/analytics-validation')
const { analyticsBatchRateLimiter } = require('../middleware/security')

const router = express.Router()

function getDateFilter(query, columnName) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const { date_from, date_to } = query
  let tsFrom = null
  let tsTo = null
  if (date_from && dateRegex.test(date_from)) tsFrom = new Date(date_from + 'T00:00:00').getTime()
  if (date_to && dateRegex.test(date_to)) tsTo = new Date(date_to + 'T23:59:59').getTime()

  const conds = []
  const params = []
  if (tsFrom !== null) { conds.push(`${columnName} >= ?`); params.push(tsFrom) }
  if (tsTo !== null) { conds.push(`${columnName} <= ?`); params.push(tsTo) }
  return { sql: conds.length ? ' AND ' + conds.join(' AND ') : '', params }
}

function buildAnalyticsHealth(db, branchId, branchSlug, query) {
  const df = getDateFilter(query, 'ts')
  const rdf = getDateFilter(query, 'received_at_ts')

  const acceptedEvents = db.prepare(`
    SELECT COUNT(*) AS total
    FROM analytics_events
    WHERE branch_id = ? ${df.sql}
  `).get(branchId, ...df.params)

  const rejectedEvents = db.prepare(`
    SELECT COUNT(*) AS total,
           COUNT(DISTINCT COALESCE(session_id, 'unknown')) AS sessions
    FROM analytics_event_rejections
    WHERE (branch_id = ? OR branch_slug = ?) ${rdf.sql}
  `).get(branchId, branchSlug, ...rdf.params)

  const rejectionReasons = db.prepare(`
    SELECT primary_error AS reason, COUNT(*) AS count
    FROM analytics_event_rejections
    WHERE (branch_id = ? OR branch_slug = ?) ${rdf.sql}
    GROUP BY primary_error
    ORDER BY count DESC
    LIMIT 5
  `).all(branchId, branchSlug, ...rdf.params)

  const rejectedByEvent = db.prepare(`
    SELECT COALESCE(event, 'unknown') AS event, COUNT(*) AS count
    FROM analytics_event_rejections
    WHERE (branch_id = ? OR branch_slug = ?) ${rdf.sql}
    GROUP BY event
    ORDER BY count DESC
    LIMIT 5
  `).all(branchId, branchSlug, ...rdf.params)

  const recentRejections = db.prepare(`
    SELECT COALESCE(event, 'unknown') AS event,
           primary_error,
           created_at
    FROM analytics_event_rejections
    WHERE (branch_id = ? OR branch_slug = ?) ${rdf.sql}
    ORDER BY received_at_ts DESC, id DESC
    LIMIT 10
  `).all(branchId, branchSlug, ...rdf.params)

  const acceptedCount = Number(acceptedEvents?.total ?? 0)
  const rejectedCount = Number(rejectedEvents?.total ?? 0)
  const totalReceived = acceptedCount + rejectedCount
  const acceptanceRate = totalReceived > 0
    ? Number(((acceptedCount / totalReceived) * 100).toFixed(1))
    : null

  return {
    accepted_events: acceptedCount,
    rejected_events: rejectedCount,
    rejected_sessions: Number(rejectedEvents?.sessions ?? 0),
    acceptance_rate: acceptanceRate,
    top_rejection_reasons: rejectionReasons.map((item) => ({
      reason: item.reason,
      count: Number(item.count),
    })),
    rejected_by_event: rejectedByEvent.map((item) => ({
      event: item.event,
      count: Number(item.count),
    })),
    recent_rejections: recentRejections,
  }
}

// POST /api/analytics/batch — público, recibe array de eventos del menú
router.post('/batch', analyticsBatchRateLimiter, (req, res) => {
  const events = req.body
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'Se esperaba un array de eventos' })
  }
  if (events.length > 100) {
    return res.status(400).json({ error: 'El batch excede el máximo de 100 eventos' })
  }

  for (const [index, ev] of events.entries()) {
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
      return res.status(400).json({ error: `Evento inválido en índice ${index}: se esperaba un objeto` })
    }
    if (typeof ev.event !== 'string' || !ev.event.trim()) {
      return res.status(400).json({ error: `Evento inválido en índice ${index}: event es requerido` })
    }
    if (ev.data !== undefined && (typeof ev.data !== 'object' || ev.data === null || Array.isArray(ev.data))) {
      return res.status(400).json({ error: `Evento inválido en índice ${index}: data debe ser un objeto` })
    }
    if (ev.ts !== undefined && (!Number.isFinite(ev.ts) || ev.ts <= 0)) {
      return res.status(400).json({ error: `Evento inválido en índice ${index}: ts debe ser un número positivo` })
    }
  }

  const db = getDb()
  const branchIdBySlug = new Map()
  const accepted = []
  const rejected = []

  const resolveBranchId = (branchSlug) => {
    if (typeof branchSlug !== 'string' || !branchSlug.trim()) return null
    if (branchIdBySlug.has(branchSlug)) return branchIdBySlug.get(branchSlug)
    const branch = db.prepare('SELECT id FROM branches WHERE slug = ? AND active = 1').get(branchSlug)
    const branchId = branch?.id ?? null
    branchIdBySlug.set(branchSlug, branchId)
    return branchId
  }

  for (const [index, ev] of events.entries()) {
    const validation = validateAnalyticsEvent(ev)
    if (!validation.valid) {
      const branchSlug = typeof ev?.data?.branch_slug === 'string' ? ev.data.branch_slug : null
      rejected.push({
        index,
        event: ev?.event ?? null,
        errors: validation.errors,
        primary_error: validation.errors[0] || 'invalid payload',
        payload: ev,
        branch_id: resolveBranchId(branchSlug),
        branch_slug: branchSlug,
        session_id: typeof ev?.data?.session_id === 'string' ? ev.data.session_id : null,
        received_at_ts: typeof ev?.ts === 'number' ? ev.ts : Date.now(),
      })
      continue
    }

    const { event, data = {}, ts } = ev
    const branch_id = resolveBranchId(data.branch_slug)

    if (!branch_id) {
      rejected.push({
        index,
        event,
        errors: ['branch_slug does not match an active branch'],
        primary_error: 'branch_slug does not match an active branch',
        payload: ev,
        branch_id: null,
        branch_slug: data.branch_slug,
        session_id: data.session_id,
        received_at_ts: ts || Date.now(),
      })
      continue
    }

    accepted.push({ event, data, ts, branch_id })
  }

  for (const item of rejected) {
    db.prepare(`
      INSERT INTO analytics_event_rejections (branch_id, branch_slug, session_id, event, payload, errors, primary_error, received_at_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.branch_id,
      item.branch_slug,
      item.session_id,
      item.event,
      JSON.stringify(item.payload),
      JSON.stringify(item.errors),
      item.primary_error,
      item.received_at_ts,
    )
  }

  const responseErrors = rejected.slice(0, 20).map(({ index, event, errors }) => ({ index, event, errors }))

  if (!accepted.length) {
    return res.status(400).json({
      ok: false,
      accepted: 0,
      rejected: rejected.length,
      errors: responseErrors,
    })
  }

  for (const ev of accepted) {
    db.prepare(
      'INSERT INTO analytics_events (branch_id, session_id, event, data, ts) VALUES (?, ?, ?, ?, ?)'
    ).run(ev.branch_id, ev.data.session_id, ev.event, JSON.stringify(ev.data), ev.ts || Date.now())
  }

  res.status(rejected.length ? 202 : 200).json({
    ok: true,
    accepted: accepted.length,
    rejected: rejected.length,
    errors: responseErrors,
  })
})

// GET /api/analytics/health — protegido, salud de calidad del tracking
router.get('/health', authenticateToken, (req, res) => {
  const db = getDb()
  const branchId = req.user.branch_id
  const branchMeta = db.prepare('SELECT slug FROM branches WHERE id = ?').get(branchId)
  const branchSlug = branchMeta?.slug ?? ''

  res.json(buildAnalyticsHealth(db, branchId, branchSlug, req.query))
})

// GET /api/analytics/stats — protegido, para el panel admin
router.get('/stats', authenticateToken, (req, res) => {
  const db = getDb()
  const bid = req.user.branch_id

  const df = getDateFilter(req.query, 'ts')

  const topProducts = db.prepare(`
    SELECT json_extract(data, '$.product_name') AS product,
           json_extract(data, '$.product_id')   AS product_id,
           COUNT(*)                              AS impressions
    FROM analytics_events
    WHERE event = 'product_impression' AND branch_id = ? ${df.sql}
      AND json_extract(data, '$.product_name') IS NOT NULL
    GROUP BY product ORDER BY impressions DESC LIMIT 10
  `).all(bid, ...df.params)

  const topClicks = db.prepare(`
    SELECT json_extract(data, '$.product_name') AS product,
           json_extract(data, '$.product_id')   AS product_id,
           COUNT(*)                              AS clicks
    FROM analytics_events
    WHERE event = 'product_click' AND branch_id = ? ${df.sql}
      AND json_extract(data, '$.product_name') IS NOT NULL
    GROUP BY product ORDER BY clicks DESC LIMIT 10
  `).all(bid, ...df.params)

  const topCategories = db.prepare(`
    SELECT json_extract(data, '$.category_name') AS category,
           COUNT(*)                               AS views
    FROM analytics_events
    WHERE event = 'category_view' AND branch_id = ? ${df.sql}
      AND json_extract(data, '$.category_name') IS NOT NULL
    GROUP BY category ORDER BY views DESC
  `).all(bid, ...df.params)

  const topSearches = db.prepare(`
    SELECT json_extract(data, '$.query') AS query, COUNT(*) AS count
    FROM analytics_events
    WHERE event = 'search' AND branch_id = ? ${df.sql}
      AND json_extract(data, '$.query') IS NOT NULL
    GROUP BY query ORDER BY count DESC LIMIT 10
  `).all(bid, ...df.params)

  const sessions = db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS total FROM analytics_events WHERE branch_id = ? ${df.sql}
  `).get(bid, ...df.params)

  const avgTime = db.prepare(`
    SELECT ROUND(AVG(CAST(json_extract(data, '$.time_spent_seconds') AS REAL))) AS avg_seconds
    FROM analytics_events WHERE event = 'session_end' AND branch_id = ? ${df.sql}
  `).get(bid, ...df.params)

  const recentDays = db.prepare(`
    SELECT DATE(created_at) AS day, COUNT(DISTINCT session_id) AS sessions
    FROM analytics_events
    WHERE event = 'session_start' AND branch_id = ? ${df.sql}
    GROUP BY day ORDER BY day DESC LIMIT 14
  `).all(bid, ...df.params)

  // ── Nuevas analíticas ──────────────────────────────────────────────────

  // Tráfico por hora del día (0–23), rellenando ceros
  const hourlyRaw = db.prepare(`
    SELECT CAST(strftime('%H', datetime(ts/1000, 'unixepoch', 'localtime')) AS INTEGER) AS hour,
           COUNT(DISTINCT session_id) AS sessions
    FROM analytics_events
    WHERE event = 'session_start' AND branch_id = ? ${df.sql}
    GROUP BY hour ORDER BY hour
  `).all(bid, ...df.params)
  const hourlyTraffic = Array.from({ length: 24 }, (_, h) => {
    const found = hourlyRaw.find(r => Number(r.hour) === h)
    return { hour: h, sessions: found ? Number(found.sessions) : 0 }
  })

  // Tráfico por día de semana (0=Dom … 6=Sáb), rellenando ceros
  const weekdayRaw = db.prepare(`
    SELECT CAST(strftime('%w', datetime(ts/1000, 'unixepoch', 'localtime')) AS INTEGER) AS weekday,
           COUNT(DISTINCT session_id) AS sessions
    FROM analytics_events
    WHERE event = 'session_start' AND branch_id = ? ${df.sql}
    GROUP BY weekday ORDER BY weekday
  `).all(bid, ...df.params)
  const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const weekdayTraffic = Array.from({ length: 7 }, (_, d) => {
    const found = weekdayRaw.find(r => Number(r.weekday) === d)
    return { weekday: WEEKDAY_LABELS[d], sessions: found ? Number(found.sessions) : 0 }
  })

  // CTR por producto: clicks / impresiones × 100
  const productCTR = db.prepare(`
    SELECT p.product,
           p.impressions,
           COALESCE(c.clicks, 0) AS clicks,
           ROUND(CAST(COALESCE(c.clicks, 0) AS REAL) / NULLIF(p.impressions, 0) * 100, 1) AS ctr
    FROM (
      SELECT json_extract(data, '$.product_name') AS product, COUNT(*) AS impressions
      FROM analytics_events
      WHERE event = 'product_impression' AND branch_id = ? ${df.sql}
        AND json_extract(data, '$.product_name') IS NOT NULL
      GROUP BY product
    ) p
    LEFT JOIN (
      SELECT json_extract(data, '$.product_name') AS product, COUNT(*) AS clicks
      FROM analytics_events
      WHERE event = 'product_click' AND branch_id = ? ${df.sql}
        AND json_extract(data, '$.product_name') IS NOT NULL
      GROUP BY product
    ) c ON p.product = c.product
    ORDER BY p.impressions DESC LIMIT 10
  `).all(bid, ...df.params, bid, ...df.params)

  // Promedio de eventos por sesión (profundidad de navegación)
  const sessionDepth = db.prepare(`
    SELECT ROUND(AVG(cnt), 1) AS avg_events
    FROM (
      SELECT session_id, COUNT(*) AS cnt
      FROM analytics_events WHERE branch_id = ? ${df.sql}
      GROUP BY session_id
    )
  `).get(bid, ...df.params)

  // Distribución de scroll depth (25 / 50 / 75 / 100 %)
  const scrollDepth = db.prepare(`
    SELECT CAST(COALESCE(json_extract(data, '$.depth_percent'), json_extract(data, '$.depth')) AS INTEGER) AS depth,
           COUNT(DISTINCT session_id) AS sessions
    FROM analytics_events
    WHERE event = 'scroll_depth' AND branch_id = ? ${df.sql}
    GROUP BY depth ORDER BY depth
  `).all(bid, ...df.params)

  res.json({
    topProducts, topClicks, topCategories, topSearches,
    sessions, avgTime, recentDays,
    hourlyTraffic, weekdayTraffic, productCTR, sessionDepth, scrollDepth,
  })
})

// GET /api/analytics/downtime — historial de faltantes por producto
router.get('/downtime', authenticateToken, (req, res) => {
  const db = getDb()
  const bid = req.user.branch_id
  const now = Date.now()

  // Productos actualmente apagados (sin turned_on_at)
  const currentlyOff = db.prepare(`
    SELECT product_id, product_name, turned_off_at,
           ROUND((? - turned_off_at) / 60000.0, 0) AS minutes_off
    FROM product_downtime
    WHERE branch_id = ? AND turned_on_at IS NULL
    ORDER BY turned_off_at ASC
  `).all(now, bid)

  // Histórico por producto: incidentes, tiempo total, promedio, último evento
  const history = db.prepare(`
    SELECT product_id, product_name,
           COUNT(*) AS incidents,
           ROUND(SUM(COALESCE(duration_minutes, (? - turned_off_at) / 60000.0)), 0) AS total_minutes,
           ROUND(AVG(COALESCE(duration_minutes, (? - turned_off_at) / 60000.0)), 0) AS avg_minutes,
           MAX(turned_off_at) AS last_incident_at
    FROM product_downtime
    WHERE branch_id = ?
    GROUP BY product_id, product_name
    ORDER BY total_minutes DESC
    LIMIT 20
  `).all(now, now, bid)

  // Eventos recientes (últimas 4 semanas)
  const recent = db.prepare(`
    SELECT id, product_name, turned_off_at, turned_on_at,
           COALESCE(duration_minutes, ROUND((? - turned_off_at) / 60000.0, 1)) AS duration_minutes,
           CASE WHEN turned_on_at IS NULL THEN 1 ELSE 0 END AS still_off
    FROM product_downtime
    WHERE branch_id = ? AND turned_off_at >= ?
    ORDER BY turned_off_at DESC
    LIMIT 50
  `).all(now, bid, now - 28 * 86400000)

  res.json({ currentlyOff, history, recent })
})

module.exports = router
