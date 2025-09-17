import { supabase } from "./supabase"

// Cache untuk offset waktu server-client
let serverTimeOffset: number | null = null
let lastSyncTime = 0
const SYNC_INTERVAL = 30000 // Re-sync setiap 30 detik

/**
 * Mendapatkan waktu server yang akurat
 */
export async function getServerTime(): Promise<number> {
  try {
    const startTime = Date.now()

    // Gunakan fungsi now() dari Supabase untuk mendapatkan server time
    const { data, error } = await supabase.rpc("get_server_time")

    if (error) {
      console.error("❌ Error getting server time:", error)
      return Date.now() // Fallback ke client time
    }

    const endTime = Date.now()
    const networkLatency = (endTime - startTime) / 2
    const serverTime = new Date(data).getTime()

    // Kompensasi network latency
    return serverTime + networkLatency
  } catch (error) {
    console.error("❌ Error getting server time:", error)
    return Date.now() // Fallback ke client time
  }
}

/**
 * Sinkronisasi waktu server-client dan cache offset
 */
export async function syncServerTime(): Promise<void> {
  const now = Date.now()

  // Skip jika baru saja sync
  if (serverTimeOffset !== null && now - lastSyncTime < SYNC_INTERVAL) {
    return
  }

  try {
    const serverTime = await getServerTime()
    const clientTime = Date.now()

    serverTimeOffset = serverTime - clientTime
    lastSyncTime = now

    console.log("⏰ Server time synced. Offset:", serverTimeOffset, "ms")
  } catch (error) {
    console.error("❌ Failed to sync server time:", error)
  }
}

/**
 * Mendapatkan waktu server yang sudah disinkronisasi (lebih cepat)
 */
export function getSyncedServerTime(): number {
  if (serverTimeOffset === null) {
    // Jika belum sync, gunakan client time
    return Date.now()
  }

  return Date.now() + serverTimeOffset
}

/**
 * Menghitung countdown yang akurat menggunakan server time
 */
// export function calculateCountdown(countdownStartTime: string | number, durationMs = 10000): number {
//   const startTime = typeof countdownStartTime === "string" ? new Date(countdownStartTime).getTime() : countdownStartTime

//   const currentServerTime = getSyncedServerTime()
//   const elapsed = currentServerTime - startTime
//   const remaining = Math.max(0, durationMs - elapsed)

//   return Math.ceil(remaining / 1000)
// }
export function calculateCountdown(countdownStartTime: string | number | null, durationMs = 10000): number {
  if (countdownStartTime === null) {
    return 0; // Kembalikan 0 jika countdownStartTime adalah null
  }

  const startTime = typeof countdownStartTime === "string" ? new Date(countdownStartTime).getTime() : countdownStartTime;

  const currentServerTime = getSyncedServerTime();
  const elapsed = currentServerTime - startTime;
  const remaining = Math.max(0, durationMs - elapsed);

  return Math.ceil(remaining / 1000);
}