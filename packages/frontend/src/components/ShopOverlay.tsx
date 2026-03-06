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
          <span className="font-pixel text-xs text-pixel-accent tracking-widest">BOUTIQUE</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <img
                src="/assets/coin.png"
                className="w-4 h-4 object-contain"
                style={{ imageRendering: 'pixelated' }}
                alt="coins"
              />
              <span className="font-pixel text-xs text-yellow-400">
                {coins.toLocaleString()} coins
              </span>
            </div>
            <button
              className="font-pixel text-xs text-gray-400 hover:text-white px-2 border border-pixel-border hover:border-white transition-colors"
              onClick={onClose}
            >
              [X]
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar categories */}
          <div className="w-36 border-r border-pixel-border flex flex-col py-2 shrink-0">
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
            {items.length === 0 ? (
              <p className="font-pixel text-xs text-gray-600">Bientôt disponible</p>
            ) : (
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
                      <span className="font-pixel text-xs text-white text-center leading-tight mt-1">
                        {item.label}
                      </span>
                      <span className="font-pixel text-xs text-yellow-400">
                        {item.price}c
                      </span>
                      {qty > 0 && (
                        <span className="font-pixel text-xs text-pixel-green">
                          x{qty}
                        </span>
                      )}
                      <button
                        disabled={!canAfford || isBuying}
                        onClick={() => handleBuy(item.id, item.price)}
                        className={`w-full font-pixel text-xs py-1 mt-1 transition-colors ${
                          canAfford && !isBuying
                            ? 'bg-pixel-accent text-white hover:opacity-80'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {isBuying ? '...' : canAfford ? 'Acheter' : 'Manque'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
