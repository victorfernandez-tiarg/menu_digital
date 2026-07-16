const PAGE_TYPES = new Set(['menu', 'admin', 'login', 'unknown'])
const DEVICE_TYPES = new Set(['mobile', 'tablet', 'desktop'])
const SCROLL_MILESTONES = new Set([10, 25, 50, 75, 90, 100])
const LIST_TYPES = new Set(['featured', 'category', 'search_results', 'full_menu'])
const CLOSE_REASONS = new Set(['backdrop', 'button', 'escape', 'unmount'])
const EXIT_REASONS = new Set(['visibility_hidden', 'page_hide'])

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function validateEnum(value, allowedValues) {
  return typeof value === 'string' && allowedValues.has(value)
}

function validateOptionalField(data, field, validator, errors, message) {
  if (data[field] === undefined || data[field] === null) return
  if (!validator(data[field])) errors.push(message)
}

function validateBasePayload(data, errors) {
  if (!isPlainObject(data)) {
    errors.push('data must be an object')
    return
  }

  if (!isNonEmptyString(data.session_id)) errors.push('session_id is required')
  if (!isNonEmptyString(data.branch_slug)) errors.push('branch_slug is required')
  if (!Number.isInteger(data.event_version) || data.event_version < 1) {
    errors.push('event_version must be a positive integer')
  }
  if (!isNonEmptyString(data.occurred_at) || Number.isNaN(Date.parse(data.occurred_at))) {
    errors.push('occurred_at must be a valid ISO-8601 date string')
  }
  if (!validateEnum(data.page_type, PAGE_TYPES)) errors.push('page_type is invalid')
  if (!isNonEmptyString(data.route)) errors.push('route is required')
  if (!validateEnum(data.device_type, DEVICE_TYPES)) errors.push('device_type is invalid')

  validateOptionalField(data, 'viewport_width', isPositiveInteger, errors, 'viewport_width must be a non-negative integer')
  validateOptionalField(data, 'viewport_height', isPositiveInteger, errors, 'viewport_height must be a non-negative integer')
  validateOptionalField(data, 'time_since_session_start_ms', isPositiveInteger, errors, 'time_since_session_start_ms must be a non-negative integer')
  validateOptionalField(data, 'anonymous_user_id', isNonEmptyString, errors, 'anonymous_user_id must be a non-empty string')
  validateOptionalField(data, 'referrer', (value) => typeof value === 'string', errors, 'referrer must be a string')
  validateOptionalField(data, 'source', isNonEmptyString, errors, 'source must be a non-empty string')
  validateOptionalField(data, 'medium', isNonEmptyString, errors, 'medium must be a non-empty string')
  validateOptionalField(data, 'campaign', isNonEmptyString, errors, 'campaign must be a non-empty string')
  validateOptionalField(data, 'selected_category_id', isPositiveInteger, errors, 'selected_category_id must be a non-negative integer')
  validateOptionalField(data, 'selected_category_name', isNonEmptyString, errors, 'selected_category_name must be a non-empty string')
  validateOptionalField(data, 'active_search', (value) => typeof value === 'boolean', errors, 'active_search must be a boolean')
  validateOptionalField(data, 'search_results_count', isPositiveInteger, errors, 'search_results_count must be a non-negative integer')
}

