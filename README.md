# Menú Digital: Estado Actual, Operación y Roadmap BI

Este documento explica, de forma didáctica, cómo funciona hoy el proyecto, qué partes están bien resueltas, qué faltaría reforzar y qué mejoras conviene priorizar para análisis de BI e interacciones de usuario.

## 1. Qué es este proyecto

Menú Digital es una plataforma con:

- Frontend web (React + Vite) para:
  - Menú público por sucursal.
  - Panel administrativo para dueños y admins de sucursal.
- Backend API (Express + SQLite con sql.js) para:
  - Autenticación y autorización con JWT.
  - Gestión de productos, categorías y sucursales.
  - Ingesta y consulta de eventos de analytics.

Actualmente incluye datos seed de 2 restaurantes para comenzar rápido.

## 2. Arquitectura actual (resumen)

- Frontend:
  - React + TypeScript.
  - React Query para fetch/cache.
  - Axios con interceptor para token JWT.
  - UI con Tailwind + animaciones (Framer Motion).
- Backend:
  - Express.
  - JWT para rutas protegidas.
  - Multer para upload de imágenes.
  - SQL sobre sql.js (WASM), persistiendo en archivo SQLite local.
- Datos:
  - Base principal en `backend/data/menu.db`.
  - Tabla de eventos para BI: `analytics_events`.
- Tabla de rechazos de tracking: `analytics_event_rejections`.
  - Tabla de faltantes de stock: `product_downtime`.

## 3. Puesta en marcha local

### Requisitos

- Node.js 18+ (recomendado 20+).
- npm.

### Instalación

Desde la raíz:

```bash
npm run install:all
```

Configurar variables de entorno del backend con un secreto fuerte por entorno:

```env
PORT=3001
JWT_SECRET=replace-with-a-strong-secret-min-32-chars
```

Reglas recomendadas para `JWT_SECRET`:

- Distinto por ambiente (`dev`, `staging`, `prod`).
- Al menos 32 caracteres.
- No usar valores por defecto o predecibles (`changeme`, `default`, etc.).

### Ejecución

Desde la raíz:

```bash
npm run dev
```

Servicios esperados:

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Healthcheck: http://localhost:3001/api/health

### Despliegue simple en Railway

La forma más simple de desplegar este proyecto es como un solo servicio Node:

1. Railway instala dependencias en la raíz y luego el `postinstall` instala `backend` y `frontend`.
2. El build de producción ejecuta `npm run build`, que genera `frontend/dist`.
3. El arranque usa `npm start`, que levanta el backend y sirve también el frontend compilado.

Variables de entorno recomendadas en Railway:

```env
JWT_SECRET=replace-with-a-strong-secret-min-32-chars
```

`PORT` lo asigna Railway automáticamente.

Si quieres conservar la base SQLite y las imágenes subidas entre deploys, monta un volumen para:

- `backend/data`
- `backend/uploads`

`backend/data` también guarda el secreto JWT persistente cuando no defines `JWT_SECRET` en Railway, así no se regeneran los tokens en cada redeploy.

### Nota para Windows si npm/node no aparecen en PATH

Si PowerShell no reconoce `npm` o `node`, ejecutar temporalmente:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

## 4. Flujo funcional actual

### 4.1 Menú público

Ruta web por sucursal:

- `/menu/:slug`

Comportamiento:

- Carga info de sucursal, categorías y productos disponibles.
- Permite filtro por categoría.
- Permite búsqueda local de productos.
- Muestra destacados cuando no hay filtros activos.
- Modal de detalle de producto al hacer click.

### 4.2 Panel admin

Rutas:

- `/admin/login`
- `/admin`

Funciones actuales:

- CRUD de productos y categorías.
- Activar/desactivar disponibilidad de productos.
- Reordenamiento drag and drop de productos/categorías.
- Gestión de sucursales (owner): crear sucursales, activar/inactivar, crear admin por sucursal.
- Dashboard de analytics con filtros de fecha.

### 4.3 Autenticación

- Login y registro por API.
- JWT con expiración de 24h.
- Roles:
  - `owner`
  - `branch_admin`

## 5. Endpoints principales (visión rápida)

### Públicos

