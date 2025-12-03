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
      const { data: session, error } = await supabase
        .from("game_sessions")
        .select("host_id")
        .eq("game_pin", roomCode)
        .single();

      if (error || !session || session.host_id !== hostId) {
        if (redirectTo == "/") {
          router.replace(`/?isHost=0`);
        } else if (!hostId) {
          router.replace(redirectTo);
        }
      }
    })();
  }, [roomCode, router]);
}