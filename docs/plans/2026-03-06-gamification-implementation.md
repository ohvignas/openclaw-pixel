# Gamification Habbo/Sims — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter la gamification style Habbo/Sims à l'UI pixel art Open Claw : customisation salle, boutique avec coins, écran PC par agent.

**Architecture:** SQLite + Prisma côté backend pour coins/inventaire. Zustand `economyStore` côté frontend synchro via API REST. CoinEngine intercepte les events WS gateway pour accumuler des coins. UI en 3 couches : Shop Overlay, Inventory Bar (mode Edit), AgentScreen (WinXP).

**Tech Stack:** Prisma 5 + SQLite, Express, Vitest, React 19, Zustand, Tailwind, Canvas 2D, PixelLab MCP

---

## Sprint 1 — Backend : Prisma + SQLite

### Task 1: Installer Prisma dans le backend

**Files:**
- Modify: `packages/backend/package.json`
- Create: `packages/backend/prisma/schema.prisma`
- Create: `packages/backend/prisma/.gitkeep` (dossier data/)

**Step 1: Installer les dépendances**

```bash
cd packages/backend
npm install prisma @prisma/client
npx prisma init --datasource-provider sqlite
```

**Step 2: Remplacer le contenu de `packages/backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Workspace {
  id        String   @id @default(cuid())
  name      String   @default("Mon OpenClaw")
  coins     Int      @default(500)
  createdAt DateTime @default(now())

  inventory    InventoryItem[]
  transactions CoinTransaction[]
}

model InventoryItem {
  id          String    @id @default(cuid())
  workspaceId String
  itemId      String
  quantity    Int       @default(1)
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  @@unique([workspaceId, itemId])
}

model CoinTransaction {
  id          String    @id @default(cuid())
  workspaceId String
  amount      Int
  reason      String
  agentId     String?
  createdAt   DateTime  @default(now())
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}
```

**Step 3: Ajouter DATABASE_URL dans `.env`**

```bash
echo 'DATABASE_URL="file:./prisma/data/openclaw.db"' >> .env
```

Créer le dossier data :
```bash
mkdir -p packages/backend/prisma/data
touch packages/backend/prisma/data/.gitkeep
```

**Step 4: Générer le client Prisma + créer la DB**

```bash
cd packages/backend
npx prisma migrate dev --name init
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

**Step 5: Ajouter le script generate dans `packages/backend/package.json`**

Ajouter dans `"scripts"` :
```json
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate",
"postinstall": "prisma generate"
```

**Step 6: Commit**

```bash
git add packages/backend/prisma packages/backend/package.json .env
git commit -m "feat: add Prisma SQLite schema (workspace, inventory, transactions)"
```

---

### Task 2: Singleton Prisma client + workspace par défaut

**Files:**
- Create: `packages/backend/src/lib/db.ts`
- Create: `packages/backend/src/lib/workspace.ts`

**Step 1: Écrire le test**

Créer `packages/backend/src/__tests__/workspace.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { getOrCreateWorkspace } from '../lib/workspace.js'

describe('workspace', () => {
  it('creates workspace with 500 coins on first call', async () => {
    const ws = await getOrCreateWorkspace()
    expect(ws.coins).toBe(500)
    expect(ws.name).toBe('Mon OpenClaw')
  })

  it('returns same workspace on subsequent calls', async () => {
    const ws1 = await getOrCreateWorkspace()
    const ws2 = await getOrCreateWorkspace()
    expect(ws1.id).toBe(ws2.id)
  })
})
```

**Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
cd packages/backend && npm test -- workspace
```
Expected: FAIL — `Cannot find module '../lib/workspace.js'`

**Step 3: Créer `packages/backend/src/lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**Step 4: Créer `packages/backend/src/lib/workspace.ts`**

```typescript
import { prisma } from './db.js'

const WORKSPACE_ID = 'default'

export async function getOrCreateWorkspace() {
  return prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: {
      id: WORKSPACE_ID,
      name: 'Mon OpenClaw',
      coins: 500,
    },
  })
}
```

**Step 5: Lancer le test**

```bash
cd packages/backend && npm test -- workspace
```
Expected: PASS

**Step 6: Commit**

```bash
git add packages/backend/src/lib packages/backend/src/__tests__/workspace.test.ts
git commit -m "feat: add Prisma singleton + default workspace upsert"
```

---

### Task 3: Route `/api/economy` — balance + inventaire

**Files:**
- Create: `packages/backend/src/routes/economy.ts`
- Modify: `packages/backend/src/index.ts`

**Step 1: Écrire les tests**

Créer `packages/backend/src/__tests__/economy.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import { economyRouter } from '../routes/economy.js'

const app = express()
app.use(express.json())
app.use('/api/economy', economyRouter)

describe('GET /api/economy/balance', () => {
  it('returns coins and workspace name', async () => {
    const res = await request(app).get('/api/economy/balance')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('coins')
    expect(res.body).toHaveProperty('name')
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
      .send({ itemId: 'plant', price: 50 })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(typeof res.body.newBalance).toBe('number')
  })
})

