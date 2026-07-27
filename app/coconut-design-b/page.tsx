import { SharedHeader, SharedFooter } from '@/components/coconut-designs/shared-header'

export default function DesignB() {
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-sm bg-white">
        <SharedHeader />

        {/* Design B: Main Total First - Lower Section */}
        <div className="px-4 py-4 space-y-3 flex-1">
          {/* Total nuts Harvested - Prominent, Full Width */}
          <div className="bg-gradient-to-br from-green-600 via-teal-500 to-green-500 rounded-2xl p-6 text-white shadow-lg">
            <div className="text-sm font-semibold text-green-100 mb-3">TOTAL NUTS HARVESTED</div>
            <input
              type="text"
              value="5338"
              className="w-full text-center text-5xl font-extrabold bg-white bg-opacity-15 border-2 border-white border-opacity-50 rounded-lg px-4 py-3 text-white placeholder-gray-200"
            />
            <div className="text-xs text-green-100 mt-2 text-center">Primary editable field</div>
          </div>

          {/* Row 1: A counter | B counter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl border-2 border-green-200 p-5 text-center hover:shadow-md transition">
              <div className="text-xs font-bold text-green-600 uppercase tracking-wide mb-3">A counter</div>
              <div className="text-4xl font-bold text-green-700">1250</div>
              <div className="text-xs text-gray-500 mt-2">read-only</div>
            </div>
            <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5 text-center hover:shadow-md transition">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">B counter</div>
              <div className="text-4xl font-bold text-blue-700">2000</div>
              <div className="text-xs text-gray-500 mt-2">read-only</div>
            </div>
          </div>

          {/* Row 2: A1 counter | B1 counter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl border-2 border-green-200 p-5 text-center hover:shadow-md transition">
              <div className="text-xs font-bold text-green-600 uppercase tracking-wide mb-3">A1 counter</div>
              <div className="text-4xl font-bold text-green-700">0</div>
              <div className="text-xs text-gray-500 mt-2">read-only</div>
            </div>
            <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5 text-center hover:shadow-md transition">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">B1 counter</div>
              <div className="text-4xl font-bold text-blue-700">0</div>
              <div className="text-xs text-gray-500 mt-2">read-only</div>
            </div>
          </div>

          {/* B2 counter - Full Width */}
          <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5 text-center hover:shadow-md transition">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">B2 counter</div>
            <div className="text-4xl font-bold text-blue-700">0</div>
            <div className="text-xs text-gray-500 mt-2">read-only</div>
          </div>
        </div>

        <SharedFooter />
      </div>
    </div>
  )
}
