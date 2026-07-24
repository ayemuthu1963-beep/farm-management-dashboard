"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Home, Leaf, BarChart3 } from "lucide-react"

const pills = [
  { label: "DATA DRIVEN", icon: Leaf },
  { label: "SMARTER DECISIONS", icon: BarChart3 },
  { label: "BETTER YIELD", icon: Leaf },
]

export function HomeHeader() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const dateText = now
    ? now.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Loading date..."

  const timeText = now
    ? now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "Loading time..."

  return (
    <header
      className="relative overflow-hidden rounded-2xl bg-[#eaf6df] shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      style={{ minHeight: 400 }}
    >
      {/* Coconut plantation background */}
      <Image
        src="/mfms/header/coconut-plantation-bg.png"
        alt=""
        fill
        priority
        aria-hidden="true"
        className="object-cover"
      />
      {/* Readability overlay, lighter on the left where the title sits,
          softer on the right so the plantation stays clearly visible. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#f5fcf0]/85 via-[#eef8e6]/55 to-[#eef8e6]/30"
      />

      {/* Top-right actions */}
      <div className="absolute right-4 top-4 z-20 flex gap-3 sm:right-8 sm:top-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-base font-extrabold text-[#082c17] shadow-md transition-colors hover:bg-white/90"
        >
          <Home className="size-5" aria-hidden="true" />
          Home
        </Link>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col gap-6 px-5 pb-6 pt-20 sm:px-9 sm:pt-24 lg:pt-10">
        <div className="flex flex-wrap items-center gap-5 sm:gap-8">
          <Image
            src="/mfms/logo/muthu-farms-drone-tablet-logo.png"
            alt="Muthu Farms"
            width={250}
            height={250}
            priority
            className="h-32 w-32 object-contain sm:h-44 sm:w-44 lg:h-[250px] lg:w-[250px]"
          />
          <div className="font-serif leading-none text-[#074018]">
            <h1 className="text-5xl font-black tracking-[0.15em] sm:text-6xl lg:text-7xl">MUTHU</h1>
            <h2 className="mt-1 text-3xl font-bold tracking-[0.3em] text-[#0d5124] sm:text-4xl lg:text-[45px]">
              FARMS
            </h2>
            <p className="mt-2 font-sans text-sm font-extrabold tracking-wide text-[#092d18] sm:text-lg lg:text-xl">
              DIGITAL FARM MANAGEMENT SYSTEM
            </p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-3xl border border-[#d9e7d8] bg-white/80 px-5 py-3 font-extrabold text-[#103b22] shadow-[0_6px_18px_rgba(0,0,0,0.08)] backdrop-blur lg:absolute lg:bottom-12 lg:right-8 lg:w-auto">
          {pills.map((pill, index) => {
            const Icon = pill.icon
            return (
              <span
                key={pill.label}
                className={`flex items-center gap-2 text-sm sm:text-base ${
                  index > 0 ? "sm:border-l sm:border-[#9cae9a] sm:pl-5" : ""
                }`}
              >
                <Icon className="size-5 text-[#0d5124]" aria-hidden="true" />
                {pill.label}
              </span>
            )
          })}
        </div>

      </div>

      <div className="relative z-10 mx-5 mb-4 text-[#0b3b1b] sm:mx-9 lg:absolute lg:bottom-4 lg:left-14 lg:mx-0 lg:mb-0">
        <div className="rounded-2xl border border-[#d9e7d8] bg-white/75 px-4 py-2 shadow-sm backdrop-blur lg:min-w-[210px]">
          <p className="text-sm font-extrabold leading-tight">{dateText}</p>
          <p className="text-sm font-extrabold leading-tight">{timeText}</p>
        </div>
      </div>
    </header>
  )
}
