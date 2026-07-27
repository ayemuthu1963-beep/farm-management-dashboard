import { SharedHeader, SharedFooter } from '@/components/coconut-designs/shared-header'

export default function DesignC() {
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-sm bg-white">
        <SharedHeader />

        {/* Design C: Compact Dashboard - Lower Section */}
        <div className="px-3 py-3 space-y-2 flex-1">
          {/* Central Total - Large Card */}
          <div className="bg-gradient-to-br from-green-500 to-teal-400 rounded-2xl p-5 text-white text-center shadow-md">
            <div className="text-xs font-semibold text-green-100 mb-2">TOTAL NUTS HARVESTED</div>
            <div className="text-5xl font-extrabold mb-2">5338</div>
            <input
              type="text"
              value="5338"
              className="w-full text-center text-lg font-bold bg-white bg-opacity-20 border-2 border-white rounded px-2 py-1 text-white placeholder-gray-200"
            />
          </div>

          {/* Compact 5-Counter Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* A counter */}
            <div className="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
              <div className="text-xs font-semibold text-green-600 mb-1">A counter</div>
              <div className="text-2xl font-bold text-green-700">1250</div>
            </div>

            {/* B counter */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
              <div className="text-xs font-semibold text-blue-600 mb-1">B counter</div>
              <div className="text-2xl font-bold text-blue-700">2000</div>
            </div>

            {/* A1 counter */}
            <div className="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
              <div className="text-xs font-semibold text-green-600 mb-1">A1 counter</div>
              <div className="text-2xl font-bold text-green-700">0</div>
            </div>

            {/* B1 counter */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
              <div className="text-xs font-semibold text-blue-600 mb-1">B1 counter</div>
              <div className="text-2xl font-bold text-blue-700">0</div>
            </div>
          </div>

          {/* B2 counter - centered below */}
          <div className="flex justify-center">
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center w-40">
              <div className="text-xs font-semibold text-blue-600 mb-1">B2 counter</div>
              <div className="text-2xl font-bold text-blue-700">0</div>
            </div>
          </div>
        </div>

        <SharedFooter />
      </div>
    </div>
  )
}
