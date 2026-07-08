import { HomeHeader } from "@/components/home/home-header"
import { WeatherCard } from "@/components/home/weather-card"
import { ModuleCard } from "@/components/home/module-card"
import { HomeFooter } from "@/components/home/home-footer"
import { moduleCards, weatherData } from "@/lib/home-data"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#d5ecca] via-[#e4f2db] to-[#c9e6bb]">
      <div className="mx-auto max-w-[1536px] px-4 py-6 sm:px-6">
        <HomeHeader />

        <section
          aria-label="Farm modules"
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {/* 1. Today's Weather */}
          <WeatherCard data={weatherData} />

          {/* 2-8. Module cards (order frozen per approved reference) */}
          {moduleCards.map((card) => (
            <ModuleCard key={card.id} data={card} />
          ))}
        </section>

        <HomeFooter />
      </div>
    </main>
  )
}
