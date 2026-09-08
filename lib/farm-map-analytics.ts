export function shouldLoadPageAnalytics(pathname: string | null) {
  return pathname !== "/farm-map" && pathname !== "/farm-map/"
}