- `GET /api/health`
- `GET /api/menu/:slug/info`
- `GET /api/menu/:slug/categories`
- `GET /api/menu/:slug/products`
- `GET /api/menu/:slug/featured`
- `POST /api/analytics/batch`
- `POST /api/auth/login`
- `POST /api/auth/register`

### Protegidos (JWT)

- `GET /api/products/all`
- `POST /api/products`
- `PUT /api/products/:id`
- `PATCH /api/products/:id/toggle`
- `PATCH /api/products/reorder`
- `DELETE /api/products/:id`
- `GET /api/categories/all`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `PATCH /api/categories/reorder`
- `DELETE /api/categories/:id`
- `GET /api/restaurants/me`
- `GET /api/restaurants/branches`
- `POST /api/restaurants/branches`
- `PUT /api/restaurants/branches/:id`
- `POST /api/restaurants/branches/:id/admin`
- `GET /api/analytics/stats`
- `GET /api/analytics/health`
- `GET /api/analytics/downtime`

## 6. Instrumentación de eventos (BI actual)

Eventos enviados desde frontend (batch + sendBeacon):

- `session_start`
- `session_end` (incluye tiempo de sesión)
- `menu_exit`
- `menu_loaded`
- `search`
- `search_no_results`
- `category_view`
- `category_clear`
- `product_impression`
- `product_click`
- `product_modal_open`
- `product_modal_close`
- `out_of_stock_view`
- `cta_call_click` (si la sucursal tiene teléfono)
- `scroll_depth` (10, 25, 50, 75, 90, 100)

Atributos frecuentes:

- `session_id`
- `branch_slug`
- `product_id` / `product_name`
- `category_id` / `category_name`
- `query`

## 7. Qué está bien cubierto hoy

1. Base funcional completa para operación diaria del menú.
2. Multi-sucursal con gestión por owner.
3. Panel admin usable para altas, cambios, orden y disponibilidad.
4. Tracking real de interacción de usuario (no solo visitas).
5. Métricas útiles ya visibles en dashboard:
   - Sesiones únicas.
   - Tiempo promedio.
   - Vistos vs clickeados.
   - CTR por producto.
   - Scroll depth.
   - Tráfico por hora y por día.
   - Búsquedas frecuentes.
   - Faltantes de productos y tiempos de caída.

## 8. Qué faltaría reforzar (prioridad práctica)

### Alta prioridad

1. Variables de entorno y seguridad:
   - Secretos por entorno (`JWT_SECRET`) fuera de defaults débiles.
   - Hardening básico aplicado:
     - `helmet` para cabeceras HTTP seguras.
     - Rate limit global de API + límite específico para `POST /api/auth/*` y `POST /api/analytics/batch`.
     - Validación más estricta de credenciales (`username`, `password`, `slug`) y envelope de eventos analytics.
2. Calidad y mantenibilidad:
    - Tests mínimos implementados:
       - API backend: `GET /api/health` y validación de envelope en `POST /api/analytics/batch`.
       - Componente crítico frontend: interacción de `CategoryFilter`.
    - Lint/format + scripts de calidad listos para CI:
       - `npm run lint`, `npm run test`, `npm run format`, `npm run format:check`.
       - `npm run ci:check` (agregado en raíz) y workflow en `.github/workflows/ci-quality.yml`.
3. Modelo de datos BI:
   - Versionado de eventos (`event_version`).
   - Catálogo formal de eventos y propiedades obligatorias.

### Prioridad media

1. Rendimiento y escalabilidad:
   - Índices SQL para consultas de analytics de alto volumen.
   - Estrategia de archivado/retención de eventos.
2. Observabilidad:
   - Logs estructurados y trazabilidad de errores.
   - Métricas técnicas (latencia API, errores por endpoint).

### Prioridad baja

1. Mejoras UX puntuales:
    - Estado vacío enriquecido implementado para búsquedas sin resultado:
       - Mensaje orientado a acción, chips de contexto y CTA para limpiar filtros.
       - Atajos para explorar categorías cuando no hay coincidencias.
    - Recomendaciones de productos implementadas en base a comportamiento:
       - Nuevo endpoint público `GET /api/menu/:slug/recommendations`.
       - Ranking por señales de interacción (CTR + confianza por impresiones) con fallback a destacados/populares.

## 9. Mejora BI enfocada en menú e interacción

## 9.1 Preguntas de negocio que conviene responder

