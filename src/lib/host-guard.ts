// lib/host-guard.ts
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { mysupa } from "@/lib/supabase";

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
      const { data: session, error } = await mysupa
        .from("sessions")
        .select("host_id")
        .eq("game_pin", roomCode)
        .single();

      if (error || !session || session.host_id !== hostId) {
        router.replace(`/?isHost=0`);
      }
    })();
  }, [roomCode, router]);
}