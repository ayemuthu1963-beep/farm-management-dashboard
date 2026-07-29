export function LocalEnvironmentBanner() {
  if (process.env.NEXT_PUBLIC_MFMS_ENV !== "local") return null

  return (
    <div className="sticky top-0 z-[100] border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-black uppercase tracking-wide text-amber-950 shadow-sm">
      LOCAL TEST — DATA WILL NOT GO TO SERVER
      <span className="ml-3 normal-case tracking-normal">Database: mfms_local_test</span>
    </div>
  )
}