1. ¿Qué platos atraen mirada pero no click (bajo CTR)?
2. ¿Qué categorías generan más exploración y en qué horarios?
3. ¿Qué búsquedas no encuentran oferta adecuada?
4. ¿Dónde se corta la navegación (scroll + salida)?
5. ¿Qué faltantes impactan más en interés del menú?

## 9.2 Nuevos eventos recomendados

Agregar:

- `cta_whatsapp_click` (si se incorpora canal WhatsApp).

## 9.3 KPIs de BI sugeridos

1. CTR por producto y por franja horaria.
2. Tasa de búsqueda sin resultados.
3. Tiempo hasta primer click.
4. Profundidad de navegación por sesión (eventos/sesión).
5. Tasa de abandono temprano (sin interacción).
6. Índice de impacto por faltante:
   - Impresiones del producto mientras está inactivo.
   - Oportunidad perdida aproximada.

## 9.4 Embudo recomendado

Embudo base para menú:

1. `session_start`
2. `product_impression`
3. `product_click`
4. `product_modal_open` (nuevo)
5. `cta_order_click` o equivalente de conversión (nuevo)

Esto permite medir conversión real por plato/categoría/sucursal.

## 9.5 Segmentación útil

- Por sucursal.
- Por día y franja horaria.
- Por dispositivo (mobile/desktop).
- Nuevos vs recurrentes (si se agrega identificación anónima persistente).
- Por canal de entrada (QR mesa, Instagram, Google Maps, etc.).

## 9.6 Diccionario de eventos BI propuesto

Para que analytics sea consistente, escalable y útil en BI, conviene definir un contrato único para todos los eventos. La idea no es solo listar nombres, sino fijar:

- Nombre exacto del evento.
- Momento de disparo.
- Propiedades obligatorias.
- Propiedades opcionales.
- Tipo de dato de cada propiedad.
- Reglas de validación.
- Versión del evento.

### 9.6.1 Estructura común recomendada

Cada evento debería persistirse con este sobre común, incluso si internamente la tabla sigue guardando `event`, `data` y `ts`.

```json
{
   "event": "product_click",
   "event_version": 1,
   "occurred_at": "2026-06-17T21:15:30.120Z",
   "session_id": "uuid",
   "anonymous_user_id": "uuid-opcional",
   "branch_slug": "don-carlos",
   "page_type": "menu",
   "route": "/menu/don-carlos",
   "device_type": "mobile",
   "viewport_width": 390,
   "viewport_height": 844,
   "language": "es-AR",
   "timezone": "America/Argentina/Buenos_Aires",
   "referrer": "https://www.instagram.com/",
   "source": "instagram",
   "medium": "social",
   "campaign": "invierno-2026",
   "data": {}
}
```

### 9.6.2 Campos base transversales

Estos campos deberían existir en todos o casi todos los eventos:

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `event` | `string` | Sí | Nombre canónico en `snake_case`. |
| `event_version` | `integer` | Sí | Versión del contrato del evento. Arrancar en `1`. |
| `occurred_at` | `string (ISO-8601)` | Sí | Fecha/hora exacta del evento en UTC. |
| `session_id` | `string` | Sí | Identificador único por sesión de navegación. |
| `anonymous_user_id` | `string` | No | Identificador persistente anónimo para reconocer recurrencia entre sesiones. |
| `branch_slug` | `string` | Sí | Sucursal asociada al menú. |
| `page_type` | `enum` | Sí | Ej.: `menu`, `admin`, `login`. |
| `route` | `string` | Sí | Ruta lógica donde ocurrió el evento. |
| `device_type` | `enum` | Sí | `mobile`, `tablet`, `desktop`. |
| `viewport_width` | `integer` | No | Ancho visible en px. |
| `viewport_height` | `integer` | No | Alto visible en px. |
| `language` | `string` | No | Idioma del navegador. |
| `timezone` | `string` | No | Zona horaria del cliente. |
| `referrer` | `string` | No | Referencia HTTP o documento origen. |
| `source` | `string` | No | Canal normalizado: `qr_table`, `instagram`, `google_maps`, etc. |
| `medium` | `string` | No | Medio normalizado: `organic`, `social`, `paid`, `offline`. |
| `campaign` | `string` | No | Campaña o activación comercial. |
| `experiment_id` | `string` | No | Identificador de experimento A/B o personalización. |
| `data_quality_flag` | `enum` | No | `valid`, `partial`, `fallback`, `invalid`. Útil para auditoría. |