describe('POST /api/economy/coins/add', () => {
  it('adds coins and records transaction', async () => {
    const res = await request(app)
      .post('/api/economy/coins/add')
      .send({ agentId: 'agent-1', tokens: 10 })
    expect(res.status).toBe(200)
    expect(res.body.added).toBe(10)
    expect(typeof res.body.newBalance).toBe('number')
  })
})
```

**Step 2: Lancer pour vérifier l'échec**

```bash
cd packages/backend && npm test -- economy
```
Expected: FAIL — `Cannot find module '../routes/economy.js'`

**Step 3: Créer `packages/backend/src/routes/economy.ts`**

```typescript
import { Router } from 'express'
import { prisma } from '../lib/db.js'
import { getOrCreateWorkspace } from '../lib/workspace.js'

export const economyRouter = Router()

// GET /api/economy/balance
economyRouter.get('/balance', async (_req, res) => {
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
})

// GET /api/economy/inventory
economyRouter.get('/inventory', async (_req, res) => {
  const ws = await getOrCreateWorkspace()
  const items = await prisma.inventoryItem.findMany({
    where: { workspaceId: ws.id },
  })
  res.json(items)
})

// POST /api/economy/purchase
economyRouter.post('/purchase', async (req, res) => {
  const { itemId, price } = req.body as { itemId: string; price: number }
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
      data: {
        workspaceId: ws.id,
        amount: -price,
        reason: 'shop_purchase',
      },
    }),
  ])

  res.json({ ok: true, newBalance: updatedWs.coins })
})

// POST /api/economy/coins/add
economyRouter.post('/coins/add', async (req, res) => {
  const { agentId, tokens } = req.body as { agentId: string; tokens: number }
  const ws = await getOrCreateWorkspace()

  const [updatedWs] = await prisma.$transaction([
    prisma.workspace.update({
      where: { id: ws.id },
      data: { coins: { increment: tokens } },
    }),
    prisma.coinTransaction.create({
      data: {
        workspaceId: ws.id,
        amount: tokens,
        reason: 'agent_tokens',
        agentId,
      },
    }),
  ])

  res.json({ added: tokens, newBalance: updatedWs.coins })
})
```

**Step 4: Brancher dans `packages/backend/src/index.ts`**

Ajouter après les imports existants :
```typescript
import { economyRouter } from "./routes/economy.js";
```
Ajouter après `app.use("/api/cli", cliRouter)` :
```typescript
app.use("/api/economy", economyRouter);
```

**Step 5: Lancer les tests**

```bash
cd packages/backend && npm test -- economy
```
Expected: PASS (4 tests)

**Step 6: Commit**

```bash
git add packages/backend/src/routes/economy.ts packages/backend/src/index.ts
git commit -m "feat: add /api/economy routes (balance, inventory, purchase, coins/add)"
```

---

## Sprint 2 — Frontend : economyStore + CoinEngine

### Task 4: Zustand economyStore

**Files:**
- Create: `packages/frontend/src/store/economyStore.ts`

**Step 1: Créer `packages/frontend/src/store/economyStore.ts`**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface InventoryItem {
  id: string
  workspaceId: string
  itemId: string
  quantity: number
}

interface EconomyState {
  coins: number
  inventory: InventoryItem[]
  loading: boolean
  fetchBalance: () => Promise<void>
  fetchInventory: () => Promise<void>
  purchase: (itemId: string, price: number) => Promise<boolean>
  addCoins: (agentId: string, tokens: number) => Promise<void>
}

export const useEconomyStore = create<EconomyState>()(
  persist(
    (set, get) => ({
      coins: 0,
      inventory: [],
      loading: false,

      fetchBalance: async () => {
        const res = await fetch('/api/economy/balance')
        const data = await res.json()
        set({ coins: data.coins })
      },

      fetchInventory: async () => {
        const res = await fetch('/api/economy/inventory')
        const data = await res.json()
        set({ inventory: data })
      },

      purchase: async (itemId, price) => {
        const res = await fetch('/api/economy/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, price }),
        })
        if (!res.ok) return false
        const data = await res.json()
        set({ coins: data.newBalance })
        await get().fetchInventory()
        return true
      },

      addCoins: async (agentId, tokens) => {
        if (tokens <= 0) return
        const res = await fetch('/api/economy/coins/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, tokens }),
        })
        if (!res.ok) return
        const data = await res.json()
        set({ coins: data.newBalance })
      },
    }),
    {
      name: 'economy-store',
      partialize: (state) => ({ coins: state.coins }),
    },
  ),
)
```

**Step 2: Commit**

```bash
git add packages/frontend/src/store/economyStore.ts
git commit -m "feat: add economyStore (coins, inventory, purchase, addCoins)"
```

---

### Task 5: CoinEngine — tokens WS → coins

**Files:**
- Create: `packages/frontend/src/economy/coinEngine.ts`

Le CoinEngine observe les events OpenClaw et extrait le token count des events `agent:lifecycle:end` pour créditer des coins.

**Step 1: Créer `packages/frontend/src/economy/coinEngine.ts`**

