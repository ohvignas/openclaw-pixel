import { TILE_SIZE, MATRIX_EFFECT_DURATION, CharacterState, Direction, TileType } from '../types'
import {
  PALETTE_COUNT,
  HUE_SHIFT_MIN_DEG,
  HUE_SHIFT_RANGE_DEG,
  WAITING_BUBBLE_DURATION_SEC,
  DISMISS_BUBBLE_FAST_FADE_SEC,
  INACTIVE_SEAT_TIMER_MIN_SEC,
  INACTIVE_SEAT_TIMER_RANGE_SEC,
  AUTO_ON_FACING_DEPTH,
  AUTO_ON_SIDE_DEPTH,
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_HIT_HALF_WIDTH,
  CHARACTER_HIT_HEIGHT,
  MATRIX_SPRITE_COLS,
} from '../constants'
import type { Character, Seat, FurnitureInstance, TileType as TileTypeVal, OfficeLayout, PlacedFurniture } from '../types'
import { createCharacter, updateCharacter } from './characters'
import { getWalkableTiles, findPath } from '../layout/tileMap'
import {
  createDefaultLayout,
  layoutToTileMap,
  layoutToFurnitureInstances,
  layoutToSeats,
  getBlockedTiles,
} from '../layout/layoutSerializer'
import { getCatalogEntry, getOnStateType } from '../layout/furnitureCatalog'

/** Generate per-column random seeds for the matrix spawn/despawn effect */
function matrixEffectSeeds(): number[] {
  const seeds: number[] = []
  for (let i = 0; i < MATRIX_SPRITE_COLS; i++) {
    seeds.push(Math.random())
  }
  return seeds
}

export class OfficeState {
  layout: OfficeLayout
  tileMap: TileTypeVal[][]
  seats: Map<string, Seat>
  blockedTiles: Set<string>
  furniture: FurnitureInstance[]
  walkableTiles: Array<{ col: number; row: number }>
  characters: Map<string, Character> = new Map()
  selectedAgentId: string | null = null
  cameraFollowId: string | null = null
  hoveredAgentId: string | null = null
  hoveredTile: { col: number; row: number } | null = null

