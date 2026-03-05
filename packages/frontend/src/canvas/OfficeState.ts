import type { AgentState, AgentStatus } from "../openclaw/types.ts";
import { bfsPath, type Point } from "./pathfinder.ts";

export type CharacterState = "walking" | "seated" | "standing" | "idle";

export interface Character {
  agentId: string;
  name: string;
  emoji: string;
  pos: Point;
  targetPos: Point;
  path: Point[];
  state: CharacterState;
  targetState: CharacterState;
  spriteRow: number;
  animFrame: number;
  animTimer: number;
  status: AgentStatus;
}

// Positions des bureaux (en tiles)
const DESK_POSITIONS: Point[] = [
  { x: 3, y: 4 }, { x: 6, y: 4 }, { x: 9, y: 4 },
  { x: 3, y: 7 }, { x: 6, y: 7 }, { x: 9, y: 7 },
  { x: 3, y: 10 }, { x: 6, y: 10 }, { x: 9, y: 10 },
];

// Zone de repos (salle de pause)
const IDLE_POSITIONS: Point[] = [
  { x: 14, y: 3 }, { x: 16, y: 3 }, { x: 14, y: 5 }, { x: 16, y: 5 },
];

const ANIM_FRAME_DURATION = 150; // ms par frame d'animation
const WALK_SPEED = 0.005; // tiles par ms

function statusToTargetState(status: AgentStatus): CharacterState {
  switch (status) {
    case "working":
    case "cron":
      return "seated";
    default:
      return "standing";
  }
}

export class OfficeState {
  characters: Map<string, Character> = new Map();
  private deskAssignments: Map<string, Point> = new Map();
  private usedDesks: Set<string> = new Set();
  private idleIndex = 0;

  constructor(
    readonly width: number,
    readonly height: number
  ) {}

  private getOrAssignDesk(agentId: string): Point {
    if (this.deskAssignments.has(agentId)) {
      return this.deskAssignments.get(agentId)!;
    }
    const free = DESK_POSITIONS.find((d) => !this.usedDesks.has(`${d.x},${d.y}`));
    // Si tous les bureaux sont pris, crée une position virtuelle unique
    const overflowIndex = this.deskAssignments.size - DESK_POSITIONS.length;
    const desk = free ?? {
      x: 3 + (overflowIndex % 3) * 3,
      y: 13 + Math.floor(overflowIndex / 3) * 3,
    };
    this.deskAssignments.set(agentId, desk);
    this.usedDesks.add(`${desk.x},${desk.y}`);
    return desk;
  }

  private getIdlePosition(): Point {
    const pos = IDLE_POSITIONS[this.idleIndex % IDLE_POSITIONS.length]!;
    this.idleIndex++;
    return { ...pos };
  }

  upsertCharacter(agentId: string, agent: AgentState): void {
    if (!this.characters.has(agentId)) {
      // Spawn au coin superieur gauche, legerement decale par index
      const index = this.characters.size;
      const spawnPos: Point = { x: 1 + (index % 3), y: 1 };
      const targetState = statusToTargetState(agent.status);
      const targetPos =
        targetState === "seated"
          ? this.getOrAssignDesk(agentId)
          : this.getIdlePosition();

      this.characters.set(agentId, {
        agentId,
        name: agent.name,
        emoji: agent.emoji,
        pos: { ...spawnPos },
        targetPos,
        path: bfsPath(spawnPos, targetPos, () => true),
        state: "walking",
        targetState,
        spriteRow: index % 6,
        animFrame: 0,
        animTimer: 0,
        status: agent.status,
      });
    } else {
      // Update existing
      this.setCharacterStatus(agentId, agent.status);
      const char = this.characters.get(agentId)!;
      char.name = agent.name;
      char.emoji = agent.emoji;
    }
  }

  setCharacterStatus(agentId: string, status: AgentStatus): void {
    const char = this.characters.get(agentId);
    if (!char) return;

    char.status = status;
    const targetState = statusToTargetState(status);
    char.targetState = targetState;

    if (targetState === "seated") {
      char.targetPos = this.getOrAssignDesk(agentId);
    } else {
      char.targetPos = this.getIdlePosition();
    }

    char.path = bfsPath(char.pos, char.targetPos, () => true);
  }

  tick(deltaMs: number): void {
    for (const char of this.characters.values()) {
      // Mouvement
      if (char.path.length > 1) {
        const next = char.path[1]!;
        const dx = next.x - char.pos.x;
        const dy = next.y - char.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const move = WALK_SPEED * deltaMs;

        if (move >= dist) {
          char.pos = { ...next };
          char.path.shift();
          char.state = char.path.length > 1 ? "walking" : char.targetState;
        } else {
          char.pos = {
            x: char.pos.x + (dx / dist) * move,
            y: char.pos.y + (dy / dist) * move,
          };
          char.state = "walking";
        }
      } else {
        char.state = char.targetState;
      }

      // Animation sprite (4 frames)
      char.animTimer += deltaMs;
      if (char.animTimer >= ANIM_FRAME_DURATION) {
        char.animTimer -= ANIM_FRAME_DURATION;
        char.animFrame = (char.animFrame + 1) % 4;
      }
    }
  }
}
