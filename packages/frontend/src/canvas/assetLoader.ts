export interface GameAssets {
  characters: HTMLImageElement;
  officeTiles: HTMLImageElement;
}

let cached: GameAssets | null = null;
let loadingPromise: Promise<GameAssets> | null = null;

export async function loadAssets(): Promise<GameAssets> {
  if (cached) return cached;
  if (loadingPromise) return loadingPromise;

  loadingPromise = Promise.all([
    loadImage("/assets/sprites/characters.png"),
    loadImage("/assets/tilesets/office.png"),
  ]).then(([characters, officeTiles]) => {
    cached = { characters, officeTiles };
    return cached;
  }).catch((err: unknown) => {
    loadingPromise = null; // allow retry
    throw err;
  });

  return loadingPromise;
}

export function clearAssetCache(): void {
  cached = null;
  loadingPromise = null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
    img.src = src;
  });
}
