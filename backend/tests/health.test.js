const request = require('supertest')

let app

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_value_1234567890123456'
  const { createApp } = require('../src/app')
  app = createApp()
})

describe('GET /api/health', () => {
  it('returns service status ok', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
    expect(typeof res.body.timestamp).toBe('string')
  })
})
