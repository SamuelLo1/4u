import React from 'react'
import type {NormalizedBox, RoomSlotId} from '../lib/slots'

type Props = {
  boxes: NormalizedBox[]
  onTapSlot?: (slot: RoomSlotId) => void
}

export function Hotspots({boxes, onTapSlot}: Props) {
  return (
    <div className="relative w-full">
      {boxes.map(box => (
        <button
          key={box.label}
          className="absolute border-2 border-white/70 rounded-lg bg-black/10"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
          }}
          aria-label={box.label}
          onClick={() => onTapSlot?.(box.label)}
        />
      ))}
    </div>
  )
}