  constructor(layout?: OfficeLayout) {
    this.layout = layout || createDefaultLayout()
    this.tileMap = layoutToTileMap(this.layout)
    this.seats = layoutToSeats(this.layout.furniture)
    this.blockedTiles = getBlockedTiles(this.layout.furniture)
    this.furniture = layoutToFurnitureInstances(this.layout.furniture)
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles)
  }

  getLayout(): OfficeLayout {
    return this.layout
  }

  setLayout(layout: OfficeLayout): void {
    this.layout = layout
    this.refreshLayoutState()
  }

  private refreshLayoutState(): void {
    this.tileMap = layoutToTileMap(this.layout)
    this.seats = layoutToSeats(this.layout.furniture)
    this.blockedTiles = getBlockedTiles(this.layout.furniture)
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles)
    this.rebuildFurnitureInstances()
  }

  getFurnitureAtTile(tileCol: number, tileRow: number): PlacedFurniture | null {
    for (let i = this.layout.furniture.length - 1; i >= 0; i--) {
      const item = this.layout.furniture[i]
      const entry = getCatalogEntry(item.type)
      if (!entry) continue
      if (
        tileCol >= item.col &&
        tileCol < item.col + entry.footprintW &&
        tileRow >= item.row &&
        tileRow < item.row + entry.footprintH
      ) {
        return item
      }
    }
    return null
  }

  moveFurniture(uid: string, col: number, row: number): boolean {
    const index = this.layout.furniture.findIndex((item) => item.uid === uid)
    if (index === -1) return false
    const current = this.layout.furniture[index]
    if (current.col === col && current.row === row) return true

    const moved: PlacedFurniture = { ...current, col, row }
    if (!this.canPlaceFurniture(moved)) return false

    const furniture = [...this.layout.furniture]
    furniture[index] = moved
    this.layout = { ...this.layout, furniture }
    this.refreshLayoutState()
    return true
  }

  addFurniture(type: string, col: number, row: number): string | null {
    const uid = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const item: PlacedFurniture = { uid, type, col, row }
    if (!this.canPlaceFurniture(item)) return null

    this.layout = {
      ...this.layout,
      furniture: [...this.layout.furniture, item],
    }
    this.refreshLayoutState()
    return uid
  }

  removeFurniture(uid: string): boolean {
    const nextFurniture = this.layout.furniture.filter((item) => item.uid !== uid)
    if (nextFurniture.length === this.layout.furniture.length) return false
    this.layout = { ...this.layout, furniture: nextFurniture }
    this.refreshLayoutState()
    return true
  }

  private canPlaceFurniture(item: PlacedFurniture): boolean {
    const entry = getCatalogEntry(item.type)
    if (!entry) return false
    const bgRows = entry.backgroundTiles || 0

    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const tileCol = item.col + dc
        const tileRow = item.row + dr
        const tile = this.tileMap[tileRow]?.[tileCol]
        if (tile === undefined || tile === TileType.VOID) return false
        if (entry.canPlaceOnWalls) {
          if (tile !== TileType.WALL) return false
        } else if (tile === TileType.WALL) {
          return false
        }

        let hasSupportingDesk = false
        for (const other of this.layout.furniture) {
          if (other.uid === item.uid) continue
          const otherEntry = getCatalogEntry(other.type)
          if (!otherEntry) continue

          const overlapsTile =
            tileCol >= other.col &&
            tileCol < other.col + otherEntry.footprintW &&
            tileRow >= other.row &&
            tileRow < other.row + otherEntry.footprintH

          if (!overlapsTile) continue

          if (entry.canPlaceOnSurfaces && otherEntry.isDesk) {
            hasSupportingDesk = true
            continue
          }

          if (dr >= bgRows) {
            return false
          }
        }

        if (entry.canPlaceOnSurfaces && dr >= bgRows && !hasSupportingDesk) {
          return false
        }
      }
    }

    return true
  }

  private collectDeskTiles(): Set<string> {
    const tiles = new Set<string>()
    for (const item of this.layout.furniture) {
      const entry = getCatalogEntry(item.type)
      if (!entry?.isDesk) continue
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          tiles.add(`${item.col + dc},${item.row + dr}`)
        }
      }
    }
    return tiles
  }

  private seatFacesDesk(seat: Seat): boolean {
    const deskTiles = this.collectDeskTiles()
    const dCol = seat.facingDir === Direction.RIGHT ? 1 : seat.facingDir === Direction.LEFT ? -1 : 0
    const dRow = seat.facingDir === Direction.DOWN ? 1 : seat.facingDir === Direction.UP ? -1 : 0

    for (let depth = 1; depth <= AUTO_ON_FACING_DEPTH; depth++) {
      const baseCol = seat.seatCol + dCol * depth
      const baseRow = seat.seatRow + dRow * depth
      if (deskTiles.has(`${baseCol},${baseRow}`)) return true
      for (let side = 1; side <= AUTO_ON_SIDE_DEPTH; side++) {
        if (dCol !== 0) {
          if (deskTiles.has(`${baseCol},${baseRow - side}`)) return true
          if (deskTiles.has(`${baseCol},${baseRow + side}`)) return true
        } else {
          if (deskTiles.has(`${baseCol - side},${baseRow}`)) return true
          if (deskTiles.has(`${baseCol + side},${baseRow}`)) return true
        }
      }
    }

    return false
  }

  getAssignableSeatIds(): string[] {
    return Array.from(this.seats.values())
      .filter((seat) => this.seatFacesDesk(seat))
      .sort((a, b) => a.seatRow - b.seatRow || a.seatCol - b.seatCol || a.uid.localeCompare(b.uid))
      .map((seat) => seat.uid)
  }

  /** Get the blocked-tile key for a character's own seat, or null */
  private ownSeatKey(ch: Character): string | null {
    if (!ch.seatId) return null
    const seat = this.seats.get(ch.seatId)
    if (!seat) return null
    return `${seat.seatCol},${seat.seatRow}`
  }

  /** Temporarily unblock a character's own seat, run fn, then re-block */
  private withOwnSeatUnblocked<T>(ch: Character, fn: () => T): T {
    const key = this.ownSeatKey(ch)
    if (key) this.blockedTiles.delete(key)
    const result = fn()
    if (key) this.blockedTiles.add(key)
    return result
  }

  private findFreeSeat(): string | null {
    for (const [uid, seat] of this.seats) {
      if (!seat.assigned) return uid
    }
    return null
  }

  assignAgentSeat(agentId: string, seatId: string): boolean {
    const ch = this.characters.get(agentId)
    const nextSeat = this.seats.get(seatId)
    if (!ch || !nextSeat) return false
    if (ch.seatId === seatId) {
      nextSeat.assigned = true
      return true
    }
    if (nextSeat.assigned) return false

    if (ch.seatId) {
      const currentSeat = this.seats.get(ch.seatId)
      if (currentSeat) currentSeat.assigned = false
    }

    nextSeat.assigned = true
    ch.seatId = seatId
    ch.dir = nextSeat.facingDir
    ch.seatTimer = 0

    if (ch.tileCol === nextSeat.seatCol && ch.tileRow === nextSeat.seatRow) {
      ch.x = nextSeat.seatCol * TILE_SIZE + TILE_SIZE / 2
      ch.y = nextSeat.seatRow * TILE_SIZE + TILE_SIZE / 2
      ch.state = CharacterState.TYPE
      ch.path = []
      ch.moveProgress = 0
      ch.frame = 0
      ch.frameTimer = 0
    } else {
      this.sendToSeat(agentId)
    }

    this.rebuildFurnitureInstances()
    return true
  }

  /**
   * Pick a diverse palette for a new agent based on currently active agents.
   * First 6 agents each get a unique skin (random order). Beyond 6, skins
   * repeat in balanced rounds with a random hue shift (>=45 deg).
   */
  private pickDiversePalette(): { palette: number; hueShift: number } {
    const counts = new Array(PALETTE_COUNT).fill(0) as number[]
    for (const ch of this.characters.values()) {
      counts[ch.palette]++
    }
    const minCount = Math.min(...counts)
    const available: number[] = []
    for (let i = 0; i < PALETTE_COUNT; i++) {
      if (counts[i] === minCount) available.push(i)
    }
    const palette = available[Math.floor(Math.random() * available.length)]
    let hueShift = 0
    if (minCount > 0) {
      hueShift = HUE_SHIFT_MIN_DEG + Math.floor(Math.random() * HUE_SHIFT_RANGE_DEG)
    }
    return { palette, hueShift }
  }

  addAgent(id: string, preferredPalette?: number, preferredHueShift?: number, preferredSeatId?: string, skipSpawnEffect?: boolean): void {
    if (this.characters.has(id)) return

    let palette: number
    let hueShift: number
    if (preferredPalette !== undefined) {
      palette = preferredPalette
      hueShift = preferredHueShift ?? 0
    } else {
      const pick = this.pickDiversePalette()
      palette = pick.palette
      hueShift = pick.hueShift
    }

    // Try preferred seat first, then any free seat
    let seatId: string | null = null
    if (preferredSeatId && this.seats.has(preferredSeatId)) {
      const seat = this.seats.get(preferredSeatId)!
      if (!seat.assigned) {
        seatId = preferredSeatId
      }
    }
    if (!seatId) {
      seatId = this.findFreeSeat()
    }

    let ch: Character
    if (seatId) {
      const seat = this.seats.get(seatId)!
      seat.assigned = true
      ch = createCharacter(id, palette, seatId, seat, hueShift)
    } else {
      // No seats — spawn at random walkable tile
      const spawn = this.walkableTiles.length > 0
        ? this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)]
        : { col: 1, row: 1 }
      ch = createCharacter(id, palette, null, null, hueShift)
      ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2
      ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2
      ch.tileCol = spawn.col
      ch.tileRow = spawn.row
    }

    if (!skipSpawnEffect) {
      ch.matrixEffect = 'spawn'
      ch.matrixEffectTimer = 0
      ch.matrixEffectSeeds = matrixEffectSeeds()
    }
    this.characters.set(id, ch)
    this.rebuildFurnitureInstances()
  }

  removeAgent(id: string): void {
    const ch = this.characters.get(id)
    if (!ch) return
    if (ch.matrixEffect === 'despawn') return // already despawning
    // Free seat and clear selection immediately
    if (ch.seatId) {
      const seat = this.seats.get(ch.seatId)
      if (seat) seat.assigned = false
    }
    if (this.selectedAgentId === id) this.selectedAgentId = null
    if (this.cameraFollowId === id) this.cameraFollowId = null
    // Start despawn animation instead of immediate delete
    ch.matrixEffect = 'despawn'
    ch.matrixEffectTimer = 0
    ch.matrixEffectSeeds = matrixEffectSeeds()
    ch.bubbleType = null
    this.rebuildFurnitureInstances()
  }

  /** Send an agent back to their currently assigned seat */
  sendToSeat(agentId: string): void {
    const ch = this.characters.get(agentId)
    if (!ch || !ch.seatId) return
    const seat = this.seats.get(ch.seatId)
    if (!seat) return
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles)
    )
    if (path.length > 0) {
      ch.path = path
      ch.moveProgress = 0
      ch.state = CharacterState.WALK
      ch.frame = 0
      ch.frameTimer = 0
    } else {
      // Already at seat — sit down
      ch.state = CharacterState.TYPE
      ch.dir = seat.facingDir
      ch.frame = 0
      ch.frameTimer = 0
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC
      }
    }
  }

  setAgentActive(id: string, active: boolean): void {
    const ch = this.characters.get(id)
    if (ch) {
      ch.isActive = active
      if (!active) {
        // Sentinel -1: signals turn just ended, skip next seat rest timer.
        // Prevents the WALK handler from setting a 2-4 min rest on arrival.
        ch.seatTimer = -1
        ch.path = []
        ch.moveProgress = 0
      }
      this.rebuildFurnitureInstances()
    }
  }

  /** Rebuild furniture instances with auto-state applied (active agents turn electronics ON) */
  private rebuildFurnitureInstances(): void {
    // Collect tiles where active agents face desks
    const autoOnTiles = new Set<string>()
    for (const ch of this.characters.values()) {
      if (!ch.isActive || !ch.seatId) continue
      const seat = this.seats.get(ch.seatId)
      if (!seat) continue
      // Find the desk tile(s) the agent faces from their seat
      const dCol = seat.facingDir === Direction.RIGHT ? 1 : seat.facingDir === Direction.LEFT ? -1 : 0
      const dRow = seat.facingDir === Direction.DOWN ? 1 : seat.facingDir === Direction.UP ? -1 : 0
      // Check tiles in the facing direction (desk could be 1-3 tiles deep)
      for (let d = 1; d <= AUTO_ON_FACING_DEPTH; d++) {
        const tileCol = seat.seatCol + dCol * d
        const tileRow = seat.seatRow + dRow * d
        autoOnTiles.add(`${tileCol},${tileRow}`)
      }
      // Also check tiles to the sides of the facing direction (desks can be wide)
      for (let d = 1; d <= AUTO_ON_SIDE_DEPTH; d++) {
        const baseCol = seat.seatCol + dCol * d
        const baseRow = seat.seatRow + dRow * d
        if (dCol !== 0) {
          // Facing left/right: check tiles above and below
          autoOnTiles.add(`${baseCol},${baseRow - 1}`)
          autoOnTiles.add(`${baseCol},${baseRow + 1}`)
        } else {
          // Facing up/down: check tiles left and right
          autoOnTiles.add(`${baseCol - 1},${baseRow}`)
          autoOnTiles.add(`${baseCol + 1},${baseRow}`)
        }
      }
    }

    if (autoOnTiles.size === 0) {
      this.furniture = layoutToFurnitureInstances(this.layout.furniture)
      return
    }

    // Build modified furniture list with auto-state applied
    const modifiedFurniture: PlacedFurniture[] = this.layout.furniture.map((item) => {
      const entry = getCatalogEntry(item.type)
      if (!entry) return item
      // Check if any tile of this furniture overlaps an auto-on tile
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          if (autoOnTiles.has(`${item.col + dc},${item.row + dr}`)) {
            const onType = getOnStateType(item.type)
            if (onType !== item.type) {
              return { ...item, type: onType }
            }
            return item
          }
        }
      }
      return item
    })

    this.furniture = layoutToFurnitureInstances(modifiedFurniture)
  }

  setAgentTool(id: string, tool: string | null): void {
    const ch = this.characters.get(id)
    if (ch) {
      ch.currentTool = tool
    }
  }

  showPermissionBubble(id: string): void {
    const ch = this.characters.get(id)
    if (ch) {
      ch.bubbleType = 'permission'
      ch.bubbleTimer = 0
    }
  }

  clearPermissionBubble(id: string): void {
    const ch = this.characters.get(id)
    if (ch && ch.bubbleType === 'permission') {
      ch.bubbleType = null
      ch.bubbleTimer = 0
    }
  }

  showWaitingBubble(id: string): void {
    const ch = this.characters.get(id)
    if (ch) {
      ch.bubbleType = 'waiting'
      ch.bubbleTimer = WAITING_BUBBLE_DURATION_SEC
    }
  }

  /** Dismiss bubble on click — permission: instant, waiting: quick fade */
  dismissBubble(id: string): void {
    const ch = this.characters.get(id)
    if (!ch || !ch.bubbleType) return
    if (ch.bubbleType === 'permission') {
      ch.bubbleType = null
      ch.bubbleTimer = 0
    } else if (ch.bubbleType === 'waiting') {
      // Trigger immediate fade (0.3s remaining)
      ch.bubbleTimer = Math.min(ch.bubbleTimer, DISMISS_BUBBLE_FAST_FADE_SEC)
    }
  }

  update(dt: number): void {
    const toDelete: string[] = []
    for (const ch of this.characters.values()) {
      // Handle matrix effect animation
      if (ch.matrixEffect) {
        ch.matrixEffectTimer += dt
        if (ch.matrixEffectTimer >= MATRIX_EFFECT_DURATION) {
          if (ch.matrixEffect === 'spawn') {
            // Spawn complete — clear effect, resume normal FSM
            ch.matrixEffect = null
            ch.matrixEffectTimer = 0
            ch.matrixEffectSeeds = []
          } else {
            // Despawn complete — mark for deletion
            toDelete.push(ch.id)
          }
        }
        continue // skip normal FSM while effect is active
      }

      // Temporarily unblock own seat so character can pathfind to it
      this.withOwnSeatUnblocked(ch, () =>
        updateCharacter(ch, dt, this.walkableTiles, this.seats, this.tileMap, this.blockedTiles)
      )

      // Tick bubble timer for waiting bubbles
      if (ch.bubbleType === 'waiting') {
        ch.bubbleTimer -= dt
        if (ch.bubbleTimer <= 0) {
          ch.bubbleType = null
          ch.bubbleTimer = 0
        }
      }
    }
    // Remove characters that finished despawn
    for (const id of toDelete) {
      this.characters.delete(id)
    }
    if (toDelete.length > 0) {
      this.rebuildFurnitureInstances()
    }
  }

  getCharacters(): Character[] {
    return Array.from(this.characters.values())
  }

  /** Get character at pixel position (for hit testing). Returns id or null. */
  getCharacterAt(worldX: number, worldY: number): string | null {
    const chars = this.getCharacters().sort((a, b) => b.y - a.y)
    for (const ch of chars) {
      // Skip characters that are despawning
      if (ch.matrixEffect === 'despawn') continue
      // Character sprite is 16x24, anchored bottom-center
      // Apply sitting offset to match visual position
      const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0
      const anchorY = ch.y + sittingOffset
      const left = ch.x - CHARACTER_HIT_HALF_WIDTH
      const right = ch.x + CHARACTER_HIT_HALF_WIDTH
      const top = anchorY - CHARACTER_HIT_HEIGHT
      const bottom = anchorY
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        return ch.id
      }
    }
    return null
  }
}
