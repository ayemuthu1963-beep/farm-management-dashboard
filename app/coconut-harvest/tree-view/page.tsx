import { TreeViewClient } from "@/components/coconut/tree-view-client"
import { treeNumbers as mockTreeNumbers } from "@/lib/coconut-harvest-data"
import { fetchTreeNumbers } from "@/lib/coconut-harvest-api"

export default async function TreeViewPage() {
  let initialTreeOptions = mockTreeNumbers.map(String)

  try {
    const treeNumbers = await fetchTreeNumbers("", 25)

    initialTreeOptions = treeNumbers.length > 0 ? treeNumbers : initialTreeOptions
  } catch {
    // Keep approved mock dropdown options if the real API is unavailable.
  }

  return (
    <TreeViewClient
      initialTreeNo=""
      initialTreeOptions={initialTreeOptions}
      initialTreeHistory={[]}
      initialDataStatus="idle"
    />
  )
}
