const exactPageTitles: Record<string, string> = {
  "/": "MFMS-Dashboard",
  "/admin": "MFMS-Admin Console",
  "/admin/beetle-trap": "MFMS-Beetle Trap Admin",
  "/admin/harvest": "MFMS-Harvest Admin",
  "/admin/harvest-cycle": "MFMS-Harvest Cycle Admin",
  "/admin/harvest-sync": "MFMS-Harvest Sync",
  "/admin/motor-runtime": "MFMS-Motor Runtime Management",
  "/admin/tree-lifecycle": "MFMS-Tree Lifecycle Admin",
  "/admin/well-water": "MFMS-Well Water Admin",
  "/beetle-trap": "MFMS-Beetle Trap",
  "/coconut-counting": "MFMS-Coconut Counting",
  "/coconut-harvest": "MFMS-Coconut Harvest",
  "/coconut-harvest/cycle-view": "MFMS-Harvest Cycle View",
  "/coconut-harvest/detailed-query": "MFMS-Coconut Detailed Query",
  "/coconut-harvest/live-counter": "MFMS-Harvest Live Counter",
  "/coconut-harvest/tree-performance": "MFMS-Tree Performance",
  "/coconut-harvest/tree-view": "MFMS-Coconut Tree View",
  "/coconut-harvest/tree-wise-query": "MFMS-Tree-wise Query",
  "/farm-map": "MFMS-Farm Map",
  "/fertiliser-management": "MFMS-Fertiliser Management",
  "/harvest-live-counter": "MFMS-Harvest Live Counter",
  "/inventory-management": "MFMS-Asset Register",
  "/inventory-management/entry": "MFMS-Asset Entry",
  "/irrigation-management": "MFMS-Irrigation Management",
  "/jackfruit-monitoring": "MFMS-Jackfruit Monitoring",
  "/live-harvest-counter": "MFMS-Live Harvest Counter",
  "/motor-runtime": "MFMS-Motor Runtime",
  "/pipeline-layout": "MFMS-Pipeline Layout",
  "/under-construction": "MFMS-Coming Soon",
  "/well-water": "MFMS-Well Water Data",
  "/worker-management/daily-attendance": "MFMS-Daily Attendance",
}

function humanizeRouteSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}

export function pageTitleForPathname(pathname: string): string {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname
  const exact = exactPageTitles[normalized]
  if (exact) return exact

  const segment = normalized.split("/").filter(Boolean).at(-1)
  return segment ? `MFMS-${humanizeRouteSegment(segment)}` : "MFMS-Dashboard"
}
