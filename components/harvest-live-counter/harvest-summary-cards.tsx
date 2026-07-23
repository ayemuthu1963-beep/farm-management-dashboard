'use client'

import { formatIndianNumber } from '@/lib/harvest-live-counter-mock'

interface HarvestSummaryCardsProps {
  treesHarvested: number
  totalBunches: number
  submissionCount: number
}

export function HarvestSummaryCards({
  treesHarvested,
  totalBunches,
  submissionCount,
}: HarvestSummaryCardsProps) {
  const cards = [
    {
      label: 'Trees Harvested',
      value: treesHarvested,
    },
    {
      label: 'Total Bunches',
      value: totalBunches,
    },
    {
      label: 'ODK Submissions',
      value: submissionCount,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-gray-200 bg-white px-4 py-6 sm:px-6 sm:py-8"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-gray-600 sm:text-sm">
            {card.label}
          </div>
          <div className="mt-2 text-4xl font-bold text-gray-900 sm:mt-3 sm:text-5xl">
            {formatIndianNumber(card.value)}
          </div>
        </div>
      ))}
    </div>
  )
}
