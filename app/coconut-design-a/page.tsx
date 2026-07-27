import { SharedHeader, SharedFooter } from '@/components/coconut-designs/shared-header'

export default function DesignA() {
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-sm bg-white">
        <SharedHeader />

        {/* Design A: Balanced Grid - Lower Section */}
        <div className="px-4 py-4 space-y-3 flex-1">
          {/* Row 1: A counter | B counter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
              <div className="text-xs font-semibold text-gray-600 mb-2">A counter</div>
              <div className="text-3xl font-bold text-green-700">1250</div>
              <div className="text-xs text-gray-500 mt-1">read-only</div>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
              <div className="text-xs font-semibold text-gray-600 mb-2">B counter</div>
              <div className="text-3xl font-bold text-blue-700">2000</div>
              <div className="text-xs text-gray-500 mt-1">read-only</div>
            </div>
          </div>

          {/* Total nuts Harvested - Full Width */}
          <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-lg p-4 text-white">
            <div className="text-xs font-semibold text-green-100 mb-2">Total nuts Harvested</div>
            <input
              type="text"
              value="5338"
              className="w-full text-center text-4xl font-bold bg-white bg-opacity-20 border-2 border-white rounded px-3 py-2 text-white placeholder-gray-300"
            />
            <div className="text-xs text-green-100 mt-1">editable field</div>
          </div>

          {/* Row 2: A1 counter | B1 counter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
              <div className="text-xs font-semibold text-gray-600 mb-2">A1 counter</div>
              <div className="text-3xl font-bold text-green-700">0</div>
              <div className="text-xs text-gray-500 mt-1">read-only</div>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center">
              <div className="text-xs font-semibold text-gray-600 mb-2">B1 counter</div>
              <div className="text-3xl font-bold text-blue-700">0</div>
              <div className="text-xs text-gray-500 mt-1">read-only</div>
            </div>
          </div>

          {/* B2 counter - Centered */}
          <div className="flex justify-center">
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 text-center w-48">
              <div className="text-xs font-semibold text-gray-600 mb-2">B2 counter</div>
              <div className="text-3xl font-bold text-blue-700">0</div>
              <div className="text-xs text-gray-500 mt-1">read-only</div>
            </div>
          </div>
        </div>

        <SharedFooter />
      </div>
    </div>
  )
}
