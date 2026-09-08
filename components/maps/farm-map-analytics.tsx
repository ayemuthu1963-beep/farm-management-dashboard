"use client"

import { Analytics as VercelAnalytics } from "@vercel/analytics/next"
import { usePathname } from "next/navigation"
import { shouldLoadPageAnalytics } from "@/lib/farm-map-analytics"

export function Analytics() {
  const pathname = usePathname()
  return shouldLoadPageAnalytics(pathname) ? <VercelAnalytics /> : null
}
