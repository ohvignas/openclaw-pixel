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
        try {
          const res = await fetch('/api/economy/balance')
          if (!res.ok) return
          const data = await res.json()
          set({ coins: data.coins })
        } catch {
          // silently fail (dev sans backend)
        }
      },

      fetchInventory: async () => {
        try {
          const res = await fetch('/api/economy/inventory')
          if (!res.ok) return
          const data = await res.json()
          set({ inventory: data })
        } catch {
          // silently fail
        }
      },

      purchase: async (itemId, price) => {
        try {
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
        } catch {
          return false
        }
      },

      addCoins: async (agentId, tokens) => {
        if (tokens <= 0) return
        try {
          const res = await fetch('/api/economy/coins/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, tokens }),
          })
          if (!res.ok) return
          const data = await res.json()
          set({ coins: data.newBalance })
        } catch {
          // silently fail
        }
      },
    }),
    {
      name: 'economy-store',
      partialize: (state) => ({ coins: state.coins }),
    },
  ),
)
