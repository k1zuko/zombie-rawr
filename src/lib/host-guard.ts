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
    if (!hostId) {
      router.replace(`/?isHost=0`);
      return;
    }

    (async () => {
      const { data: room, error } = await supabase
        .from("game_rooms")
        .select("host_id")
        .eq("room_code", roomCode)
        .single();

      if (error || !room || room.host_id !== hostId) {
        router.replace(`/?isHost=0`);
      }
    })();
  }, [roomCode, router]);
}