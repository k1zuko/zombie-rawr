
"use client"

import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { forwardRef } from "react"

// Define CSS animations for slideUp and slideDown
const animationStyles = `
  @keyframes slideDown {
    from { height: 0; opacity: 0; }
    to { height: var(--radix-accordion-content-height); opacity: 1; }
  }
  @keyframes slideUp {
    from { height: var(--radix-accordion-content-height); opacity: 1; }
    to { height: 0; opacity: 0; }
  }
`

// Inject animation styles into the document
const styleElement = typeof document !== "undefined" ? document.createElement("style") : null
if (styleElement) {
  styleElement.textContent = animationStyles
  document.head.appendChild(styleElement)
}

/**
 * HorrorAccordion is a wrapper around Radix UI's Accordion.Root with a horror-themed style.
 * It serves as the root container for the accordion.
 */
const HorrorAccordion = AccordionPrimitive.Root

/**
 * HorrorAccordionItem is a single accordion item with horror-themed styling, including a red border and hover shadow effect.
 */
const HorrorAccordionItem = forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      "border-b border-red-900/50",
      "bg-black/80",
      "hover:shadow-[0_0_15px_rgba(255,0,0,0.2)]",
      "transition-all duration-300",
      className
    )}
    {...props}
  />
))
HorrorAccordionItem.displayName = "HorrorAccordionItem"

/**
 * HorrorAccordionTrigger is the clickable header of an accordion item, with a chevron icon
 * and horror-themed styling (red text, hover effects, and open state shadow).
 */
const HorrorAccordionTrigger = forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 px-6  text-lg text-red-200",
        "hover:bg-red-900/20 transition-all duration-200",
        "[&[data-state=open]]:bg-red-900/30 [&[data-state=open]]:shadow-[0_0_10px_rgba(255,0,0,0.3)]",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-5 w-5 text-red-400 transition-transform duration-200 data-[state=open]:rotate-180" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
HorrorAccordionTrigger.displayName = "HorrorAccordionTrigger"

/**
 * HorrorAccordionContent is the content area of an accordion item, with slide animations
 * and horror-themed styling (red text, dark background).
 */
const HorrorAccordionContent = forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden text-red-200  text-base",
      "data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown",
      "px-6 py-4 bg-black/90",
      className
    )}
    {...props}
  >
    <div>{children}</div>
  </AccordionPrimitive.Content>
))
HorrorAccordionContent.displayName = "HorrorAccordionContent"

export {
  HorrorAccordion,
  HorrorAccordionItem,
  HorrorAccordionTrigger,
  HorrorAccordionContent,
}