### 9.6.3 Bloques reutilizables de propiedades

Para no repetir propiedades sueltas y mantener consistencia, conviene pensar el diccionario por bloques lógicos:

#### Contexto de producto

| Campo | Tipo | Requerido | Uso |
| --- | --- | --- | --- |
| `product_id` | `integer` | Sí | ID interno del producto. |
| `product_name` | `string` | Sí | Nombre visible del producto. |
| `product_price` | `number` | No | Precio al momento del evento. |
| `product_available` | `boolean` | No | Estado de disponibilidad. |
| `product_featured` | `boolean` | No | Si estaba marcado como destacado. |
| `product_position` | `integer` | No | Posición del producto dentro de la lista visible al usuario. |
| `list_type` | `enum` | No | `featured`, `category`, `search_results`, `full_menu`. |
| `badge_state` | `string[]` | No | Etiquetas visibles: `featured`, `out_of_stock`, etc. |

#### Contexto de categoría

| Campo | Tipo | Requerido | Uso |
| --- | --- | --- | --- |
| `category_id` | `integer` | No | ID interno de categoría. |
| `category_name` | `string` | No | Nombre de la categoría. |
| `category_position` | `integer` | No | Orden del chip o bloque. |
| `category_product_count` | `integer` | No | Cantidad de productos visibles para esa categoría. |

#### Contexto de búsqueda

| Campo | Tipo | Requerido | Uso |
| --- | --- | --- | --- |
| `query` | `string` | Sí | Texto buscado normalizado. |
| `query_length` | `integer` | No | Largo del texto. |
| `results_count` | `integer` | No | Cantidad de coincidencias. |
| `search_latency_ms` | `integer` | No | Tiempo hasta mostrar resultados. |
| `search_source` | `enum` | No | `header_search`, `sticky_search`, etc. |

#### Contexto de visibilidad y lista

| Campo | Tipo | Requerido | Uso |
| --- | --- | --- | --- |
| `visible_products_count` | `integer` | No | Cantidad de tarjetas visibles al disparar el evento. |
| `first_visible_product_id` | `integer` | No | Primer producto visible en viewport. |
| `last_visible_product_id` | `integer` | No | Último producto visible en viewport. |
| `content_height_px` | `integer` | No | Alto total del documento o del contenedor. |
| `viewport_bottom_px` | `integer` | No | Posición inferior actual del viewport. |
| `time_since_session_start_ms` | `integer` | No | Tiempo desde el inicio de la sesión. |

### 9.6.4 Diccionario de eventos recomendado

#### Eventos actuales del menú

| Evento | Cuándo dispara | Propiedades obligatorias | Propiedades opcionales útiles |
| --- | --- | --- | --- |
| `session_start` | Al cargar el menú y fijar sucursal | `session_id`, `branch_slug`, `occurred_at`, `route`, `page_type` | `referrer`, `source`, `medium`, `campaign`, `device_type`, `viewport_width`, `viewport_height` |
| `session_end` | Al cerrar/ocultar tab o terminar sesión | `session_id`, `branch_slug`, `occurred_at`, `time_spent_seconds` | `max_scroll_depth`, `events_count`, `interaction_count`, `exit_reason` |
| `search` | Cuando se confirma una búsqueda | `session_id`, `branch_slug`, `occurred_at`, `query` | `results_count`, `query_length`, `search_latency_ms`, `selected_category_id` |
| `category_view` | Al seleccionar una categoría | `session_id`, `branch_slug`, `occurred_at`, `category_id`, `category_name` | `category_position`, `category_product_count`, `previous_category_id` |
| `product_impression` | Cuando una tarjeta alcanza umbral de visibilidad | `session_id`, `branch_slug`, `occurred_at`, `product_id`, `product_name` | `category_id`, `category_name`, `product_position`, `list_type`, `visibility_ratio` |
| `product_click` | Al hacer click en una tarjeta | `session_id`, `branch_slug`, `occurred_at`, `product_id`, `product_name` | `category_id`, `category_name`, `product_position`, `list_type`, `time_since_session_start_ms` |
| `scroll_depth` | Al alcanzar hitos de scroll predefinidos | `session_id`, `branch_slug`, `occurred_at`, `depth_percent` | `scroll_direction`, `viewport_height_px`, `content_height_px`, `visible_products_count`, `active_category_id`, `milestone_index` |

