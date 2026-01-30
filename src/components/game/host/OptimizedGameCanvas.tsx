"use client";

import React, { useEffect, useRef, memo } from "react";
import { Participant } from "@/app/host/[roomCode]/game/page";
import { EmbeddedPlayer } from "@/lib/supabase";
import { Heart } from "lucide-react";

// --- Types ---
interface PlayerState {
    health: number;
    speed: number;
    attackIntensity: number;
}

interface ZombieState {
    targetPlayerId: string | null;
    isAttacking: boolean;
    attackProgress: number;
    currentPosition: number;
}

interface OptimizedGameCanvasProps {
    players: Participant[];
    playerStates: { [playerId: string]: PlayerState };
    zombieState: ZombieState;
    gameMode: "normal" | "panic";
    centerX: number;
    completedPlayers: EmbeddedPlayer[];
    screenHeight: number;
    screenWidth: number;
    isPortraitMobile: boolean;
    mobileHorizontalShift: number;
    chaserType: string;
}

// --- Asset Configs ---
const characterConfigs = {
    robot1: { src: "/character/player/character.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot2: { src: "/character/player/character1-crop.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot3: { src: "/character/player/character2-crop.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot4: { src: "/character/player/character4-crop.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot5: { src: "/character/player/character5-resize.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot6: { src: "/character/player/character6.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot7: { src: "/character/player/character7-crop.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot8: { src: "/character/player/character7-crop.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot9: { src: "/character/player/character8-crop.webp", width: 150, height: 50, verticalOffset: "73%", horizontalOffset: -900, mobileHorizontalOffset: -150 },
    robot10: { src: "/character/player/character9-crop.webp", width: 150, height: 50, verticalOffset: "75%", horizontalOffset: -900, mobileHorizontalOffset: -140 },
} as const;

const chaserImages = {
    zombie: { src: "/character/chaser/zombie.webp", width: 150, height: 50, verticalOffset: "75%", horizontalOffset: -150 },
    monster1: { src: "/character/chaser/monster1.webp", width: 165, height: 60, verticalOffset: "80%", horizontalOffset: -150 },
    monster2: { src: "/character/chaser/monster2.webp", width: 150, height: 75, verticalOffset: "75%", horizontalOffset: -150 },
    monster3: { src: "/character/chaser/monster3.webp", width: 150, height: 65, verticalOffset: "75%", horizontalOffset: -150 },
    darknight: { src: "/character/chaser/darknight.webp", width: 150, height: 70, verticalOffset: "75%", horizontalOffset: -150 },
};

// --- Helper for Ref Management ---
const useLoopRef = <T,>(val: T) => {
    const ref = useRef(val);
    useEffect(() => { ref.current = val; }, [val]);
    return ref;
};

const OptimizedGameCanvas = memo(function OptimizedGameCanvas(props: OptimizedGameCanvasProps) {
    const propsRef = useLoopRef(props);
    const requestRef = useRef<number | null>(null);

    // DOM Refs
    const playerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const zombieRef = useRef<HTMLDivElement>(null);

    const animate = (time: number) => {
        const {
            players, playerStates, zombieState,
            gameMode, centerX, screenHeight, isPortraitMobile,
            mobileHorizontalShift, completedPlayers
        } = propsRef.current;

        const designHeight = 1080;
        const scaleFactor = Math.max(0.4, screenHeight / designHeight);

        // Mobile Scaling Tweak
        const mobileScaleMultiplier = isPortraitMobile ? 0.88 : 1.0;
        const effectiveScaleFactor = scaleFactor * mobileScaleMultiplier;

        // --- Update Players ---
        players.forEach(p => {
            const div = playerRefs.current.get(p.id);
            const state = playerStates[p.id];
            const isCompleted = completedPlayers.some(cp => cp.player_id === p.id);

            if (!div || !state || isCompleted || !p.is_alive || state.health <= 0) {
                if (div) div.style.display = 'none';
                return;
            }

            div.style.display = 'block';

            const config = characterConfigs[p.character_type as keyof typeof characterConfigs] || characterConfigs.robot1;
            const isTarget = zombieState.targetPlayerId === p.id;

            // --- SCALE LOGIC (Updated - Bigger) ---
            // Fix: Only target player zooms during attack (panic), others stay normal
            const baseScale = 1.15;
            const targetScale = isTarget ? 1.35 : baseScale;
            // Bump z-index if target so it appears in front of zombie/others
            if (div) div.style.zIndex = isTarget ? '100' : '50';

            const finalScale = targetScale * effectiveScaleFactor;

            // --- POSITION LOGIC ---
            const hOffset = isPortraitMobile
                ? (config.mobileHorizontalOffset ?? -150)
                : config.horizontalOffset;

            let x = centerX + (hOffset * effectiveScaleFactor);

            if (!isPortraitMobile) {
                const baseOffset = 70 * scaleFactor;
                const speedOffset = (state.speed - 5) * 25 * scaleFactor;
                x += baseOffset + speedOffset;
            } else {
                x += mobileHorizontalShift;
            }

            // Shake Effect
            if (isTarget && state.attackIntensity > 0) {
                const shakeX = Math.sin(time / 50) * state.attackIntensity * 4;
                const shakeY = Math.sin(time / 30) * state.attackIntensity * 3;
                x += shakeX;
            }

            // Y Position (94% height)
            const MOBILE_BOTTOM_OFFSET = 34;
            const y = isPortraitMobile
                ? screenHeight - (MOBILE_BOTTOM_OFFSET * effectiveScaleFactor)
                : screenHeight * 0.94;

            div.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${finalScale})`;

            // --- UPDATE HEARTS (DOM) ---
            const hearts = div.querySelectorAll('.heart-icon');
            // Assuming 1 Health = 1 Heart
            const activeHearts = Math.ceil(state.health);

            hearts.forEach((heart, index) => {
                const el = heart as HTMLElement;
                // Lucide SVG manipulation via style
                if (index < activeHearts) {
                    el.style.fill = '#ef4444'; // Red fill
                    el.style.color = '#ef4444'; // Red stroke
                    el.style.opacity = '1';
                } else {
                    el.style.fill = 'none'; // No fill
                    el.style.color = '#555'; // Grey stroke
                    el.style.opacity = '0.5';
                }
            });
        });

        // --- Update Zombie ---
        if (zombieRef.current) {
            const isAttacking = zombieState.isAttacking;
            const attackProgress = isAttacking ? zombieState.attackProgress : 0;
            const ATTACK_DISTANCE_SCALED = 50 * scaleFactor;
            const movementX = attackProgress * ATTACK_DISTANCE_SCALED;

            // --- ZOMBIE SCALE (Updated - Larger) ---
            // Increased scale as requested (was 1.7/1.6 -> now 2.0/1.8 approx)
            const zombieBaseScale = isAttacking
                ? (gameMode === "panic" ? 2.0 : 1.9)
                : (gameMode === "panic" ? 1.9 : 1.8);
            const zombieFinalScale = zombieBaseScale * scaleFactor;

            const zombieHOffset = -150 * scaleFactor;
            const zombieX = isPortraitMobile
                ? centerX + movementX + zombieHOffset + mobileHorizontalShift
                : centerX - zombieState.currentPosition + movementX + zombieHOffset;

            const zombieY = isPortraitMobile
                ? screenHeight - (30 * scaleFactor)
                : screenHeight * 0.94;

            zombieRef.current.style.transform = `translate3d(${zombieX}px, ${zombieY}px, 0) scale(${zombieFinalScale})`;
        }

        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, []);

    const activePlayers = props.players;

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 35, overflow: 'hidden' }}>

            {/* --- Players --- */}
            {activePlayers.map(p => {
                const config = characterConfigs[p.character_type as keyof typeof characterConfigs] || characterConfigs.robot1;
                return (
                    <div
                        key={p.id}
                        ref={el => { if (el) playerRefs.current.set(p.id, el); else playerRefs.current.delete(p.id); }}
                        className="absolute top-0 left-0 will-change-transform"
                        style={{
                            transformOrigin: 'bottom center',
                            width: '150px',
                            height: '200px',
                            marginTop: '-200px',
                            marginLeft: '-75px',
                        }}
                    >
                        {/* 
                            INFO CONTAINER
                            Moved explicitly ABOVE the character image (-top-16 approx).
                        */}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 w-[150px]">
                            {/* Hearts Row */}
                            <div className="flex gap-0.5 justify-center mb-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
                                {[...Array((p.health && p.health.max) || 3)].map((_, i) => (
                                    <Heart
                                        key={i}
                                        size={16}
                                        className="heart-icon transition-all duration-200"
                                        fill="none"
                                        color="#555"
                                        strokeWidth={3}
                                    />
                                ))}
                            </div>
                            {/* Nickname */}
                            <span className="text-white text-sm font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] px-2 py-0.5 rounded bg-black/40 backdrop-blur-[1px] border border-white/10 inline-block max-w-[140px] truncate text-center">
                                {p.nickname}
                            </span>
                        </div>

                        {/* Character Image */}
                        <div className="relative w-full h-full flex items-end justify-center">
                            <img
                                src={config.src}
                                alt={p.nickname}
                                className="object-contain"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    imageRendering: 'auto'
                                }}
                            />
                        </div>
                    </div>
                );
            })}

            {/* --- Zombie --- */}
            <div
                ref={zombieRef}
                className="absolute top-0 left-0 will-change-transform"
                style={{
                    transformOrigin: 'bottom center',
                    width: '160px',
                    height: '200px',
                    marginTop: '-200px',
                    marginLeft: '-80px',
                }}
            >
                <img
                    src={chaserImages[props.chaserType as keyof typeof chaserImages]?.src || chaserImages.zombie.src}
                    alt="Zombie"
                    className="w-full h-full object-contain object-bottom"
                />
            </div>

        </div>
    );
});

export default OptimizedGameCanvas;
