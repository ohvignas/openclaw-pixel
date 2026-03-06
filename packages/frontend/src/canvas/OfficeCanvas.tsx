import { useRef, useEffect, useState } from "react";
import { OfficeState } from "./OfficeState.ts";
import { loadAssets } from "./assetLoader.ts";
import { useAgentStore } from "../store/agentStore.ts";
import type { Character } from "./OfficeState.ts";
import { TileColorPicker } from "../components/TileColorPicker.tsx";
import { TileType } from "../office/types.ts";
import type { OfficeLayout, FloorColor } from "../office/types.ts";

const TILE_SIZE = 32;

interface OfficeCanvasProps {
  onAgentClick: (agentId: string) => void;
  editMode?: boolean;
  layout?: OfficeLayout;
  onLayoutChange?: (layout: OfficeLayout) => void;
}

/** Convert a hex color string to FloorColor (Photoshop-style Colorize) */
function hexToFloorColor(hex: string): FloorColor {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l < 0.5
    ? (max - min) / (max + min)
    : (max - min) / (2 - max - min);
  let h = 0;
  if (max !== min) {
    if (max === rn) h = ((gn - bn) / (max - min) + 6) % 6;
    else if (max === gn) h = (bn - rn) / (max - min) + 2;
    else h = (rn - gn) / (max - min) + 4;
    h = h * 60;
  }
  return { h, s: s * 100, b: (l - 0.5) * 200, c: 0, colorize: true };
}

export function OfficeCanvas({ onAgentClick, editMode = false, layout, onLayoutChange }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const officeRef = useRef<OfficeState | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [colorPicker, setColorPicker] = useState<{ x: number; y: number; tileIndex: number } | null>(null);

  const agents = useAgentStore((s) => s.agents);

  // Sync agent store → OfficeState
  useEffect(() => {
    const office = officeRef.current;
    if (!office) return;
    for (const agent of Object.values(agents)) {
      office.upsertCharacter(agent.id, agent);
    }
  }, [agents]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false; // flag d'annulation

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Lance le loop async avec vérification d'annulation
    (async () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let assets: Awaited<ReturnType<typeof loadAssets>> | null = null;
      try {
        assets = await loadAssets();
      } catch {
        // Placeholder mode
      }

      if (cancelled) return; // composant démonté pendant l'await

      const office = new OfficeState(canvas.width, canvas.height);
      officeRef.current = office;

      // Sync initial depuis le store
      const currentAgents = useAgentStore.getState().agents;
      for (const agent of Object.values(currentAgents)) {
        office.upsertCharacter(agent.id, agent);
      }

      const loop = (time: number) => {
        if (cancelled) return; // arrêt propre
        const delta = Math.min(time - lastTimeRef.current, 100);
        lastTimeRef.current = time;
        office.tick(delta);
        drawFrame(ctx, canvas, office, assets);
        animFrameRef.current = requestAnimationFrame(loop);
      };

      animFrameRef.current = requestAnimationFrame((time) => {
        lastTimeRef.current = time;
        animFrameRef.current = requestAnimationFrame(loop);
      });
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      officeRef.current = null;
    };
  }, []); // startLoop inliné — pas de dépendances externes

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const office = officeRef.current;
    if (!canvas || !office) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = ((e.clientX - rect.left) * scaleX) / TILE_SIZE;
    const my = ((e.clientY - rect.top) * scaleY) / TILE_SIZE;

    // In edit mode, check if a floor or wall tile was clicked
    if (editMode && layout) {
      const tileCol = Math.floor(mx);
      const tileRow = Math.floor(my);
      if (tileCol >= 0 && tileCol < layout.cols && tileRow >= 0 && tileRow < layout.rows) {
        const tileIndex = tileRow * layout.cols + tileCol;
        const tileType = layout.tiles[tileIndex];
        if (
          tileType === TileType.WALL ||
          tileType === TileType.WALL_COLORABLE ||
          (tileType >= TileType.FLOOR_1 && tileType <= TileType.FLOOR_7)
        ) {
          setColorPicker({ x: e.clientX, y: e.clientY, tileIndex });
          return;
        }
      }
    }

    for (const char of office.characters.values()) {
      const dx = Math.abs(char.pos.x - mx);
      const dy = Math.abs(char.pos.y - my);
      if (dx < 1.0 && dy < 1.5) {
        onAgentClick(char.agentId);
        return;
      }
    }
  };

  const handleColorSelect = (color: string) => {
    if (!colorPicker || !layout || !onLayoutChange) return;
    const { tileIndex } = colorPicker;
    const tileColors = layout.tileColors ? [...layout.tileColors] : Array(layout.tiles.length).fill(null) as Array<FloorColor | null>;
    tileColors[tileIndex] = hexToFloorColor(color);
    onLayoutChange({ ...layout, tileColors });
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
        aria-label="Office pixel art world"
      />
      {colorPicker && (
        <TileColorPicker
          x={colorPicker.x}
          y={colorPicker.y}
          onSelect={handleColorSelect}
          onClose={() => setColorPicker(null)}
        />
      )}
    </>
  );
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  office: OfficeState,
  assets: Awaited<ReturnType<typeof loadAssets>> | null
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background floor — bureau principal
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(0, 0, canvas.width * 0.65, canvas.height);

  // Salle de pause (droite)
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(canvas.width * 0.65, 0, canvas.width * 0.35, canvas.height * 0.5);

  // Salle de reunion (bas droite)
  ctx.fillStyle = "#6b85b0";
  ctx.fillRect(canvas.width * 0.65, canvas.height * 0.5, canvas.width * 0.35, canvas.height * 0.5);

  // Dessiner les bureaux
  drawDesks(ctx);

  // Dessiner les personnages
  for (const char of office.characters.values()) {
    drawCharacter(ctx, char, assets);
  }
}

