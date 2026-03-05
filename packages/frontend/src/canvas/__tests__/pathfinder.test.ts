import { describe, it, expect } from "vitest";
import { bfsPath } from "../pathfinder.ts";

describe("bfsPath", () => {
  const alwaysWalkable = () => true;

  it("returns path from origin to itself", () => {
    const path = bfsPath({ x: 0, y: 0 }, { x: 0, y: 0 }, alwaysWalkable);
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual({ x: 0, y: 0 });
  });

  it("finds a straight horizontal path", () => {
    const path = bfsPath({ x: 0, y: 0 }, { x: 3, y: 0 }, alwaysWalkable);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 0 });
    expect(path.length).toBe(4);
  });

  it("finds a path around a wall", () => {
    // Wall at x=1 for all y except y=2
    const walkable = (x: number, y: number) => !(x === 1 && y !== 2);
    const path = bfsPath({ x: 0, y: 0 }, { x: 2, y: 0 }, walkable);
    // Path should exist and not go through the wall
    expect(path.length).toBeGreaterThan(3);
    const goesThruWall = path.some((p) => p.x === 1 && p.y !== 2);
    expect(goesThruWall).toBe(false);
  });

  it("returns starting point when no path exists", () => {
    const blocked = () => false; // nothing walkable
    const path = bfsPath({ x: 0, y: 0 }, { x: 5, y: 5 }, blocked);
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual({ x: 0, y: 0 });
  });
});
