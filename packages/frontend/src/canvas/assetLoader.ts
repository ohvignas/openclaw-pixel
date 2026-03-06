import { setWallSprites } from '../office/wallTiles.ts'
import { setFloorSprites } from '../office/floorTiles.ts'
import type { OfficeLayout, SpriteData } from '../office/types.ts'
import { loadPixelHomeAssets } from '../office/pixelHomeAssets.ts'
import { createAgentHomeLayout } from '../office/layout/agentHomeLayout.ts'
import { setCharacterShadow, setCharacterTemplates } from '../office/sprites/spriteData.ts'
import type { LoadedCharacterData } from '../office/sprites/spriteData.ts'

export interface GameAssets {
  characters: HTMLImageElement[]
  layout: OfficeLayout | null
}

const CUSTOM_CHARACTER_01_BASE = '/assets/characters/character_01'
const CUSTOM_CHARACTER_01_SHADOW = '/assets/characters/character_01/Shadow.png'

let cached: GameAssets | null = null
let loadingPromise: Promise<GameAssets> | null = null

export async function loadAssets(): Promise<GameAssets> {
  if (cached) return cached
  if (loadingPromise) return loadingPromise

  loadingPromise = Promise.all([
    loadPixelHomeAssets(),
    loadCharacterTemplates(),
    loadWallSprites('/assets/walls.png').then((sprites) => {
      if (sprites) setWallSprites(sprites)
    }).catch(() => { /* fallback: solid walls */ }),
    // Floor sprites (7 programmatic patterns) → setFloorSprites()
    Promise.resolve(setFloorSprites(generateFloorSprites())),
  ]).then(([, characters]) => {
    setCharacterTemplates(characters)
    return loadSpriteData(CUSTOM_CHARACTER_01_SHADOW).then((shadow) => {
      setCharacterShadow(shadow)
      const layout = createAgentHomeLayout()
      cached = { characters: [], layout }
      return cached
    })
  }).catch((err: unknown) => {
    loadingPromise = null
    throw err
  })

  return loadingPromise
}

export function clearAssetCache(): void {
  cached = null
  loadingPromise = null
}

function loadWallSprites(url: string): Promise<string[][][] | null> {
  return loadImage(url).then((img) => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    const data = imageData.data

    const pieceWidth = 16
    const pieceHeight = 32
    const gridCols = 4
    const count = 16

    const sprites: string[][][] = []
    for (let mask = 0; mask < count; mask++) {
      const ox = (mask % gridCols) * pieceWidth
      const oy = Math.floor(mask / gridCols) * pieceHeight
      const sprite: string[][] = []
      for (let row = 0; row < pieceHeight; row++) {
        const cols: string[] = []
        for (let col = 0; col < pieceWidth; col++) {
          const index = ((oy + row) * img.width + (ox + col)) * 4
          const alpha = data[index + 3]
          if (alpha < 128) {
            cols.push('')
          } else {
            const r = data[index].toString(16).padStart(2, '0')
            const g = data[index + 1].toString(16).padStart(2, '0')
            const b = data[index + 2].toString(16).padStart(2, '0')
            cols.push(`#${r}${g}${b}`.toUpperCase())
          }
        }
        sprite.push(cols)
      }
      sprites.push(sprite)
    }

    return sprites
  })
}

// ── Floor sprite generator ───────────────────────────────────────
// Generate 7 grayscale 16×16 tile patterns for colorization.
// Each pattern is a slight variation on a simple tile/grout design.