const eventValidators = {
  session_start(data, errors) {
    return data
  },
  session_end(data, errors) {
    if (!isFiniteNumber(data.time_spent_seconds) || data.time_spent_seconds < 0) {
      errors.push('time_spent_seconds must be a non-negative number')
    }
    validateOptionalField(data, 'max_scroll_depth', isPositiveInteger, errors, 'max_scroll_depth must be a non-negative integer')
    validateOptionalField(data, 'events_count', isPositiveInteger, errors, 'events_count must be a non-negative integer')
    validateOptionalField(data, 'interaction_count', isPositiveInteger, errors, 'interaction_count must be a non-negative integer')
    validateOptionalField(data, 'exit_reason', (value) => validateEnum(value, EXIT_REASONS), errors, 'exit_reason is invalid')
    validateOptionalField(data, 'first_visible_product_id', isPositiveInteger, errors, 'first_visible_product_id must be a non-negative integer')
    validateOptionalField(data, 'last_visible_product_id', isPositiveInteger, errors, 'last_visible_product_id must be a non-negative integer')
  },
  menu_exit(data, errors) {
    if (!validateEnum(data.exit_reason, EXIT_REASONS)) errors.push('exit_reason is required and must be valid')
    validateOptionalField(data, 'max_scroll_depth', isPositiveInteger, errors, 'max_scroll_depth must be a non-negative integer')
    validateOptionalField(data, 'first_visible_product_id', isPositiveInteger, errors, 'first_visible_product_id must be a non-negative integer')
    validateOptionalField(data, 'last_visible_product_id', isPositiveInteger, errors, 'last_visible_product_id must be a non-negative integer')
  },
  menu_loaded(data, errors) {
    if (!isPositiveInteger(data.load_time_ms)) errors.push('load_time_ms must be a non-negative integer')
    if (!isPositiveInteger(data.products_count)) errors.push('products_count must be a non-negative integer')
    if (!isPositiveInteger(data.categories_count)) errors.push('categories_count must be a non-negative integer')
    validateOptionalField(data, 'featured_count', isPositiveInteger, errors, 'featured_count must be a non-negative integer')
    validateOptionalField(data, 'has_phone_cta', (value) => typeof value === 'boolean', errors, 'has_phone_cta must be a boolean')
  },
  search(data, errors) {
    if (!isNonEmptyString(data.query)) errors.push('query is required')
    validateOptionalField(data, 'query_length', isPositiveInteger, errors, 'query_length must be a non-negative integer')
    validateOptionalField(data, 'results_count', isPositiveInteger, errors, 'results_count must be a non-negative integer')
    if (isPositiveInteger(data.query_length) && isNonEmptyString(data.query) && data.query_length !== data.query.length) {
      errors.push('query_length must match query length')
    }
  },
  search_no_results(data, errors) {
    if (!isNonEmptyString(data.query)) errors.push('query is required')
    if (!isPositiveInteger(data.results_count) || data.results_count !== 0) {
      errors.push('results_count must be 0 for search_no_results')
    }
    validateOptionalField(data, 'query_length', isPositiveInteger, errors, 'query_length must be a non-negative integer')
    if (isPositiveInteger(data.query_length) && isNonEmptyString(data.query) && data.query_length !== data.query.length) {
      errors.push('query_length must match query length')
    }
  },
  category_view(data, errors) {
    if (!isPositiveInteger(data.category_id)) errors.push('category_id is required and must be a non-negative integer')
    if (!isNonEmptyString(data.category_name)) errors.push('category_name is required')
    validateOptionalField(data, 'category_product_count', isPositiveInteger, errors, 'category_product_count must be a non-negative integer')
  },
  category_clear(data, errors) {
    if (!isPositiveInteger(data.previous_category_id)) {
      errors.push('previous_category_id is required and must be a non-negative integer')
    }
    if (!isNonEmptyString(data.previous_category_name)) errors.push('previous_category_name is required')
  },
  product_impression(data, errors) {
    validateProductEvent(data, errors)
    validateOptionalField(data, 'visibility_ratio', isFiniteNumber, errors, 'visibility_ratio must be a number')
  },
  product_click(data, errors) {
    validateProductEvent(data, errors)
  },
  product_modal_open(data, errors) {
    validateProductEvent(data, errors)
    if (data.entry_point !== 'product_card') errors.push('entry_point must be product_card')
  },
  product_modal_close(data, errors) {
    validateProductEvent(data, errors)
    if (!isPositiveInteger(data.dwell_time_ms)) errors.push('dwell_time_ms must be a non-negative integer')
    if (!validateEnum(data.close_reason, CLOSE_REASONS)) errors.push('close_reason is required and must be valid')
  },
  out_of_stock_view(data, errors) {
    validateProductEvent(data, errors)
  },
  cta_call_click(data, errors) {
    if (data.cta_type !== 'call') errors.push('cta_type must be call')
    if (!isNonEmptyString(data.destination)) errors.push('destination is required')
    if (!isNonEmptyString(data.placement)) errors.push('placement is required')
  },
  cta_whatsapp_click(data, errors) {
    if (data.cta_type !== 'whatsapp') errors.push('cta_type must be whatsapp')
    if (!isNonEmptyString(data.destination)) errors.push('destination is required')
    if (!isNonEmptyString(data.placement)) errors.push('placement is required')
  },
  scroll_depth(data, errors) {
    if (!isPositiveInteger(data.depth_percent) || !SCROLL_MILESTONES.has(data.depth_percent)) {
      errors.push('depth_percent must be one of 10, 25, 50, 75, 90, 100')
    }
    if (!isPositiveInteger(data.max_depth_percent)) errors.push('max_depth_percent must be a non-negative integer')
    if (!isPositiveInteger(data.milestone_index) || data.milestone_index < 1) {
      errors.push('milestone_index must be a positive integer')
    }
    validateOptionalField(data, 'scroll_direction', (value) => value === 'up' || value === 'down', errors, 'scroll_direction must be up or down')
    if (!isPositiveInteger(data.viewport_height_px)) errors.push('viewport_height_px is required and must be a non-negative integer')
    if (!isPositiveInteger(data.content_height_px)) errors.push('content_height_px is required and must be a non-negative integer')
    validateOptionalField(data, 'viewport_bottom_px', isPositiveInteger, errors, 'viewport_bottom_px must be a non-negative integer')
    validateOptionalField(data, 'visible_products_count', isPositiveInteger, errors, 'visible_products_count must be a non-negative integer')
    validateOptionalField(data, 'first_visible_product_id', isPositiveInteger, errors, 'first_visible_product_id must be a non-negative integer')
    validateOptionalField(data, 'last_visible_product_id', isPositiveInteger, errors, 'last_visible_product_id must be a non-negative integer')
    validateOptionalField(data, 'active_category_id', isPositiveInteger, errors, 'active_category_id must be a non-negative integer')
    validateOptionalField(data, 'active_search', (value) => typeof value === 'boolean', errors, 'active_search must be a boolean')
    if (isPositiveInteger(data.max_depth_percent) && isPositiveInteger(data.depth_percent) && data.max_depth_percent < data.depth_percent) {
      errors.push('max_depth_percent must be greater than or equal to depth_percent')
    }
  },
}

