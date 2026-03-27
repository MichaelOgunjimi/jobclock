"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root className={cn("flex flex-col", className)} {...props} />
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex border-b border-border",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative px-4 py-2.5 text-[13px] font-medium tracking-[0.02em] text-muted-foreground transition-colors outline-none",
        "hover:text-foreground",
        "data-[active]:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/20",
        // Active underline
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-foreground after:scale-x-0 data-[active]:after:scale-x-100 after:transition-transform",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
