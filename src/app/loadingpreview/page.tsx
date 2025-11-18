// app/loading-preview/page.tsx
import LoadingScreen from "@/components/LoadingScreen"   // sesuaikan path kalau beda

export default function LoadingPreview() {
  return (
    <div className="fixed inset-0">
      <LoadingScreen />
    </div>
  )
}