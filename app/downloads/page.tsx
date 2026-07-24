export default function DownloadsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-green-200 bg-white p-8 shadow-lg">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-green-700">Download</h1>
            <p className="mt-2 text-gray-600">MFMS Coconut Counting Mobile UI</p>
          </div>

          {/* Download Card */}
          <div className="rounded-lg border-2 border-green-300 bg-green-50 p-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="text-5xl">📦</div>
              <div>
                <h2 className="text-2xl font-bold text-green-700">
                  MFMS_Coconut_Counting_Mobile_UI_Approved.zip
                </h2>
                <p className="text-sm text-gray-600">170 KB | Production Ready</p>
              </div>
            </div>

            {/* File Contents */}
            <div className="mb-6 rounded-lg bg-white p-4">
              <h3 className="mb-3 font-semibold text-gray-900">Package Contents:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>✓ 14 React/TypeScript components</li>
                <li>✓ 2 supporting files (types.ts, mock-data.ts)</li>
                <li>✓ 1 app entry point (page.tsx)</li>
                <li>✓ 4 documentation guides</li>
                <li>✓ 3 approved screenshots</li>
                <li>✓ Total: 23 files</li>
              </ul>
            </div>

            {/* Download Button */}
            <a
              href="/downloads/MFMS_Coconut_Counting_Mobile_UI_Approved.zip"
              download
              className="block w-full rounded-lg bg-green-600 px-6 py-4 text-center font-bold text-white hover:bg-green-700 transition-colors"
            >
              ⬇️ Download ZIP (170 KB)
            </a>

            {/* File Info */}
            <div className="mt-6 rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
              <p className="font-mono">
                SHA256: 541606e8df18521615ea04faabfe10cde3035c659cbd74c50dd4a6f39493c15f
              </p>
            </div>
          </div>

          {/* Quick Start */}
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
            <h3 className="mb-4 font-bold text-blue-900">Quick Start:</h3>
            <ol className="space-y-2 text-sm text-blue-900">
              <li>1. Extract the ZIP file</li>
              <li>2. Copy components to your project</li>
              <li>3. Read the documentation guides</li>
              <li>4. Follow the Codex handoff integration steps</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
