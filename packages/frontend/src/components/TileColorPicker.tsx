import { PIXEL_PALETTE } from '../office/constants.ts'

interface TileColorPickerProps {
  x: number
  y: number
  onSelect: (color: string) => void
  onClose: () => void
}

export function TileColorPicker({ x, y, onSelect, onClose }: TileColorPickerProps) {
  return (
    <>
      {/* Overlay transparent pour fermer au clic extérieur */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-pixel-panel border border-pixel-border p-2 shadow-lg"
        style={{ left: Math.min(x, window.innerWidth - 160), top: Math.min(y, window.innerHeight - 120) }}
      >
        <p className="font-pixel text-xs text-gray-400 mb-2">Couleur du mur/sol</p>
        <div className="grid grid-cols-8 gap-1">
          {PIXEL_PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => { onSelect(color); onClose() }}
              className="w-5 h-5 border border-pixel-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-2 w-full font-pixel text-xs text-gray-500 hover:text-white border border-pixel-border py-0.5"
        >
          Annuler
        </button>
      </div>
    </>
  )
}
