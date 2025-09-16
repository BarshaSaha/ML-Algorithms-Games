import React from "react"
import { cn } from "@/lib/utils"

function collectItems(children, acc=[]){
  React.Children.forEach(children, child=>{
    if(!React.isValidElement(child)) return
    if(child.type && child.type.__kind === "SelectItem"){
      acc.push({ value: child.props.value, label: child.props.children })
    }
    if(child.props && child.props.children){
      collectItems(child.props.children, acc)
    }
  })
  return acc
}

export function Select({ value, onValueChange, children, className }){
  let triggerClass = ""
  React.Children.forEach(children, child=>{
    if(React.isValidElement(child) && child.type && child.type.__kind==="SelectTrigger"){
      triggerClass = child.props.className || ""
    }
  })
  const items = collectItems(children, [])
  return (
    <select
      className={cn("border rounded-lg px-2 py-2 bg-white", triggerClass, className)}
      value={value}
      onChange={(e)=> onValueChange && onValueChange(e.target.value)}
    >
      {items.map(opt=> <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  )
}
export function SelectTrigger(props){ return null }
SelectTrigger.__kind = "SelectTrigger"

export function SelectContent(props){ return null }
SelectContent.__kind = "SelectContent"

export function SelectItem(props){ return null }
SelectItem.__kind = "SelectItem"

export function SelectValue(){ return null }