"use client";

function preload(assets: string[]): Promise<void[]> {
  const promises = assets.map((src) => {
    return new Promise<void>((resolve, reject) => {
      if (src.endsWith('.mp3')) {
        // For audio, we can use a different preloading strategy if needed,
        // but for now, we'll just resolve immediately as simple preloading is complex.
        // A better approach would use the <audio> element and wait for 'canplaythrough'.
        resolve();
      } else {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve();
        img.onerror = () => {
          console.warn(`Failed to load asset: ${src}, but continuing...`);
          resolve(); // Resolve even on error to not block the app
        }
      }
    });
  });
  return Promise.all(promises);
}

const GLOBAL_ASSETS = [
  "/character/player/character.webp",
  "/character/player/character1-crop.webp",
  "/character/player/character2-crop.webp",
  "/character/player/character3-crop.webp",
  "/character/player/character4-crop.webp",
  "/character/player/character5.webp",
  "/character/player/character6.webp",
  "/character/player/character7-crop.webp",
  "/character/player/character8-crop.webp",
  "/character/player/character9-crop.webp",
  "/logo/gameforsmartlogo-horror.png"
];

const HOST_ASSETS = [
  // Map utama
  "/map6/1.webp",
  "/map6/3.webp",
  "/map6/4.webp",
  "/map6/5.webp",
  "/map6/7.webp",
  "/map6/8.webp",

  // Chaser utama
  "/character/chaser/zombie.webp",
  "/character/chaser/monster1.webp",
  "/character/chaser/monster2.webp",
  "/character/chaser/monster3.webp",
  "/character/chaser/darknight.webp",
];

const ALL_ASSETS = [...GLOBAL_ASSETS, ...HOST_ASSETS];

export function preloadAllAssets(): Promise<void[]> {
  return preload(ALL_ASSETS);
}

// Keep old functions for compatibility if they are used elsewhere,
// but they are no longer async.
export function preloadGlobalAssets() {
  preload(GLOBAL_ASSETS);
}

export function preloadHostAssets() {
  preload(HOST_ASSETS);
}