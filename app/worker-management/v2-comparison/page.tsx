import { WorkerV2Comparison } from "@/components/worker-management/worker-v2-comparison"

export const dynamic = "force-dynamic"

export default function WorkerV2ComparisonPage() {
  const enabled = process.env.NEXT_PUBLIC_MFMS_WORKER_V2_ENABLED === "true"
  if (!enabled) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Worker Management V2 is disabled</h1>
        <p className="mt-3 text-slate-600">This isolated owner-testing page is available only in the approved Preview/UAT environment.</p>
      </main>
    )
  }
  return <WorkerV2Comparison />
}
