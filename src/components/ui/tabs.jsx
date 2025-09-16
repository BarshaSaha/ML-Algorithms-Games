import React, { createContext, useContext, useState } from "react"
import { cn } from "@/lib/utils"

const TabsCtx = createContext(null)

export function Tabs({ defaultValue, className, children }){
  const [value, setValue] = useState(defaultValue)
  return <TabsCtx.Provider value={{value,setValue}}><div className={className}>{children}</div></TabsCtx.Provider>
}
export function TabsList({ className, children }){
  return <div className={cn("grid gap-2 bg-white border rounded-xl p-2", className)}>{children}</div>
}
export function TabsTrigger({ value, className, children }){
  const ctx = useContext(TabsCtx)
  const active = ctx?.value === value
  return (
    <button
      className={cn("px-3 py-2 text-sm rounded-lg border",
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 hover:bg-gray-50",
        className
      )}
      onClick={()=>ctx?.setValue(value)}
    >
      {children}
    </button>
  )
}
export function TabsContent({ value, className, children }){
  const ctx = useContext(TabsCtx)
  if(ctx?.value !== value) return null
  return <div className={cn("mt-4", className)}>{children}</div>
}