import { useRef, useEffect, useCallback, useState } from 'react'
import type { OfficeState } from '../office/engine/officeState'
import { startGameLoop } from '../office/engine/gameLoop'
import { renderFrame } from '../office/engine/renderer'
import type { SelectionRenderState } from '../office/engine/renderer'
import { TILE_SIZE, ZOOM_DEFAULT, ZOOM_MIN, ZOOM_MAX, ZOOM_SCROLL_THRESHOLD, PAN_MARGIN_FRACTION, CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_SNAP_THRESHOLD } from '../office/constants'
import { AgentActionOverlay } from './AgentActionOverlay'
import type { OfficeLayout } from '../office/types'
import { getActiveCatalog } from '../office/layout/furnitureCatalog'

interface OfficeCanvasProps {
  officeState: OfficeState
  characterImages: HTMLImageElement[]
  editMode: boolean
  onLayoutChange: (layout: OfficeLayout) => void
  onAgentClick: (agentId: string | null) => void
}

export function OfficeCanvas({ officeState, characterImages, editMode, onLayoutChange, onAgentClick }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const panRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const dragFurnitureRef = useRef<{ uid: string; offsetCol: number; offsetRow: number } | null>(null)
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })
  const zoomAccumulatorRef = useRef(0)
  const initialZoomSetRef = useRef(false)
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  const [selectedFurnitureUid, setSelectedFurnitureUid] = useState<string | null>(null)
  const [placingType, setPlacingType] = useState<string | null>(null)
  const zoomRef = useRef(zoom)
  const catalog = getActiveCatalog()

  // Keep zoomRef in sync
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const clampPan = useCallback((px: number, py: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: px, y: py }
    const layout = officeState.getLayout()
    const mapW = layout.cols * TILE_SIZE * zoomRef.current
    const mapH = layout.rows * TILE_SIZE * zoomRef.current
    const marginX = canvas.width * PAN_MARGIN_FRACTION
    const marginY = canvas.height * PAN_MARGIN_FRACTION
    const maxPanX = mapW / 2 + canvas.width / 2 - marginX
    const maxPanY = mapH / 2 + canvas.height / 2 - marginY
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, px)),
      y: Math.max(-maxPanY, Math.min(maxPanY, py)),
    }
  }, [officeState])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    // Zoom auto-fit : calcule le zoom pour que la carte rentre dans le viewport
    if (!initialZoomSetRef.current && canvas.width > 0 && canvas.height > 0) {
      initialZoomSetRef.current = true
      const layout = officeState.getLayout()
      const fzX = Math.floor(canvas.width / (layout.cols * TILE_SIZE))
      const fzY = Math.floor(canvas.height / (layout.rows * TILE_SIZE))
      const fz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(fzX, fzY)))
      setZoom(fz)
    }
  }, [officeState])

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const cssX = clientX - rect.left
    const cssY = clientY - rect.top
    const deviceX = cssX * dpr
    const deviceY = cssY * dpr
    const worldX = (deviceX - offsetRef.current.x) / zoomRef.current
    const worldY = (deviceY - offsetRef.current.y) / zoomRef.current
    return { worldX, worldY, deviceX, deviceY }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resizeCanvas()

    const observer = new ResizeObserver(() => resizeCanvas())
    if (containerRef.current) observer.observe(containerRef.current)

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        officeState.update(dt)
      },
      render: (ctx) => {
        const w = canvas.width
        const h = canvas.height
        const z = zoomRef.current

        // Camera follow: smoothly pan toward followed agent
        if (officeState.cameraFollowId !== null) {
          const followCh = officeState.characters.get(officeState.cameraFollowId)
          if (followCh) {
            const layout = officeState.getLayout()
            const mapW = layout.cols * TILE_SIZE * z
            const mapH = layout.rows * TILE_SIZE * z
            const targetX = mapW / 2 - followCh.x * z
            const targetY = mapH / 2 - followCh.y * z
            const dx = targetX - panRef.current.x
            const dy = targetY - panRef.current.y
            if (Math.abs(dx) < CAMERA_FOLLOW_SNAP_THRESHOLD && Math.abs(dy) < CAMERA_FOLLOW_SNAP_THRESHOLD) {
              panRef.current = { x: targetX, y: targetY }
            } else {
              panRef.current = {
                x: panRef.current.x + dx * CAMERA_FOLLOW_LERP,
                y: panRef.current.y + dy * CAMERA_FOLLOW_LERP,
              }
            }
          }
        }

        const selectionRender: SelectionRenderState = {
          selectedAgentId: officeState.selectedAgentId,
          hoveredAgentId: officeState.hoveredAgentId,
          hoveredTile: officeState.hoveredTile,
          seats: officeState.seats,
          characters: officeState.characters,
        }

        const { offsetX, offsetY } = renderFrame(
          ctx,
          w,
          h,
          officeState.tileMap,
          officeState.furniture,
          officeState.getCharacters(),
          characterImages,
          z,
          panRef.current.x,
          panRef.current.y,
          selectionRender,
          officeState.getLayout().tileColors,
          officeState.getLayout().cols,
          officeState.getLayout().rows,
        )
        offsetRef.current = { x: offsetX, y: offsetY }
      },
    })

    return () => {
      stop()
      observer.disconnect()
    }
  }, [officeState, characterImages, resizeCanvas])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const dpr = window.devicePixelRatio || 1
      const dx = (e.clientX - panStartRef.current.mouseX) * dpr
      const dy = (e.clientY - panStartRef.current.mouseY) * dpr
      panRef.current = clampPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy)
      return
    }

    const pos = screenToWorld(e.clientX, e.clientY)
    if (!pos) return

    const tileCol = Math.floor(pos.worldX / TILE_SIZE)
    const tileRow = Math.floor(pos.worldY / TILE_SIZE)
    const canvas = canvasRef.current

    if (editMode) {
      if (dragFurnitureRef.current) {
        const targetCol = tileCol - dragFurnitureRef.current.offsetCol
        const targetRow = tileRow - dragFurnitureRef.current.offsetRow
        if (officeState.moveFurniture(dragFurnitureRef.current.uid, targetCol, targetRow)) {
          onLayoutChange(officeState.getLayout())
        }
        if (canvas) canvas.style.cursor = 'grabbing'
        return
      }

      const item = officeState.getFurnitureAtTile(tileCol, tileRow)
      if (canvas) canvas.style.cursor = item ? 'grab' : 'default'
      officeState.hoveredAgentId = null
      return
    }

    const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)
    officeState.hoveredAgentId = hitId
    if (canvas) canvas.style.cursor = hitId !== null ? 'pointer' : 'default'
  }, [officeState, screenToWorld, clampPan, editMode, onLayoutChange])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      officeState.cameraFollowId = null
      isPanningRef.current = true
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      }
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = 'grabbing'
      return
    }

    if (editMode && e.button === 0) {
      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return
      const tileCol = Math.floor(pos.worldX / TILE_SIZE)
      const tileRow = Math.floor(pos.worldY / TILE_SIZE)
      if (placingType) {
        const addedUid = officeState.addFurniture(placingType, tileCol, tileRow)
        if (addedUid) {
          setSelectedFurnitureUid(addedUid)
          onLayoutChange(officeState.getLayout())
        }
        return
      }
      const item = officeState.getFurnitureAtTile(tileCol, tileRow)
      if (!item) {
        setSelectedFurnitureUid(null)
        return
      }
      setSelectedFurnitureUid(item.uid)
      dragFurnitureRef.current = {
        uid: item.uid,
        offsetCol: tileCol - item.col,
        offsetRow: tileRow - item.row,
      }
      officeState.selectedAgentId = null
      officeState.cameraFollowId = null
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = 'grabbing'
    }
  }, [officeState, editMode, screenToWorld, onLayoutChange, placingType])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      isPanningRef.current = false
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = 'default'
      return
    }
    if (editMode && e.button === 0) {
      dragFurnitureRef.current = null
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = 'default'
    }
  }, [editMode])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (editMode) {
      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return
      const tileCol = Math.floor(pos.worldX / TILE_SIZE)
      const tileRow = Math.floor(pos.worldY / TILE_SIZE)
      const item = officeState.getFurnitureAtTile(tileCol, tileRow)
      if (!dragFurnitureRef.current) {
        setSelectedFurnitureUid(item?.uid ?? null)
      }
      return
    }
    const pos = screenToWorld(e.clientX, e.clientY)
    if (!pos) return

    const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)
    if (hitId !== null) {
      officeState.dismissBubble(hitId)
      if (officeState.selectedAgentId === hitId) {
        officeState.selectedAgentId = null
        officeState.cameraFollowId = null
        onAgentClick(null)
      } else {
        officeState.selectedAgentId = hitId
        officeState.cameraFollowId = hitId
        onAgentClick(hitId)
      }
      return
    }

    // Clicked empty space — deselect
    officeState.selectedAgentId = null
    officeState.cameraFollowId = null
    onAgentClick(null)
  }, [officeState, onAgentClick, screenToWorld, editMode])

  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false
    dragFurnitureRef.current = null
    officeState.hoveredAgentId = null
    officeState.hoveredTile = null
  }, [officeState])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      zoomAccumulatorRef.current += e.deltaY
      if (Math.abs(zoomAccumulatorRef.current) >= ZOOM_SCROLL_THRESHOLD) {
        const delta = zoomAccumulatorRef.current < 0 ? 1 : -1
        zoomAccumulatorRef.current = 0
        setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)))
      }
    } else {
      const dpr = window.devicePixelRatio || 1
      officeState.cameraFollowId = null
      panRef.current = clampPan(
        panRef.current.x - e.deltaX * dpr,
        panRef.current.y - e.deltaY * dpr,
      )
    }
  }, [officeState, clampPan])

  return (
    <div
      ref={containerRef}
      style={{ flex: '1', minWidth: 0, height: '100%', position: 'relative', overflow: 'hidden', background: '#1E1E2E' }}
    >
      <AgentActionOverlay
        officeState={officeState}
        containerRef={containerRef}
        zoom={zoom}
        panRef={panRef}
      />
      {editMode && (
        <div className="absolute left-3 top-3 z-10 w-72 border border-pixel-green bg-pixel-panel/95 p-3 text-[10px] text-pixel-green">
          <div className="mb-2 font-pixel">EDIT MODE</div>
          <div className="mb-3 text-gray-300">Glisse pour deplacer. Clique un objet de la liste puis clique dans la piece pour l’ajouter.</div>
          <div className="mb-3 flex gap-2">
            <button
              className={`border px-2 py-1 ${placingType === null ? 'border-pixel-green text-pixel-green' : 'border-pixel-border text-gray-300'}`}
              onClick={() => setPlacingType(null)}
            >
              Deplacer
            </button>
            <button
              className="border border-pixel-red px-2 py-1 text-pixel-red disabled:opacity-40"
              disabled={!selectedFurnitureUid}
              onClick={() => {
                if (!selectedFurnitureUid) return
                if (officeState.removeFurniture(selectedFurnitureUid)) {
                  onLayoutChange(officeState.getLayout())
                  setSelectedFurnitureUid(null)
                }
              }}
            >
              Supprimer
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto border border-pixel-border bg-pixel-bg">
            {catalog.map((entry) => (
              <button
                key={entry.type}
                className={`block w-full border-b border-pixel-border px-2 py-2 text-left font-pixel text-[10px] ${
                  placingType === entry.type ? 'bg-pixel-green/20 text-pixel-green' : 'text-gray-300 hover:text-white'
                }`}
                onClick={() => setPlacingType(entry.type)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onAuxClick={(e) => { if (e.button === 1) e.preventDefault() }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: 'block' }}
      />
    </div>
  )
}