#### Eventos nuevos recomendados

| Evento | Objetivo | Propiedades clave |
| --- | --- | --- |
| `menu_loaded` | Medir carga real del menú | `load_time_ms`, `products_count`, `categories_count`, `source` |
| `search_no_results` | Detectar demanda no satisfecha | `query`, `results_count = 0`, `selected_category_id` |
| `category_clear` | Medir retorno a vista global | `previous_category_id`, `previous_category_name` |
| `product_modal_open` | Medir intención fuerte | `product_id`, `product_name`, `product_position`, `entry_point` |
| `product_modal_close` | Medir lectura/engagement | `product_id`, `dwell_time_ms`, `close_reason` |
| `out_of_stock_view` | Medir interés frustrado | `product_id`, `product_name`, `product_position`, `list_type` |
| `cta_order_click` | Medir conversión | `product_id`, `cta_type`, `destination`, `value` |
| `menu_exit` | Medir abandono | `exit_reason`, `last_visible_product_id`, `max_scroll_depth` |

### 9.6.5 Scroll: contrato más específico y útil

El scroll no debería quedar reducido a un único `depth: 25`. Es una señal crítica para entender exploración, fatiga y abandono. Conviene modelarlo con mayor precisión y con dos niveles:

1. `scroll_depth` para hitos discretos comparables entre sesiones.
2. `session_end.max_scroll_depth` para guardar la profundidad máxima alcanzada aunque no coincida exactamente con un hito.

#### Definición recomendada de `scroll_depth`

| Campo | Tipo | Requerido | Regla |
| --- | --- | --- | --- |
| `depth_percent` | `integer` | Sí | Valor del hito alcanzado. Recomiendo `10, 25, 50, 75, 90, 100`. |
| `max_depth_percent` | `integer` | Sí | Máximo alcanzado hasta ese momento. |
| `milestone_index` | `integer` | Sí | Orden del hito dentro de la sesión: `1`, `2`, `3`... |
| `scroll_direction` | `enum` | No | `down`, `up`. Normalmente `down` para este evento. |
| `viewport_height_px` | `integer` | Sí | Alto del viewport al disparar. |
| `content_height_px` | `integer` | Sí | Alto total de la página o contenedor. |
| `viewport_bottom_px` | `integer` | No | Posición inferior del viewport. |
| `visible_products_count` | `integer` | No | Cantidad de productos visibles en ese instante. |
| `first_visible_product_id` | `integer` | No | Primer producto visible al cruzar el hito. |
| `last_visible_product_id` | `integer` | No | Último producto visible al cruzar el hito. |
| `active_category_id` | `integer` | No | Categoría seleccionada en ese momento. |
| `active_search` | `boolean` | No | Si había búsqueda aplicada. |
| `time_since_session_start_ms` | `integer` | No | Tiempo transcurrido desde `session_start`. |

#### Ejemplo de payload de `scroll_depth`

```json
{
   "event": "scroll_depth",
   "event_version": 1,
   "occurred_at": "2026-06-17T21:17:44.800Z",
   "session_id": "1cf0c7c4-b3c1-4c57-b1f3-36bcb8968e3f",
   "branch_slug": "don-carlos",
   "page_type": "menu",
   "route": "/menu/don-carlos",
   "device_type": "mobile",
   "data": {
      "depth_percent": 50,
      "max_depth_percent": 53,
      "milestone_index": 2,
      "viewport_height_px": 844,
      "content_height_px": 3860,
      "viewport_bottom_px": 2039,
      "visible_products_count": 6,
      "first_visible_product_id": 12,
      "last_visible_product_id": 17,
      "active_category_id": 3,
      "active_search": false,
      "time_since_session_start_ms": 11400
   }
}
```

#### Reglas para que scroll sea analíticamente fuerte

- Mantener hitos discretos para comparabilidad histórica.
- Guardar también profundidad máxima al final de sesión.
- No enviar un evento por cada pixel o frame.
- Registrar el contexto visible al momento del hito, no arrays completos de todos los productos, para no inflar payload.
- Diferenciar scroll con filtro/categoría/búsqueda activa, porque cambiarán mucho la interpretación del comportamiento.

