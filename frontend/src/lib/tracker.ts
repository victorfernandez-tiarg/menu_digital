// tracker.ts — módulo singleton de analytics del menú
// Los eventos se acumulan en cola y se envían en batch via sendBeacon

export const SESSION_ID = crypto.randomUUID()
const EVENT_VERSION = 1
const sessionStart = Date.now()
let _branchSlug = ''
let maxScrollDepth = 0
let trackedEventsCount = 0
let lastScrollY = 0
let sessionFinalized = false

type PageType = 'menu' | 'admin' | 'login' | 'unknown'

export function setBranchSlug(slug: string) {
  _branchSlug = slug
  scrollDepthReported.clear()
  maxScrollDepth = 0
  trackedEventsCount = 0
  lastScrollY = 0
  sessionFinalized = false
}

type EventPayload = Record<string, unknown>
interface QueueItem { event: string; data: EventPayload; ts: number }

interface TrackingContext {
  page_type: PageType
  route: string
  selected_category_id: number | null
  selected_category_name: string | null
  active_search: boolean
  search_query: string
  search_results_count: number | null
}

const trackingContext: TrackingContext = {
  page_type: 'unknown',
  route: window.location.pathname,
  selected_category_id: null,
  selected_category_name: null,
  active_search: false,
  search_query: '',
  search_results_count: null,
}

const queue: QueueItem[] = []
const scrollDepthReported = new Set<number>()

function getDeviceType() {
  const width = window.innerWidth
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

function getAttributionContext() {
  const params = new URLSearchParams(window.location.search)
  const referrer = document.referrer || ''
  let source = params.get('utm_source')
  let medium = params.get('utm_medium')

  if (!source && referrer) {
    try {
      source = new URL(referrer).hostname.replace(/^www\./, '')
    } catch {
      source = referrer
    }
  }

  if (!medium && source) {
    medium = referrer ? 'referral' : 'direct'
  }

  return {
    referrer,
    source,
    medium,
    campaign: params.get('utm_campaign'),
  }
}

function buildBasePayload() {
  const { referrer, source, medium, campaign } = getAttributionContext()

  return {
    event_version: EVENT_VERSION,
    occurred_at: new Date().toISOString(),
    session_id: SESSION_ID,
    branch_slug: _branchSlug,
    page_type: trackingContext.page_type,
    route: trackingContext.route || window.location.pathname,
    device_type: getDeviceType(),
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer,
    source,
    medium,
    campaign,
    selected_category_id: trackingContext.selected_category_id,
    selected_category_name: trackingContext.selected_category_name,
    active_search: trackingContext.active_search,
    search_results_count: trackingContext.search_results_count,
  }
}

function getVisibleProductSnapshot() {
  const visibleProducts = Array.from(document.querySelectorAll<HTMLElement>('[data-product-card="true"]')).filter((element) => {
    const rect = element.getBoundingClientRect()
    return rect.bottom > 0 && rect.top < window.innerHeight
  })

  const ids = visibleProducts
    .map((element) => Number(element.dataset.productId))
    .filter((value) => Number.isFinite(value))

  return {
    visible_products_count: visibleProducts.length,
    first_visible_product_id: ids[0] ?? null,
    last_visible_product_id: ids[ids.length - 1] ?? null,
  }
}

export function setTrackingContext(nextContext: Partial<TrackingContext>) {
  Object.assign(trackingContext, nextContext)
}

export function getTimeSinceSessionStartMs() {
  return Date.now() - sessionStart
}

function finalizeSession(exitReason: 'visibility_hidden' | 'page_hide') {
  if (sessionFinalized) return
  sessionFinalized = true

  const visibleSnapshot = getVisibleProductSnapshot()

  if (trackingContext.page_type === 'menu') {
    track('menu_exit', {
      exit_reason: exitReason,
      max_scroll_depth: maxScrollDepth,
      time_since_session_start_ms: getTimeSinceSessionStartMs(),
      ...visibleSnapshot,
    })
  }

  track('session_end', {
    time_spent_seconds: Math.round((Date.now() - sessionStart) / 1000),
    max_scroll_depth: maxScrollDepth,
    events_count: trackedEventsCount,
    interaction_count: trackedEventsCount,
    exit_reason: exitReason,
    ...visibleSnapshot,
  })

  flush()
}

export function track(event: string, data: EventPayload = {}) {
  trackedEventsCount += 1
  queue.push({ event, data: { ...buildBasePayload(), ...data }, ts: Date.now() })
  if (queue.length >= 10) flush()
}

export function flush() {
  if (!queue.length) return
  const payload = queue.splice(0)
  // Blob con content-type correcto para que Express lo parsee como JSON
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  navigator.sendBeacon('/api/analytics/batch', blob)
}

// Flush automático cada 30s
setInterval(flush, 30_000)

// Al salir o minimizar la tab
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    finalizeSession('visibility_hidden')
  }
})

window.addEventListener('pagehide', () => {
  finalizeSession('page_hide')
})

// Scroll depth — registra hitos discretos y contexto visible del menú
window.addEventListener('scroll', () => {
  if (!_branchSlug) return

  const documentHeight = document.documentElement.scrollHeight
  const maxScrollable = documentHeight - window.innerHeight
  if (maxScrollable <= 0) return

  const depthPercent = Math.min(100, Math.round((window.scrollY / maxScrollable) * 100))
  maxScrollDepth = Math.max(maxScrollDepth, depthPercent)
  const direction = window.scrollY >= lastScrollY ? 'down' : 'up'
  const visibleSnapshot = getVisibleProductSnapshot()

  for (const threshold of [10, 25, 50, 75, 90, 100]) {
    if (depthPercent >= threshold && !scrollDepthReported.has(threshold)) {
      scrollDepthReported.add(threshold)
      track('scroll_depth', {
        depth_percent: threshold,
        max_depth_percent: maxScrollDepth,
        milestone_index: scrollDepthReported.size,
        scroll_direction: direction,
        viewport_height_px: window.innerHeight,
        content_height_px: documentHeight,
        viewport_bottom_px: window.scrollY + window.innerHeight,
        time_since_session_start_ms: getTimeSinceSessionStartMs(),
        ...visibleSnapshot,
      })
    }
  }
  lastScrollY = window.scrollY
}, { passive: true })