```typescript
import type { OpenClawEvent } from '../openclaw/types.ts'
import { useEconomyStore } from '../store/economyStore.ts'

/**
 * Extrait le nombre de tokens consommes depuis un event OpenClaw.
 * Format payload: { usage: { inputTokens, outputTokens } } ou { tokens: N }
 */
function extractTokens(event: OpenClawEvent): { agentId: string; tokens: number } | null {
  if (event.type !== 'event') return null

  const payload = (event.payload ?? {}) as Record<string, unknown>

  // Format 1: event "agent" avec stream lifecycle + usage
  if (event.event === 'agent') {
    const data = (payload.data ?? {}) as Record<string, unknown>
    const usage = data.usage as Record<string, number> | undefined
    if (usage) {
      const total = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
      if (total > 0) {
        const sessionKey = typeof payload.sessionKey === 'string' ? payload.sessionKey : ''
        const agentId = sessionKey.split(':')[1] || 'default'
        return { agentId, tokens: total }
      }
    }
  }

  // Format 2: event direct avec tokens dans payload
  if (typeof payload.tokens === 'number' && payload.tokens > 0) {
    const agentId = typeof payload.agentId === 'string' ? payload.agentId : 'default'
    return { agentId, tokens: payload.tokens }
  }

  return null
}

export function processCoinEvent(event: OpenClawEvent): void {
  const result = extractTokens(event)
  if (!result) return
  const { addCoins } = useEconomyStore.getState()
  addCoins(result.agentId, result.tokens)
}
```

**Step 2: Brancher dans `packages/frontend/src/App.tsx`**

Dans `App.tsx`, trouver où les events WS sont traités (autour de `parseEvent`) et ajouter :

```typescript
import { processCoinEvent } from './economy/coinEngine.ts'

// Dans le handler d'events (là où parseEvent est appelé) :
processCoinEvent(rawEvent)
```

**Step 3: Initialiser le store au démarrage dans `App.tsx`**

Dans le `useEffect` de bootstrap :
```typescript
const { fetchBalance, fetchInventory } = useEconomyStore.getState()
fetchBalance()
fetchInventory()
```

**Step 4: Commit**

```bash
git add packages/frontend/src/economy packages/frontend/src/App.tsx
git commit -m "feat: add CoinEngine - intercepts WS events to award coins from tokens"
```

---

## Sprint 3 — Shop Overlay

### Task 6: Catalogue du shop + prix des items

**Files:**
- Create: `packages/frontend/src/economy/shopCatalog.ts`

Ce fichier définit tous les items achetables avec leur prix et leur catégorie.

**Step 1: Créer `packages/frontend/src/economy/shopCatalog.ts`**

```typescript
export interface ShopItem {
  id: string
  label: string
  category: ShopCategory
  price: number
  /** Chemin vers le PNG dans /assets/ ou /images_pixel/ */
  imagePath: string
  /** Si true, peut en acheter plusieurs */
  stackable: boolean
  /** Si l'item correspond a un type de furniture existant */
  furnitureType?: string
}

export type ShopCategory = 'desks' | 'chairs' | 'decor' | 'tech' | 'storage' | 'floors' | 'walls'

export const SHOP_CATALOG: ShopItem[] = [
  // Desks
  { id: 'desk',          label: 'Bureau',          category: 'desks',   price: 120, imagePath: '/assets/office/desk.png',          stackable: true,  furnitureType: 'desk' },
  { id: 'writing-table', label: 'Table d\'ecriture', category: 'desks', price: 90,  imagePath: '/assets/office/writing-table.png', stackable: true,  furnitureType: 'writing-table' },
  { id: 'stamping-table', label: 'Table tampon',    category: 'desks',   price: 80,  imagePath: '/assets/office/stamping-table.png',stackable: true,  furnitureType: 'stamping-table' },

  // Chaises
  { id: 'chair',         label: 'Chaise',          category: 'chairs',  price: 40,  imagePath: '/assets/office/Chair.png',         stackable: true,  furnitureType: 'chair' },

  // Tech
  { id: 'PC1',           label: 'PC Gamer',        category: 'tech',    price: 75,  imagePath: '/assets/office/PC1.png',           stackable: true,  furnitureType: 'pc' },
  { id: 'PC2',           label: 'PC Pro',          category: 'tech',    price: 75,  imagePath: '/assets/office/PC2.png',           stackable: true,  furnitureType: 'pc' },
  { id: 'printer',       label: 'Imprimante',      category: 'tech',    price: 60,  imagePath: '/assets/office/printer.png',       stackable: true },

  // Decor
  { id: 'plant',         label: 'Plante',          category: 'decor',   price: 30,  imagePath: '/assets/office/plant.png',         stackable: true,  furnitureType: 'plant' },
  { id: 'window',        label: 'Fenetre',         category: 'decor',   price: 50,  imagePath: '/assets/office/Window.png',        stackable: true },
  { id: 'water-cooler',  label: 'Fontaine',        category: 'decor',   price: 35,  imagePath: '/assets/office/water-cooler.png',  stackable: true },
  { id: 'coffee-maker',  label: 'Cafetiere',       category: 'decor',   price: 45,  imagePath: '/assets/office/coffee-maker.png',  stackable: true },

  // Storage
  { id: 'cabinet',       label: 'Armoire',         category: 'storage', price: 65,  imagePath: '/assets/office/cabinet.png',       stackable: true },
  { id: 'sink',          label: 'Evier',           category: 'storage', price: 40,  imagePath: '/assets/office/sink.png',          stackable: true },
  { id: 'trash',         label: 'Poubelle',        category: 'decor',   price: 15,  imagePath: '/assets/office/Trash.png',         stackable: true },
]

export const SHOP_CATEGORIES: Array<{ id: ShopCategory; label: string; icon: string }> = [
  { id: 'desks',   label: 'Bureaux',   icon: '🖥' },
  { id: 'chairs',  label: 'Chaises',   icon: '🪑' },
  { id: 'tech',    label: 'Tech',      icon: '💻' },
  { id: 'decor',   label: 'Déco',      icon: '🌿' },
  { id: 'storage', label: 'Stockage',  icon: '🗄' },
  { id: 'floors',  label: 'Sols',      icon: '🟫' },
  { id: 'walls',   label: 'Murs',      icon: '🧱' },
]
```

