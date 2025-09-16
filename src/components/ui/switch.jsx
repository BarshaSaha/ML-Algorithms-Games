import React from "react"

export function Switch({ checked, onCheckedChange, id, className }){
  return (
    <input
      id={id}
      type="checkbox"
      checked={!!checked}
      onChange={(e)=> onCheckedChange && onCheckedChange(e.target.checked)}
      className={className}
    />
  )
}