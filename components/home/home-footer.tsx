import { Leaf, BarChart3 } from "lucide-react"

export function HomeFooter() {
  return (
    <footer className="mt-8 flex flex-col items-center gap-2 rounded-2xl bg-[#eaf6df] px-6 py-5 text-center text-sm font-medium text-[#0d3f1e]">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <span>© 2025 Muthu Farms. All rights reserved.</span>
        <span className="text-[#9cae9a]">|</span>
        <span className="inline-flex items-center gap-1.5">
          Data Driven <Leaf className="size-4 text-[#0d5124]" aria-hidden="true" />
        </span>
        <span className="text-[#9cae9a]">|</span>
        <span className="inline-flex items-center gap-1.5">
          Smarter Decisions <BarChart3 className="size-4 text-[#0d5124]" aria-hidden="true" />
        </span>
        <span className="text-[#9cae9a]">|</span>
        <span className="inline-flex items-center gap-1.5">
          Better Yield <Leaf className="size-4 text-[#0d5124]" aria-hidden="true" />
        </span>
      </div>
      <span className="text-xs font-medium text-[#4a6b4f]">Site designed by Muthu</span>
    </footer>
  )
}
