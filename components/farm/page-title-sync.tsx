"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

import { pageTitleForPathname } from "@/lib/page-titles"

export function PageTitleSync() {
  const pathname = usePathname()

  useEffect(() => {
    document.title = pageTitleForPathname(pathname)
  }, [pathname])

  return null
}
