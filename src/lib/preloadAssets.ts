"use client";

function preload(assets: string[]) {
  assets.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

// Preload karakter player (dipanggil di HomePage)
export function preloadGlobalAssets() {
  preload([
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
  ]);
}

// Preload map + chaser (dipanggil di HostGamePage)
export function preloadHostAssets() {
  preload([
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
  ]);
}