### 9.6.6 Reglas de nomenclatura y validación

- Todos los eventos en `snake_case`.
- Todas las propiedades en `snake_case`.
- IDs internos como `integer` cuando correspondan al dominio actual.
- Fechas siempre en ISO-8601 UTC dentro del payload y `ts` numérico para almacenamiento/consulta rápida.
- Campos booleanos solo como `true` / `false`, nunca `0` / `1` dentro del JSON.
- Enumeraciones cerradas para evitar cardinalidad caótica.
- No reutilizar un mismo campo con significados distintos según el evento.

### 9.6.7 Métricas que este diccionario habilita a futuro

Con este contrato, además de lo actual, se podría medir con más precisión:

- Tiempo hasta primera interacción.
- Tiempo hasta primer click de producto.
- Profundidad máxima real por sesión.
- CTR por posición del producto en la grilla.
- Impacto de destacados versus listado general.
- Conversión por canal de entrada.
- Búsquedas sin resultados por sucursal, horario y categoría activa.
- Interés en productos no disponibles.
- Abandono temprano con baja profundidad de scroll.
- Comparación de navegación entre mobile y desktop.

### 9.6.8 Recomendación práctica de implementación

Paso inicial razonable para este proyecto:

1. Mantener `analytics_events` como tabla raw.
2. Formalizar este diccionario como documento vivo en el repo.
3. Añadir `event_version`, `occurred_at` y metadatos base en frontend.
4. Validar en backend por evento con esquema estricto.
5. Rechazar o marcar eventos inválidos para no contaminar métricas.
6. Enriquecer específicamente `scroll_depth`, `product_impression` y `product_click`, porque son los eventos con mejor señal inmediata para UX y BI.

### 9.6.9 Salud de datos y auditoría

Además del almacenamiento en `analytics_events`, el backend ahora conserva rechazos de tracking en `analytics_event_rejections`. Esto permite:

- Detectar eventos mal formados sin perder trazabilidad.
- Mostrar tasa de aceptación del tracking en panel admin.
- Identificar qué evento falla más y por qué.
- Auditar regresiones de frontend o cambios de contrato BI.

Endpoints relacionados:

- `POST /api/analytics/batch`: acepta válidos y persiste rechazos con detalle.
- `GET /api/analytics/stats`: devuelve métricas de negocio del menú.
- `GET /api/analytics/health`: devuelve salud de datos para dashboards o integraciones futuras.

## 10. Plan de evolución sugerido (30/60/90 días)

### 0-30 días

1. Definir diccionario de eventos BI (nombres, propiedades, tipos).
2. Añadir eventos faltantes críticos.
3. Incorporar validación de payload de analytics en backend.
4. Crear dashboard de salud de datos (eventos inválidos, nulos, duplicados).

### 31-60 días

1. Agregar KPIs derivados (abandono, tiempo a primer click, no-resultados).
2. Implementar índices SQL y mejorar consultas pesadas.
3. Exportación de métricas (CSV o endpoint resumido para BI externo).

### 61-90 días

1. Cohortes y tendencias semanales.
2. Alertas automáticas (picos de faltantes, caída abrupta de sesiones/CTR).
3. Recomendador simple de “destacados sugeridos” por performance.

## 11. Riesgos actuales a tener en cuenta

1. Crecimiento de `analytics_events` sin política clara de retención.
2. Dependencia de tracking cliente (adblock, pérdida de beacon, cierre abrupto).
3. Ausencia de suite de tests para cambios sensibles.
4. Defaults de seguridad que deben endurecerse para producción.

## 12. Siguientes pasos recomendados para el equipo

1. Formalizar contrato de eventos BI (documento vivo + validación automática).
2. Priorizar un KPI de negocio principal por trimestre (ejemplo: CTR o conversión a pedido).
3. Conectar métricas de comportamiento con decisiones operativas:
   - Ajuste de destacados.
   - Reordenamiento de categorías.
   - Mejora de disponibilidad de productos críticos.

---

Si quieres, en una segunda iteración puedo agregar:

- Tabla completa de endpoints con request/response de ejemplo.
- Guía de troubleshooting por entorno (Windows/macOS/Linux).
- Plantilla de diccionario de eventos BI lista para usar.