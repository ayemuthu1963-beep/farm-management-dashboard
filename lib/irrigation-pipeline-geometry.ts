import type { PipelineTreeOption } from "@/lib/irrigation-pipeline-types"

export function pipelineDistanceMetres(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const radians = (value: number) => (value * Math.PI) / 180
  const deltaLatitude = radians(latitudeB - latitudeA)
  const deltaLongitude = radians(longitudeB - longitudeA)
  const calculation =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2
  return 6_371_008.8 * 2 * Math.asin(Math.sqrt(calculation))
}

export function nearestPipelineTrees(
  latitude: number,
  longitude: number,
  trees: PipelineTreeOption[],
  limit = 6,
) {
  return trees
    .map((tree) => ({
      ...tree,
      distance: pipelineDistanceMetres(latitude, longitude, tree.latitude, tree.longitude),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, limit)
}
