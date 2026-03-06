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
    <div className="h-28 bg-pixel-panel border-t-2 border-pixel-border flex flex-col shrink-0">
      {/* Category tabs */}
      <div className="flex items-center gap-1 px-2 pt-1 border-b border-pixel-border overflow-x-auto">
        <button
          onClick={() => setActiveCategory('all')}
          className={`font-pixel text-xs px-2 py-0.5 shrink-0 transition-colors ${
            activeCategory === 'all' ? 'text-pixel-accent' : 'text-gray-500 hover:text-white'
          }`}
        >
          Tout
        </button>
        {SHOP_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`font-pixel text-xs px-2 py-0.5 shrink-0 transition-colors ${
              activeCategory === cat.id ? 'text-pixel-accent' : 'text-gray-500 hover:text-white'
            }`}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
        <div className="flex-1" />
        <span className="font-pixel text-xs text-gray-600 py-0.5 shrink-0">
          INVENTAIRE — cliquez pour placer
        </span>
      </div>

      {/* Items row */}
      <div className="flex gap-2 px-2 py-1 overflow-x-auto flex-1 items-center">
        {ownedItems.length === 0 ? (
          <span className="font-pixel text-xs text-gray-600">
            Inventaire vide — achetez des items dans la boutique (SHOP)
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
                    : 'border-pixel-border hover:border-gray-400 bg-pixel-bg'
                }`}
                title={`${item.label} (x${qty})`}
              >
                <div className="w-12 h-12 flex items-center justify-center">
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
