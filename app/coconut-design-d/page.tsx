import { SharedHeader, SharedFooter } from '@/components/coconut-designs/shared-header'

export default function DesignD() {
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-sm bg-white">
        <SharedHeader />

        {/* Design D: Grouped by Grade - Lower Section */}
        <div className="px-4 py-4 space-y-3 flex-1">
          {/* Total nuts Harvested - Full Width */}
          <div className="bg-gradient-to-r from-green-500 via-teal-500 to-blue-500 rounded-xl p-4 text-white shadow-md">
            <div className="text-xs font-semibold text-white mb-2 opacity-90">TOTAL NUTS HARVESTED</div>
            <input
              type="text"
              value="5338"
              className="w-full text-center text-4xl font-extrabold bg-white bg-opacity-20 border-2 border-white rounded px-3 py-2 text-white placeholder-gray-200"
            />
            <div className="text-xs text-white mt-1 text-center opacity-90">Primary editable field</div>
          </div>

          {/* Green Grade A Group */}
          <div className="bg-green-50 rounded-xl border-2 border-green-200 p-4 space-y-2">
            <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">Grade A Counters</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-lg border border-green-300 p-3 text-center">
                <div className="text-xs font-semibold text-gray-600 mb-1">A counter</div>
                <div className="text-3xl font-bold text-green-700">1250</div>
              </div>
              <div className="bg-white rounded-lg border border-green-300 p-3 text-center">
                <div className="text-xs font-semibold text-gray-600 mb-1">A1 counter</div>
                <div className="text-3xl font-bold text-green-700">0</div>
              </div>
            </div>
          </div>

          {/* Blue Grade B Group */}
          <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4 space-y-2">
            <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Grade B Counters</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-lg border border-blue-300 p-3 text-center">
                <div className="text-xs font-semibold text-gray-600 mb-1">B counter</div>
                <div className="text-3xl font-bold text-blue-700">2000</div>
              </div>
              <div className="bg-white rounded-lg border border-blue-300 p-3 text-center">
                <div className="text-xs font-semibold text-gray-600 mb-1">B1 counter</div>
                <div className="text-3xl font-bold text-blue-700">0</div>
              </div>
            </div>
            
            {/* B2 in Grade B Group - Full Width */}
            <div className="bg-white rounded-lg border border-blue-300 p-3 text-center">
              <div className="text-xs font-semibold text-gray-600 mb-1">B2 counter</div>
              <div className="text-3xl font-bold text-blue-700">0</div>
            </div>
          </div>
        </div>

        <SharedFooter />
      </div>
    </div>
  )
}
