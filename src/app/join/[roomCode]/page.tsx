"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { mysupa } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

export default function JoinPage() {
    const router = useRouter();
    const params = useParams();
    const roomCode = params.roomCode as string;
    const { t } = useTranslation();
    const { user, profile, loading: authLoading } = useAuth();
    const hasAttempted = useRef(false);

    useEffect(() => {
        if (authLoading || hasAttempted.current || !roomCode) return;

        // 1. If not logged in, redirect to login with pending code
        if (!user) {
            localStorage.setItem("pendingRoomCode", roomCode);
            router.replace("/login");
            return;
        }

        // 2. Wait for profile
        if (!profile) return;

        hasAttempted.current = true;

        const performAutoJoin = async () => {
            try {
                // Determine nickname
                let nickname = profile.nickname || profile.fullname || profile.username || user.email?.split('@')[0];

                // Call RPC
                const { data, error } = await mysupa.rpc("join_game", {
                    p_room_code: roomCode,
                    p_user_id: profile.id,
                    p_nickname: nickname
                });

                if (error || !data) {
                    console.error("Auto-join RPC error:", error);
                    toast.error(t("joinFailed") || "Failed to join room.");
                    setTimeout(() => router.replace("/"), 2000);
                    return;
                }

                if (data.error) {
                    if (data.error === 'room_not_found') toast.error(t("roomNotFound") || "Room not found!");
                    else if (data.error === 'session_locked') toast.error(t("gameAlreadyStarted") || "Game already started!");
                    else toast.error(t("joinFailed") || "Join failed: " + data.error);

                    setTimeout(() => router.replace("/"), 2000);
                    return;
                }

                // 5. Success
                localStorage.setItem("playerId", data.participant_id);
                localStorage.setItem("sessionId", data.session_id);
                localStorage.setItem("gamePin", data.game_pin);
                localStorage.setItem("nickname", data.nickname);
                localStorage.setItem("selectedCharacter", data.character_type);

                // cleanup
                localStorage.removeItem("pendingRoomCode");
                localStorage.removeItem("roomCode");

                router.replace(`/player/${data.game_pin}/lobby`);

            } catch (error) {
                console.error("Auto-join error:", error);
                toast.error("An unexpected error occurred.");
                setTimeout(() => router.replace("/"), 2000);
            }
        };

        performAutoJoin();

    }, [roomCode, user, profile, authLoading, router, t]);

    return <LoadingScreen>{t("joining") || "Joining Room..."}</LoadingScreen>;
}
