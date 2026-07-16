const request = require('supertest')

let app

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_value_1234567890123456'
  const { createApp } = require('../src/app')
  app = createApp()
})

describe('POST /api/analytics/batch', () => {
  it('rejects invalid event envelope early', async () => {
    const res = await request(app)
      .post('/api/analytics/batch')
      .send([{}])

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('event es requerido')
  })

  it('rejects non-array payloads', async () => {
    const res = await request(app)
      .post('/api/analytics/batch')
      .send({ event: 'session_start' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('array de eventos')
  })
})
