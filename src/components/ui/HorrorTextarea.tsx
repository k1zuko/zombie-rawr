// src/components/ui/HorrorTextarea.tsx
"use client"

import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface HorrorTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

const HorrorTextarea = forwardRef<HTMLTextAreaElement, HorrorTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full resize-y rounded-lg border-2 border-red-900/50 bg-black/80 text-red-200 placeholder:text-red-400/50",
          "focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600",
          "p-3 text-lg  tracking-wide",
          "shadow-[0_0_10px_rgba(255,0,0,0.2)] hover:shadow-[0_0_15px_rgba(255,0,0,0.3)]",
          "transition-all duration-300",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

HorrorTextarea.displayName = "HorrorTextarea"

export { HorrorTextarea }