'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { formatIndianNumber } from '@/lib/harvest-live-counter-mock'

interface TargetControlProps {
  currentTarget: number
  onSave?: (newTarget: number) => void
}

export function TargetControl({ currentTarget, onSave }: TargetControlProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [newTarget, setNewTarget] = useState(currentTarget.toString())

  const handleSave = () => {
    const value = parseInt(newTarget, 10)
    if (!isNaN(value) && value > 0) {
      onSave?.(value)
      setIsEditing(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex items-start gap-3 mb-4">
        <Lock className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 sm:text-base">
            Supervisor Target Control
          </h3>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            This panel is for supervisors only
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-700 sm:text-sm">
            Current Target
          </label>
          <div className="mt-1 text-lg font-semibold text-gray-900 sm:text-2xl">
            {formatIndianNumber(currentTarget)} nuts
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-2">
            <input
              type="number"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new target"
            />
            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setNewTarget(currentTarget.toString())
                setIsEditing(false)
              }}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit Target
          </button>
        )}
      </div>
    </div>
  )
}
