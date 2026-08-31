import type { ReactNode } from "react"

import { CoconutCountingRefreshProvider } from "@/components/coconut-counting/auto-refresh"
import PassthroughLayout from "@/components/farm/passthrough-layout"

export const metadata = { title: "MFMS-Coconut Counting" }

export default function CoconutCountingLayout({ children }: { children: ReactNode }) {
  return (
    <PassthroughLayout>
      <CoconutCountingRefreshProvider>{children}</CoconutCountingRefreshProvider>
    </PassthroughLayout>
  )
}
