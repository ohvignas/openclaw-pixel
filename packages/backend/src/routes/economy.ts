import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { getOrCreateWorkspace } from '../lib/workspace.js'

export const economyRouter = Router()

economyRouter.get('/balance', async (_req, res) => {
  try {
    const ws = await getOrCreateWorkspace()
    const totalEarned = await prisma.coinTransaction.aggregate({
      where: { workspaceId: ws.id, amount: { gt: 0 } },
      _sum: { amount: true },
    })
    res.json({
      coins: ws.coins,
      name: ws.name,
      totalEarned: totalEarned._sum.amount ?? 0,
    })
  } catch (err) {
    res.status(500).json({ error: 'internal_error' })
  }
})

economyRouter.get('/inventory', async (_req, res) => {
  try {
    const ws = await getOrCreateWorkspace()
    const items = await prisma.inventoryItem.findMany({
      where: { workspaceId: ws.id },
    })
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: 'internal_error' })
  }
})

economyRouter.post('/purchase', async (req, res) => {
  try {
    const { itemId, price } = req.body as { itemId: string; price: number }
    if (!itemId || typeof price !== 'number') {
      res.status(400).json({ error: 'invalid_params' })
      return
    }
    const ws = await getOrCreateWorkspace()
    if (ws.coins < price) {
      res.status(400).json({ error: 'insufficient_coins' })
      return
    }
    const [updatedWs] = await prisma.$transaction([
      prisma.workspace.update({
        where: { id: ws.id },
        data: { coins: { decrement: price } },
      }),
      prisma.inventoryItem.upsert({
        where: { workspaceId_itemId: { workspaceId: ws.id, itemId } },
        update: { quantity: { increment: 1 } },
        create: { workspaceId: ws.id, itemId, quantity: 1 },
      }),
      prisma.coinTransaction.create({
        data: { workspaceId: ws.id, amount: -price, reason: 'shop_purchase' },
      }),
    ])
    res.json({ ok: true, newBalance: updatedWs.coins })
  } catch (err) {
    res.status(500).json({ error: 'internal_error' })
  }
})

economyRouter.post('/coins/add', async (req, res) => {
  try {
    const { agentId, tokens } = req.body as { agentId: string; tokens: number }
    if (typeof tokens !== 'number' || tokens <= 0) {
      res.status(400).json({ error: 'invalid_tokens' })
      return
    }
    const ws = await getOrCreateWorkspace()
    const [updatedWs] = await prisma.$transaction([
      prisma.workspace.update({
        where: { id: ws.id },
        data: { coins: { increment: tokens } },
      }),
      prisma.coinTransaction.create({
        data: { workspaceId: ws.id, amount: tokens, reason: 'agent_tokens', agentId },
      }),
    ])
    res.json({ added: tokens, newBalance: updatedWs.coins })
  } catch (err) {
    res.status(500).json({ error: 'internal_error' })
  }
})