**Step 2: Copier les sprites Office dans les assets publics**

```bash
mkdir -p packages/frontend/public/assets/office
cp /Users/antoinevigneau/TEST/images_pixel/Office/*.png packages/frontend/public/assets/office/
```

**Step 3: Commit**

```bash
git add packages/frontend/src/economy/shopCatalog.ts packages/frontend/public/assets/office/
git commit -m "feat: add shop catalog + copy Office sprites to public assets"
```

---

### Task 7: Composant ShopOverlay

**Files:**
- Create: `packages/frontend/src/components/ShopOverlay.tsx`
- Modify: `packages/frontend/src/components/TopBar.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Step 1: Créer `packages/frontend/src/components/ShopOverlay.tsx`**

```tsx
import { useState } from 'react'
import { useEconomyStore } from '../store/economyStore.ts'
import { SHOP_CATALOG, SHOP_CATEGORIES, type ShopCategory } from '../economy/shopCatalog.ts'

interface ShopOverlayProps {
  onClose: () => void
}

export function ShopOverlay({ onClose }: ShopOverlayProps) {
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('desks')
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const { coins, inventory, purchase } = useEconomyStore()

  const items = SHOP_CATALOG.filter((i) => i.category === activeCategory)

  const getQuantity = (itemId: string) =>
    inventory.find((i) => i.itemId === itemId)?.quantity ?? 0

  const handleBuy = async (itemId: string, price: number) => {
    setPurchasing(itemId)
    await purchase(itemId, price)
    setPurchasing(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[800px] max-h-[600px] bg-pixel-panel border-2 border-pixel-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-pixel-border bg-pixel-bg">
          <span className="font-pixel text-xs text-pixel-accent">BOUTIQUE</span>
          <div className="flex items-center gap-4">
            <span className="font-pixel text-xs text-yellow-400">
              <img src="/assets/coin.png" className="inline w-4 h-4 mr-1 image-rendering-pixelated" alt="coins" />
              {coins.toLocaleString()} coins
            </span>
            <button
              className="font-pixel text-xs text-gray-400 hover:text-white px-2"
              onClick={onClose}
            >
              [X]
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar categories */}
          <div className="w-36 border-r border-pixel-border flex flex-col py-2">
            {SHOP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`text-left px-3 py-2 font-pixel text-xs transition-colors ${
                  activeCategory === cat.id
                    ? 'text-pixel-accent bg-pixel-border'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* Grid items */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-3">
              {items.map((item) => {
                const qty = getQuantity(item.id)
                const canAfford = coins >= item.price
                const isBuying = purchasing === item.id

                return (
                  <div
                    key={item.id}
                    className="border border-pixel-border bg-pixel-bg p-2 flex flex-col items-center gap-1"
                  >
                    <div className="w-16 h-16 flex items-center justify-center bg-pixel-panel">
                      <img
                        src={item.imagePath}
                        alt={item.label}
                        className="max-w-full max-h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <span className="font-pixel text-xs text-white text-center leading-tight">
                      {item.label}
                    </span>
                    <span className="font-pixel text-xs text-yellow-400">
                      {item.price}c
                    </span>
                    {qty > 0 && (
                      <span className="font-pixel text-xs text-pixel-green">
                        x{qty} possede
                      </span>
                    )}
                    <button
                      disabled={!canAfford || isBuying}
                      onClick={() => handleBuy(item.id, item.price)}
                      className={`w-full font-pixel text-xs py-1 mt-1 transition-colors ${
                        canAfford
                          ? 'bg-pixel-accent text-white hover:opacity-80'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isBuying ? '...' : canAfford ? 'Acheter' : 'Insuffisant'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Ajouter bouton SHOP dans `packages/frontend/src/components/TopBar.tsx`**

Dans les props, ajouter :
```typescript
onShopClick: () => void
```

Dans le JSX, ajouter avant le bouton `+ AGENT` :
```tsx
<button
  className="font-pixel text-xs px-2 py-1 border text-yellow-400 border-yellow-600 hover:bg-pixel-bg transition-colors"
  onClick={onShopClick}
  title="Boutique"
>
  SHOP
</button>
```

Afficher le solde de coins dans la TopBar :
```tsx
<span className="font-pixel text-xs text-yellow-400">💰 {coins}</span>
```

Ajouter dans le composant :
```typescript
const coins = useEconomyStore((s) => s.coins)
```

**Step 3: Brancher dans `packages/frontend/src/App.tsx`**

```typescript
import { ShopOverlay } from './components/ShopOverlay.tsx'
import { useEconomyStore } from './store/economyStore.ts'

// Dans le state local :
const [showShop, setShowShop] = useState(false)

// Dans le JSX :
{showShop && <ShopOverlay onClose={() => setShowShop(false)} />}
```

Passer `onShopClick={() => setShowShop(true)}` à `<TopBar>`.

**Step 4: Commit**

```bash
git add packages/frontend/src/components/ShopOverlay.tsx packages/frontend/src/components/TopBar.tsx packages/frontend/src/App.tsx
git commit -m "feat: add ShopOverlay with categories, item grid, purchase flow"
```

---

## Sprint 4 — Inventory Bar + Placement

### Task 8: InventoryBar (mode Edit)

**Files:**
- Create: `packages/frontend/src/components/InventoryBar.tsx`

**Step 1: Créer `packages/frontend/src/components/InventoryBar.tsx`**

```tsx
import { useState } from 'react'
import { useEconomyStore } from '../store/economyStore.ts'
import { SHOP_CATALOG, SHOP_CATEGORIES, type ShopCategory } from '../economy/shopCatalog.ts'

interface InventoryBarProps {
  onSelectItem: (itemId: string | null) => void
  selectedItem: string | null
}

export function InventoryBar({ onSelectItem, selectedItem }: InventoryBarProps) {
  const [activeCategory, setActiveCategory] = useState<ShopCategory | 'all'>('all')
  const { inventory } = useEconomyStore()

  const ownedItems = SHOP_CATALOG.filter((item) => {
    const invItem = inventory.find((i) => i.itemId === item.id)
    if (!invItem || invItem.quantity <= 0) return false
    if (activeCategory === 'all') return true
    return item.category === activeCategory
  })

  return (
    <div className="h-28 bg-pixel-panel border-t-2 border-pixel-border flex flex-col">
      {/* Category tabs */}
      <div className="flex gap-1 px-2 pt-1 border-b border-pixel-border">
        <button
          onClick={() => setActiveCategory('all')}
          className={`font-pixel text-xs px-2 py-0.5 ${activeCategory === 'all' ? 'text-pixel-accent' : 'text-gray-500'}`}
        >
          Tout
        </button>
        {SHOP_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`font-pixel text-xs px-2 py-0.5 ${activeCategory === cat.id ? 'text-pixel-accent' : 'text-gray-500'}`}
          >
            {cat.icon}
          </button>
        ))}
        <div className="flex-1" />
        <span className="font-pixel text-xs text-gray-600 py-0.5">
          INVENTAIRE — clic pour placer
        </span>
      </div>

      {/* Items */}
      <div className="flex gap-2 px-2 py-1 overflow-x-auto flex-1 items-center">
        {ownedItems.length === 0 ? (
          <span className="font-pixel text-xs text-gray-600">
            Aucun item — achetez dans la boutique
          </span>
        ) : (
          ownedItems.map((item) => {
            const qty = inventory.find((i) => i.itemId === item.id)?.quantity ?? 0
            const isSelected = selectedItem === item.id

            return (
              <button
                key={item.id}
                onClick={() => onSelectItem(isSelected ? null : item.id)}
                className={`flex flex-col items-center gap-0.5 p-1 border shrink-0 transition-colors ${
                  isSelected
                    ? 'border-pixel-accent bg-pixel-border'
                    : 'border-pixel-border hover:border-gray-400'
                }`}
                title={item.label}
              >
                <div className="w-12 h-12 flex items-center justify-center bg-pixel-bg">
                  <img
                    src={item.imagePath}
                    alt={item.label}
                    className="max-w-full max-h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <span className="font-pixel text-xs text-gray-400">x{qty}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
```

**Step 2: Intégrer dans `packages/frontend/src/App.tsx`**

```typescript
import { InventoryBar } from './components/InventoryBar.tsx'

// State:
const [placingInventoryItem, setPlacingInventoryItem] = useState<string | null>(null)

// JSX (après <OfficeCanvas>, avant </div>) :
{editMode && (
  <InventoryBar
    selectedItem={placingInventoryItem}
    onSelectItem={setPlacingInventoryItem}
  />
)}
```

**Step 3: Passer `placingInventoryItem` à `OfficeCanvas`**

Dans `OfficeCanvas.tsx`, ajouter dans les props :
```typescript
placingInventoryItem?: string | null
```

Quand un item d'inventaire est sélectionné et que l'utilisateur clique sur la carte, placer le meuble correspondant (utiliser la logique `placingType` existante avec le `furnitureType` du shop catalog).

**Step 4: Commit**

```bash
git add packages/frontend/src/components/InventoryBar.tsx packages/frontend/src/App.tsx
git commit -m "feat: add InventoryBar in Edit mode with item placement"
```

---

## Sprint 5 — Customisation murs

### Task 9: Murs colorables

**Files:**
- Modify: `packages/frontend/src/office/types.ts`
- Modify: `packages/frontend/src/office/engine/renderer.ts`
- Modify: `packages/frontend/src/canvas/OfficeCanvas.tsx`

**Step 1: Ajouter `WALL_COLORABLE` dans `types.ts`**

```typescript
export const TileType = {
  WALL: 0,
  FLOOR_1: 1,
  // ...existing...
  VOID: 8,
  WALL_COLORABLE: 9,  // ← nouveau
} as const
```

**Step 2: Mettre à jour le renderer pour `WALL_COLORABLE`**

Dans `packages/frontend/src/office/engine/renderer.ts`, trouver le rendu des tiles de type WALL et ajouter une branche pour `WALL_COLORABLE` qui applique le `tileColors` comme pour les floors.

**Step 3: Color-picker dans OfficeCanvas**

Quand le mode Edit est actif et qu'on clique sur une tile `WALL` ou `FLOOR_*` :
- Afficher un petit panneau avec une palette de 16 couleurs pixel-art fixes
- La couleur choisie est stockée dans `layout.tileColors[tileIndex]`

Palette de 16 couleurs fixes (style Habbo) :
```typescript
export const PIXEL_PALETTE = [
  '#1a1a2e', '#16213e', '#0f3460', '#e94560',
  '#4ade80', '#fbbf24', '#ef4444', '#60a5fa',
  '#f97316', '#a78bfa', '#34d399', '#f472b6',
  '#ffffff', '#94a3b8', '#6b7280', '#1f2937',
]
```

**Step 4: Commit**

```bash
git commit -m "feat: add wall colorization + pixel palette color picker"
```

---

## Sprint 6 — Agent Screen (WinXP style)

### Task 10: Composant AgentScreen

**Files:**
- Create: `packages/frontend/src/components/AgentScreen/index.tsx`
- Create: `packages/frontend/src/components/AgentScreen/FilesTab.tsx`
- Create: `packages/frontend/src/components/AgentScreen/TasksTab.tsx`
- Create: `packages/frontend/src/components/AgentScreen/StatsTab.tsx`

**Step 1: Créer `packages/frontend/src/components/AgentScreen/index.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { useAgentStore } from '../../store/agentStore.ts'
import { useEconomyStore } from '../../store/economyStore.ts'
import { FilesTab } from './FilesTab.tsx'
import { TasksTab } from './TasksTab.tsx'
import { StatsTab } from './StatsTab.tsx'
import { ChatTab } from '../AgentPanel/tabs/ChatTab.tsx'

type Tab = 'files' | 'tasks' | 'stats' | 'chat' | 'config'

interface AgentScreenProps {
  agentId: string
  deskName: string
  onDeskNameChange: (name: string) => void
  onClose: () => void
  onChangeAgent: (newAgentId: string) => void
  availableAgents: Array<{ id: string; name: string; emoji: string }>
}

export function AgentScreen({
  agentId,
  deskName,
  onDeskNameChange,
  onClose,
  onChangeAgent,
  availableAgents,
}: AgentScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(deskName)
  const [showAgentPicker, setShowAgentPicker] = useState(false)

  const agent = useAgentStore((s) => s.agents[agentId])
  const coins = useEconomyStore((s) => s.coins)

  const tabs: Array<{ id: Tab; icon: string; label: string }> = [
    { id: 'tasks',  icon: '📋', label: 'Taches' },
    { id: 'files',  icon: '📁', label: 'Fichiers' },
    { id: 'stats',  icon: '📊', label: 'Stats' },
    { id: 'chat',   icon: '💬', label: 'Chat' },
    { id: 'config', icon: '⚙',  label: 'Config' },
  ]

  const statusColor =
    agent?.status === 'working' ? 'text-pixel-green' :
    agent?.status === 'waiting_approval' ? 'text-pixel-yellow' :
    agent?.status === 'error' ? 'text-pixel-red' : 'text-gray-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      {/* Fenetre WinXP */}
      <div
        className="w-[900px] h-[600px] bg-pixel-panel border-2 border-pixel-border flex flex-col"
        style={{ boxShadow: '4px 4px 0 #000' }}
      >
        {/* Barre de titre WinXP */}
        <div className="flex items-center justify-between px-3 py-1 bg-gradient-to-r from-blue-900 to-blue-700 border-b-2 border-pixel-border select-none">
          <div className="flex items-center gap-2">
            <span className="text-sm">🖥</span>
            {editingName ? (
              <input
                autoFocus
                className="bg-transparent text-white font-pixel text-xs border-b border-white outline-none"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => { onDeskNameChange(nameInput); setEditingName(false) }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            ) : (
              <button
                className="font-pixel text-xs text-white hover:text-yellow-300"
                onClick={() => setEditingName(true)}
              >
                {deskName} ✏
              </button>
            )}
            <span className="font-pixel text-xs text-blue-300">—</span>
            <span className="font-pixel text-xs text-white">{agent?.emoji} {agent?.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-5 h-5 bg-gray-600 hover:bg-gray-500 font-pixel text-xs text-white flex items-center justify-center">_</button>
            <button className="w-5 h-5 bg-gray-600 hover:bg-gray-500 font-pixel text-xs text-white flex items-center justify-center">□</button>
            <button className="w-5 h-5 bg-red-600 hover:bg-red-500 font-pixel text-xs text-white flex items-center justify-center" onClick={onClose}>X</button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 px-3 py-1 bg-pixel-bg border-b border-pixel-border">
          <span className={`font-pixel text-xs ${statusColor}`}>
            {agent?.status ?? 'idle'}
          </span>
          <span className="font-pixel text-xs text-yellow-400">💰 coins de ce poste</span>
          <div className="flex-1" />
          <div className="relative">
            <button
              className="font-pixel text-xs text-gray-400 hover:text-white border border-pixel-border px-2 py-0.5"
              onClick={() => setShowAgentPicker((v) => !v)}
            >
              Changer agent ▾
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full mt-1 bg-pixel-panel border border-pixel-border z-10 min-w-32">
                {availableAgents.map((a) => (
                  <button
                    key={a.id}
                    className="block w-full text-left px-3 py-1 font-pixel text-xs text-white hover:bg-pixel-border"
                    onClick={() => { onChangeAgent(a.id); setShowAgentPicker(false) }}
                  >
                    {a.emoji} {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-28 border-r border-pixel-border flex flex-col py-2 bg-pixel-bg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-3 py-2 font-pixel text-xs transition-colors ${
                  activeTab === tab.id
                    ? 'text-pixel-accent bg-pixel-border'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'tasks'  && <TasksTab agentId={agentId} />}
            {activeTab === 'files'  && <FilesTab agentId={agentId} />}
            {activeTab === 'stats'  && <StatsTab agentId={agentId} />}
            {activeTab === 'chat'   && <ChatTab agentId={agentId} />}
            {activeTab === 'config' && (
              <div className="p-4 font-pixel text-xs text-gray-400">
                Config agent (modele, skills, hooks) — prochaine iteration
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Créer `packages/frontend/src/components/AgentScreen/TasksTab.tsx`**

```tsx
import { useAgentStore } from '../../store/agentStore.ts'

interface TasksTabProps {
  agentId: string
}

export function TasksTab({ agentId }: TasksTabProps) {
  const events = useAgentStore((s) =>
    s.eventLog.filter((e) => e.agentId === agentId)
  )

  const done = events.filter((e) => e.status === 'idle' && e.eventType?.includes('end'))
  const inProgress = events.filter((e) => e.status === 'working')
  const pending = events.filter((e) => e.eventType === 'command:new')

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {inProgress.length > 0 && (
        <section>
          <h3 className="font-pixel text-xs text-pixel-yellow mb-2">EN COURS</h3>
          {inProgress.slice(0, 3).map((e, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b border-pixel-border">
              <span className="text-pixel-yellow">⚡</span>
              <span className="font-pixel text-xs text-white">{e.detail}</span>
              {e.tool && <span className="font-pixel text-xs text-gray-500">— {e.tool}</span>}
            </div>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h3 className="font-pixel text-xs text-pixel-green mb-2">TERMINEES</h3>
          {done.slice(0, 20).map((e, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b border-pixel-border">
              <span className="text-pixel-green">✓</span>
              <span className="font-pixel text-xs text-gray-300">{e.detail}</span>
            </div>
          ))}
        </section>
      )}

      {events.length === 0 && (
        <p className="font-pixel text-xs text-gray-600">Aucune activite enregistree</p>
      )}
    </div>
  )
}
```

**Step 3: Créer `packages/frontend/src/components/AgentScreen/FilesTab.tsx`**

```tsx
import { useState, useEffect } from 'react'

interface FilesTabProps {
  agentId: string
}

interface AgentFile {
  name: string
  path: string
  size: number
  modifiedAt: string
}

export function FilesTab({ agentId }: FilesTabProps) {
  const [files, setFiles] = useState<AgentFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AgentFile | null>(null)
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/agents/${encodeURIComponent(agentId)}/files`)
      .then((r) => r.json())
      .then((data) => { setFiles(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [agentId])

  const openFile = async (file: AgentFile) => {
    setSelected(file)
    const res = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`)
    const text = await res.text()
    setContent(text)
  }

  if (loading) return <div className="p-4 font-pixel text-xs text-gray-500">Chargement...</div>

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-48 border-r border-pixel-border overflow-y-auto">
        {files.length === 0 ? (
          <p className="p-4 font-pixel text-xs text-gray-600">Aucun fichier</p>
        ) : (
          files.map((f) => (
            <button
              key={f.path}
              onClick={() => openFile(f)}
              className={`w-full text-left px-3 py-2 font-pixel text-xs border-b border-pixel-border transition-colors ${
                selected?.path === f.path ? 'bg-pixel-border text-pixel-accent' : 'text-gray-300 hover:bg-pixel-bg'
              }`}
            >
              📄 {f.name}
            </button>
          ))
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {content ? (
          <pre className="font-pixel text-xs text-gray-300 whitespace-pre-wrap">{content}</pre>
        ) : (
          <p className="font-pixel text-xs text-gray-600">Selectionnez un fichier</p>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Créer `packages/frontend/src/components/AgentScreen/StatsTab.tsx`**

```tsx
import { useEconomyStore } from '../../store/economyStore.ts'
import { useAgentStore } from '../../store/agentStore.ts'

interface StatsTabProps {
  agentId: string
}

export function StatsTab({ agentId }: StatsTabProps) {
  const agent = useAgentStore((s) => s.agents[agentId])
  const coins = useEconomyStore((s) => s.coins)

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Statut" value={agent?.status ?? 'idle'} />
        <StatCard label="Modele" value={agent?.model ?? '—'} />
        <StatCard label="Coins workspace" value={`${coins.toLocaleString()} c`} color="text-yellow-400" />
        <StatCard label="Outil actif" value={agent?.currentTool ?? '—'} />
      </div>
      <div className="mt-4">
        <p className="font-pixel text-xs text-gray-600">
          Graphe tokens/temps — prochaine iteration
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-pixel-border p-3 bg-pixel-bg">
      <p className="font-pixel text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-pixel text-xs ${color}`}>{value}</p>
    </div>
  )
}
```

**Step 5: Route backend `/api/agents/:id/files`**

Ajouter dans `packages/backend/src/routes/files.ts` (ou nouvelle route) :

```typescript
// GET /api/agents/:id/files
filesRouter.get('/agents/:id/files', async (req, res) => {
  const agentId = req.params.id
  // Chercher le workspace de l'agent dans la config openclaw
  // Pour l'instant, retourner les fichiers du workspace courant
  const workspaceDir = process.env.OPENCLAW_WORKSPACE_DIR ?? process.env.HOME ?? '/'
  try {
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true })
    const files = entries
      .filter((e) => e.isFile() && /\.(md|ts|tsx|js|json|txt|py)$/.test(e.name))
      .map((e) => ({
        name: e.name,
        path: path.join(workspaceDir, e.name),
        size: 0,
        modifiedAt: new Date().toISOString(),
      }))
    res.json(files)
  } catch {
    res.json([])
  }
})
```

**Step 6: Brancher AgentScreen dans App.tsx**

```typescript
import { AgentScreen } from './components/AgentScreen/index.tsx'

// State:
const [agentScreenId, setAgentScreenId] = useState<string | null>(null)
const [deskNames, setDeskNames] = useState<Record<string, string>>({})

// Quand onAgentClick est appelé avec un agentId :
// setAgentScreenId(agentId)

// JSX:
{agentScreenId && (
  <AgentScreen
    agentId={agentScreenId}
    deskName={deskNames[agentScreenId] ?? 'Poste de travail'}
    onDeskNameChange={(name) => setDeskNames((p) => ({ ...p, [agentScreenId]: name }))}
    onClose={() => setAgentScreenId(null)}
    onChangeAgent={(id) => setAgentScreenId(id)}
    availableAgents={Object.values(agents)}
  />
)}
```

**Step 7: Commit**

```bash
git add packages/frontend/src/components/AgentScreen packages/frontend/src/App.tsx
git commit -m "feat: add AgentScreen WinXP-style with Tasks/Files/Stats/Chat tabs"
```

---

## Sprint 7 — Assets PixelLab MCP

### Task 11: Générer les assets manquants via PixelLab

Utiliser le MCP PixelLab pour générer les assets pixel art nécessaires.

**Step 1: Générer l'icône boutique**

Utiliser `mcp__pixellab__create_map_object` ou `mcp__pixellab__create_isometric_tile` pour :
- Icône shop (16x16 pixel art, style RPG, petit magasin/sac de coins)
- Icône inventaire (sac pixel art)
- Pièce de coin animée (déjà disponible : `images_pixel/pixel-art-coin-with-euro-symbol-8-bit-style-retro-currency-icon-for-game-design-png.png`)

**Step 2: Copier la pièce coin**

```bash
cp "images_pixel/pixel-art-coin-with-euro-symbol-8-bit-style-retro-currency-icon-for-game-design-png.png" \
   packages/frontend/public/assets/coin.png
```

**Step 3: Optimiser pour usage inline**

La pièce coin est affichée dans la TopBar et le Shop header. Redimensionner à 16x16 via CSS `image-rendering: pixelated`.

**Step 4: Commit**

```bash
git add packages/frontend/public/assets/coin.png
git commit -m "feat: add coin pixel art asset for shop/economy UI"
```

---

## Docker + Prisma en production

### Task 12: Adapter le Dockerfile pour Prisma

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

**Step 1: Ajouter `prisma generate` dans le Dockerfile**

Dans le stage builder, après `npm ci` :
```dockerfile
RUN npx prisma generate --schema=packages/backend/prisma/schema.prisma
```

**Step 2: Volume SQLite dans docker-compose.yml**

```yaml
pixel-ui:
  volumes:
    - openclaw-db:/app/packages/backend/prisma/data
  environment:
    DATABASE_URL: file:/app/packages/backend/prisma/data/openclaw.db
```

```yaml
volumes:
  openclaw-db:
```

**Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Prisma SQLite volume for Docker production"
```

---

## Tests de validation finale

```bash
# Backend
cd packages/backend && npm test

# Frontend
cd packages/frontend && npm test

# Build complet
npm run build

# Docker
docker compose build pixel-ui && docker compose up pixel-ui -d
```

**Checklist manuelle :**
- [ ] Balance 500 coins visible dans TopBar
- [ ] Bouton SHOP ouvre l'overlay
- [ ] Achat d'un item déduit les coins
- [ ] Mode Edit affiche l'InventoryBar avec items achetés
- [ ] Clic item inventaire + clic carte → meuble posé
- [ ] Clic sur desk → AgentScreen WinXP s'ouvre
- [ ] Onglet Tâches affiche l'historique d'events de l'agent
- [ ] Agents qui travaillent génèrent des coins (visible dans balance)
- [ ] Murs colorables avec la palette pixel art
