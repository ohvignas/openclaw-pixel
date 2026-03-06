import { describe, it, expect, afterAll } from 'vitest'
import { getOrCreateWorkspace } from '../lib/workspace.js'
import { prisma } from '../lib/db.js'

describe('getOrCreateWorkspace', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates workspace with 500 coins on first call', async () => {
    const ws = await getOrCreateWorkspace()
    expect(ws.coins).toBeGreaterThanOrEqual(500)
    expect(ws.name).toBe('Mon OpenClaw')
    expect(ws.id).toBe('default')
  })

  it('returns same workspace on subsequent calls', async () => {
    const ws1 = await getOrCreateWorkspace()
    const ws2 = await getOrCreateWorkspace()
    expect(ws1.id).toBe(ws2.id)
  })
})