function drawDesks(ctx: CanvasRenderingContext2D): void {
  const deskPositions = [
    { x: 3, y: 4 }, { x: 6, y: 4 }, { x: 9, y: 4 },
    { x: 3, y: 7 }, { x: 6, y: 7 }, { x: 9, y: 7 },
    { x: 3, y: 10 }, { x: 6, y: 10 }, { x: 9, y: 10 },
  ];

  for (const desk of deskPositions) {
    const dx = desk.x * TILE_SIZE;
    const dy = desk.y * TILE_SIZE;
    // Bureau en bois
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(dx - 20, dy - 12, 56, 28);
    // Ecran moniteur
    ctx.fillStyle = "#222";
    ctx.fillRect(dx, dy - 8, 20, 14);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(dx + 2, dy - 6, 16, 10);
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: Character,
  assets: Awaited<ReturnType<typeof loadAssets>> | null
): void {
  const px = char.pos.x * TILE_SIZE;
  const py = char.pos.y * TILE_SIZE;

  // Sprite reel si disponible
  if (assets) {
    try {
      const sx = char.animFrame * 32;
      const sy = char.spriteRow * 48;
      ctx.drawImage(assets.characters, sx, sy, 32, 48, px - 16, py - 32, 32, 48);
    } catch {
      drawFallbackCharacter(ctx, char, px, py);
    }
  } else {
    drawFallbackCharacter(ctx, char, px, py);
  }

  // Indicateur de statut
  const statusEmoji =
    char.status === "working" ? "⚡" :
    char.status === "waiting_approval" ? "❓" :
    char.status === "error" ? "⚠️" :
    char.status === "cron" ? "⏰" : "";

  if (statusEmoji) {
    ctx.font = "14px sans-serif";
    ctx.fillText(statusEmoji, px - 8, py - 34);
  }

  // Nom en pixel font
  ctx.font = "6px 'Press Start 2P', monospace";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText(char.name.slice(0, 8), px, py + 20);
  ctx.textAlign = "left";
}

function drawFallbackCharacter(
  ctx: CanvasRenderingContext2D,
  char: Character,
  px: number,
  py: number
): void {
  const colors: Record<string, string> = {
    idle: "#94a3b8",
    working: "#4ade80",
    waiting_approval: "#fbbf24",
    error: "#ef4444",
    cron: "#a78bfa",
  };
  const color = colors[char.status] ?? "#94a3b8";

  // Corps
  ctx.fillStyle = color;
  ctx.fillRect(px - 10, py - 24, 20, 28);
  // Tete
  ctx.fillStyle = "#f5d5a0";
  ctx.fillRect(px - 8, py - 36, 16, 14);
  // Emoji personnage
  ctx.font = "14px sans-serif";
  ctx.fillText(char.emoji, px - 10, py - 38);
}
