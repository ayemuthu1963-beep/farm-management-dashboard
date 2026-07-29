import { TreeViewClient } from "@/components/coconut/tree-view-client"
import { fetchTreeNumbers, fetchTreeViewData } from "@/lib/coconut-harvest-api"
import type { TreeHarvestRow } from "@/lib/coconut-harvest-data"

interface TreeViewPageProps {
  searchParams: Promise<{
    treeNo?: string
  }>
}

export default async function TreeViewPage({ searchParams }: TreeViewPageProps) {
  const requestedTreeNo = (await searchParams).treeNo?.trim() ?? ""
  let initialTreeOptions: string[] = []
  let initialTreeHistory: TreeHarvestRow[] = []
  let initialDataStatus: "idle" | "real" | "empty" | "error" = requestedTreeNo ? "error" : "idle"

  try {
    const treeNumbers = await fetchTreeNumbers(requestedTreeNo, 25)

    initialTreeOptions = treeNumbers
  } catch {
    initialTreeOptions = []
  }

  if (requestedTreeNo) {
    try {
      const data = await fetchTreeViewData(requestedTreeNo)
      initialTreeHistory = data.treeHarvestHistory
      initialDataStatus = data.treeHarvestHistory.length > 0 ? "real" : "empty"
    } catch {
      initialDataStatus = "error"
    }
  }

  return (
    <TreeViewClient
      initialTreeNo={requestedTreeNo}
      initialTreeOptions={initialTreeOptions}
      initialTreeHistory={initialTreeHistory}
      initialDataStatus={initialDataStatus}
    />
  )
}
