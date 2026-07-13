import { TreeViewClient } from "@/components/coconut/tree-view-client"
import { fetchTreeNumbers } from "@/lib/coconut-harvest-api"

export default async function TreeViewPage() {
  let initialTreeOptions: string[] = []

  try {
    const treeNumbers = await fetchTreeNumbers("", 25)

    initialTreeOptions = treeNumbers
  } catch {
    initialTreeOptions = []
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
