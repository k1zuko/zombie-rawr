import { Skull } from "lucide-react"

export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/10 via-black to-purple-900/10" />
      <div className="text-center z-10">
        <Skull className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
        <p className="text-white font-mono text-xl tracking-widest">MEMANGGIL JIWA-JIWA TERKUTUK...</p>
        <p className="text-red-400 font-mono text-sm mt-2">Roh-roh berbisik tentang nasibmu...</p>
      </div>
    </div>
  )
}