function generateFloorSprites(): string[][][] {
  const SIZE = 16
  const sprites: string[][][] = []

  // Pattern 0: plain medium gray (solid)
  sprites.push(solidTile('#888888'))

  // Pattern 1: fine 2×2 checkerboard
  sprites.push(checkerTile('#888888', '#999999', 2))

  // Pattern 2: tile grout (1px lighter border)
  sprites.push(groutTile('#888888', '#AAAAAA', 8))

  // Pattern 3: larger 4×4 checkerboard
  sprites.push(checkerTile('#808080', '#989898', 4))

  // Pattern 4: grout with 4px tiles
  sprites.push(groutTile('#808080', '#AAAAAA', 4))

  // Pattern 5: diagonal hatch light
  sprites.push(diagonalTile('#888888', '#999999'))

  // Pattern 6: herringbone-like (large grout)
  sprites.push(groutTile('#858585', '#AAAAAA', 6))

  return sprites

  function solidTile(color: string): string[][] {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(color) as string[])
  }

  function checkerTile(c1: string, c2: string, step: number): string[][] {
    return Array.from({ length: SIZE }, (_, y) =>
      Array.from({ length: SIZE }, (_, x) =>
        (Math.floor(x / step) + Math.floor(y / step)) % 2 === 0 ? c1 : c2,
      ),
    )
  }

  function groutTile(fill: string, grout: string, tileSize: number): string[][] {
    return Array.from({ length: SIZE }, (_, y) =>
      Array.from({ length: SIZE }, (_, x) => {
        const inGroutX = (x % tileSize) === 0
        const inGroutY = (y % tileSize) === 0
        return (inGroutX || inGroutY) ? grout : fill
      }),
    )
  }

  function diagonalTile(c1: string, c2: string): string[][] {
    return Array.from({ length: SIZE }, (_, y) =>
      Array.from({ length: SIZE }, (_, x) =>
        (x + y) % 4 === 0 ? c2 : c1,
      ),
    )
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load asset: ${src}`))
    img.src = src
  })
}

async function loadCharacterTemplates(): Promise<LoadedCharacterData[]> {
  const character01 = await loadCharacter01Frames()
  return [character01]
}

async function loadCharacter01Frames(): Promise<LoadedCharacterData> {
  const load = (file: string) => loadSpriteData(`${CUSTOM_CHARACTER_01_BASE}/${file}`)
  const [
    walkFront01,
    walkFront02,
    walkFront03,
    sitFrontLeft,
    sitFrontRight,
    walkBack01,
    walkBack02,
    walkBack03,
    sitBackLeft,
    sitBackRight,
    walkRight01,
    walkRight02,
    walkRight03,
    sitRightIdle,
    sitRightLeft,
    sitRightRight,
  ] = await Promise.all([
    load('character_01_walk_front_01.png'),
    load('character_01_walk_front_02.png'),
    load('character_01_walk_front_03.png'),
    load('character_01_sit_front_raise_left_01.png'),
    load('character_01_sit_front_raise_right_01.png'),
    load('character_01_walk_back_01.png'),
    load('character_01_walk_back_02.png'),
    load('character_01_walk_back_03.png'),
    load('character_01_sit_back_raise_left_01.png'),
    load('character_01_sit_back_raise_right_01.png'),
    load('character_01_walk_right_01.png'),
    load('character_01_walk_right_02.png'),
    load('character_01_walk_right_03.png'),
    load('character_01_sit_right_idle_01.png'),
    load('character_01_sit_right_raise_left_01.png'),
    load('character_01_sit_right_raise_right_01.png'),
  ])

  return {
    down: [
      walkFront01,
      walkFront02,
      walkFront03,
      sitFrontLeft,
      sitFrontRight,
      sitFrontLeft,
      sitFrontRight,
    ],
    up: [
      walkBack01,
      walkBack02,
      walkBack03,
      sitBackLeft,
      sitBackRight,
      sitBackLeft,
      sitBackRight,
    ],
    right: [
      walkRight01,
      walkRight02,
      walkRight03,
      sitRightIdle,
      sitRightRight,
      sitRightIdle,
      sitRightLeft,
    ],
  }
}

async function loadSpriteData(src: string): Promise<SpriteData> {
  const img = await loadImage(src)
  return imageToSpriteData(img)
}

function imageToSpriteData(img: HTMLImageElement): SpriteData {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to create canvas context for sprite image')
  }
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const sprite: SpriteData = []

  for (let y = 0; y < img.height; y++) {
    const row: string[] = []
    for (let x = 0; x < img.width; x++) {
      const index = (y * img.width + x) * 4
      const alpha = data[index + 3]
      if (alpha < 128) {
        row.push('')
        continue
      }
      const r = data[index].toString(16).padStart(2, '0')
      const g = data[index + 1].toString(16).padStart(2, '0')
      const b = data[index + 2].toString(16).padStart(2, '0')
      row.push(`#${r}${g}${b}`.toUpperCase())
    }
    sprite.push(row)
  }

  return sprite
}
