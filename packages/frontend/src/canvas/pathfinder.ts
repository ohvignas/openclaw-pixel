export interface Point {
  x: number;
  y: number;
}

const DIRECTIONS: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
const MAX_SEARCH = 2000; // prevent infinite loops on large maps

export function bfsPath(
  from: Point,
  to: Point,
  walkable: (x: number, y: number) => boolean
): Point[] {
  if (from.x === to.x && from.y === to.y) return [from];

  const queue: Array<{ pos: Point; path: Point[] }> = [{ pos: from, path: [from] }];
  const visited = new Set<string>();
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_SEARCH) {
    iterations++;
    const item = queue.shift()!;
    const { pos, path } = item;
    const key = `${pos.x},${pos.y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (pos.x === to.x && pos.y === to.y) return path;

    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: pos.x + dx, y: pos.y + dy };
      const nextKey = `${next.x},${next.y}`;
      if (!visited.has(nextKey) && walkable(next.x, next.y)) {
        queue.push({ pos: next, path: [...path, next] });
      }
    }
  }

  return [from]; // no path found
}
