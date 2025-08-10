export type RoomSlotId =
  | 'bed'
  | 'desk_laptop'
  | 'rug'
  | 'floor_lamp'
  | 'wall_art'
  | 'nightstand'
  | 'plant'

export type NormalizedBox = {x: number; y: number; w: number; h: number; label: RoomSlotId}

export const DEFAULT_SLOTS: NormalizedBox[] = [
  {x: 0.10, y: 0.55, w: 0.40, h: 0.35, label: 'bed'},
  {x: 0.55, y: 0.55, w: 0.35, h: 0.30, label: 'desk_laptop'},
  {x: 0.08, y: 0.88, w: 0.84, h: 0.10, label: 'rug'},
  {x: 0.70, y: 0.40, w: 0.18, h: 0.28, label: 'floor_lamp'},
  {x: 0.62, y: 0.15, w: 0.28, h: 0.18, label: 'wall_art'},
  {x: 0.22, y: 0.50, w: 0.10, h: 0.16, label: 'nightstand'},
  {x: 0.15, y: 0.45, w: 0.12, h: 0.18, label: 'plant'},
]

export function buildDefaultBoxes(seed?: number): NormalizedBox[] {
  // Deterministic: we could jitter slightly by seed; keep static for now
  return DEFAULT_SLOTS
}

