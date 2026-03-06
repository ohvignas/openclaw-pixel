import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { economyRouter } from '../routes/economy.js'
import { prisma } from '../lib/db.js'

const app = express()
app.use(express.json())
app.use('/api/economy', economyRouter)

describe('GET /api/economy/balance', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns coins and workspace name', async () => {
    const res = await request(app).get('/api/economy/balance')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('coins')
    expect(res.body).toHaveProperty('name')
    expect(typeof res.body.coins).toBe('number')
  })
})

describe('GET /api/economy/inventory', () => {
  it('returns array', async () => {
    const res = await request(app).get('/api/economy/inventory')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /api/economy/purchase', () => {
  it('rejects purchase when insufficient coins', async () => {
    const res = await request(app)
      .post('/api/economy/purchase')
      .send({ itemId: 'desk', price: 999999 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('insufficient_coins')
  })

  it('purchases item and deducts coins', async () => {
    const res = await request(app)
      .post('/api/economy/purchase')
      .send({ itemId: 'plant_test', price: 10 })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(typeof res.body.newBalance).toBe('number')
  })
})

describe('POST /api/economy/coins/add', () => {
  it('adds coins and records transaction', async () => {
    const balanceBefore = (await request(app).get('/api/economy/balance')).body.coins
    const res = await request(app)
      .post('/api/economy/coins/add')
      .send({ agentId: 'agent-test', tokens: 10 })
    expect(res.status).toBe(200)
    expect(res.body.added).toBe(10)
    expect(res.body.newBalance).toBe(balanceBefore + 10)
  })
})
