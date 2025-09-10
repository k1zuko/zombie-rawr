// lib/host-guard.ts
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function useHostGuard(roomCode: string) {
  const router = useRouter();

  useEffect(() => {
    // 1. Pastikan jalan di browser
    if (typeof window === "undefined") return;

    const hostId = sessionStorage.getItem("currentHostId");
    const redirectTo = sessionStorage.getItem("redirectTo") || "/" || `/game/${roomCode}` || `/game/${roomCode}/results`;

    if (!hostId && redirectTo == "/") {
      router.replace(`/?isHost=0`);
    } else if (!hostId) {
      router.replace(redirectTo);
    }

    (async () => {
      const { data: room, error } = await supabase
        .from("game_rooms")
        .select("host_id")
        .eq("room_code", roomCode)
        .single();

      if (error || !room || room.host_id !== hostId) {
        if (redirectTo == "/") {
          router.replace(`/?isHost=0`);
        } else if (!hostId) {
          router.replace(redirectTo);
        }
      }
    })();
  }, [roomCode, router]);
}