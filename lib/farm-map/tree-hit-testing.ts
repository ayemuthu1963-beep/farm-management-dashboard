export const DESKTOP_TREE_HIT_RADIUS_PX = 14
export const TOUCH_TREE_HIT_RADIUS_PX = 18
export const MOBILE_TREE_HIT_BREAKPOINT_PX = 768

export interface TreeHitPoint {
  x: number
  y: number
}

export interface TreeHitCandidate<T> extends TreeHitPoint {
  id: string
  value: T
}

export function treeHitRadiusPx({
  coarsePointer,
  viewportWidth,
}: {
  coarsePointer: boolean
  viewportWidth: number
}) {
  return coarsePointer || viewportWidth <= MOBILE_TREE_HIT_BREAKPOINT_PX
    ? TOUCH_TREE_HIT_RADIUS_PX
    : DESKTOP_TREE_HIT_RADIUS_PX
}

export function nearestTreeHit<T>(
  candidates: Iterable<TreeHitCandidate<T>>,
  clickPoint: TreeHitPoint,
  hitRadiusPx: number,
) {
  const maximumDistanceSquared = hitRadiusPx * hitRadiusPx
  let best: { candidate: TreeHitCandidate<T>; distanceSquared: number } | null = null

  for (const candidate of candidates) {
    const dx = candidate.x - clickPoint.x
    const dy = candidate.y - clickPoint.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared > maximumDistanceSquared) continue
    if (
      best === null ||
      distanceSquared < best.distanceSquared ||
      (distanceSquared === best.distanceSquared && candidate.id.localeCompare(best.candidate.id) < 0)
    ) {
      best = { candidate, distanceSquared }
    }
  }

  return best?.candidate ?? null
}