function validateProductEvent(data, errors) {
  if (!isPositiveInteger(data.product_id)) errors.push('product_id is required and must be a non-negative integer')
  if (!isNonEmptyString(data.product_name)) errors.push('product_name is required')
  validateOptionalField(data, 'product_price', isFiniteNumber, errors, 'product_price must be a number')
  validateOptionalField(data, 'product_available', (value) => typeof value === 'boolean', errors, 'product_available must be a boolean')
  validateOptionalField(data, 'product_featured', (value) => typeof value === 'boolean', errors, 'product_featured must be a boolean')
  if (!isPositiveInteger(data.product_position)) errors.push('product_position is required and must be a non-negative integer')
  if (!validateEnum(data.list_type, LIST_TYPES)) errors.push('list_type is required and invalid')
  validateOptionalField(data, 'category_id', isPositiveInteger, errors, 'category_id must be a non-negative integer')
  validateOptionalField(data, 'category_name', isNonEmptyString, errors, 'category_name must be a non-empty string')
}

function validateAnalyticsEvent(payload) {
  const errors = []

  if (!isPlainObject(payload)) {
    return { valid: false, errors: ['event payload must be an object'] }
  }

  const { event, data = {}, ts } = payload

  if (!isNonEmptyString(event)) errors.push('event is required')
  if (isNonEmptyString(event) && !eventValidators[event]) {
    errors.push(`event ${event} is not allowed`)
  }
  if (ts !== undefined && (!isFiniteNumber(ts) || ts <= 0)) {
    errors.push('ts must be a positive number when provided')
  }

  validateBasePayload(data, errors)

  if (isNonEmptyString(event) && eventValidators[event] && isPlainObject(data)) {
    eventValidators[event](data, errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

module.exports = { validateAnalyticsEvent }