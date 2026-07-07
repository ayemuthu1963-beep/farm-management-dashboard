import {
  Droplets,
  Wind,
  CloudRain,
  Sun,
  Sunrise,
  Sunset,
  MapPin,
  type LucideIcon,
} from "lucide-react"
import { WeatherIcon } from "@/components/farm/weather-icon"
import {
  currentWeather,
  hourlyForecast,
  weeklyForecast,
} from "@/lib/weather-data"

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function WeatherWidget() {
  const w = currentWeather

  return (
    <section
      aria-label="Today's weather"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground sm:text-base">
          Today&apos;s Weather
        </h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 text-primary" aria-hidden="true" />
          {w.location}
        </span>
      </div>

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Current conditions */}
        <div className="flex flex-col justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <WeatherIcon condition={w.condition} className="size-10" />
            </span>
            <div>
              <p className="text-4xl font-extrabold leading-none text-foreground">{w.temperatureC}&deg;C</p>
              <p className="mt-1 text-sm text-muted-foreground">{w.summary}</p>
              <p className="text-xs text-muted-foreground">
                Feels like {w.feelsLikeC}&deg; &middot; H:{w.highC}&deg; L:{w.lowC}&deg;
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric icon={Droplets} label="Humidity" value={`${w.humidityPct}%`} />
            <Metric icon={Wind} label="Wind" value={`${w.windKmh} km/h`} />
            <Metric icon={CloudRain} label="Rain chance" value={`${w.rainChancePct}%`} />
            <Metric icon={Sun} label="UV index" value={`${w.uvIndex}`} />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sunrise className="size-4 text-chart-3" aria-hidden="true" />
              {w.sunrise}
            </span>
            <span className="flex items-center gap-1">
              <Sunset className="size-4 text-chart-5" aria-hidden="true" />
              {w.sunset}
            </span>
            <span className="flex items-center gap-1">
              <CloudRain className="size-4 text-chart-1" aria-hidden="true" />
              {w.rainfallMm} mm today
            </span>
          </div>
        </div>

        {/* Forecast */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hourly</p>
            <ul className="flex justify-between gap-1">
              {hourlyForecast.map((h) => (
                <li
                  key={h.time}
                  className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-secondary/60 py-2 text-center"
                >
                  <span className="text-[11px] text-muted-foreground">{h.time}</span>
                  <WeatherIcon condition={h.condition} className="size-5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">{h.temperatureC}&deg;</span>
                  <span className="text-[10px] text-chart-1">{h.rainChancePct}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">5-day outlook</p>
            <ul className="flex flex-col gap-1">
              {weeklyForecast.map((d) => (
                <li key={d.day} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/60">
                  <span className="w-12 text-xs font-medium text-foreground">{d.day}</span>
                  <WeatherIcon condition={d.condition} className="size-4 shrink-0 text-primary" />
                  <span className="flex items-center gap-1 text-[11px] text-chart-1">
                    <CloudRain className="size-3" aria-hidden="true" />
                    {d.rainChancePct}%
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{d.highC}&deg;</span> / {d.lowC}&deg;
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
