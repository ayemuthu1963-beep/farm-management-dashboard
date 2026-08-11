import { WorkerManagementClient } from "@/components/worker-management/worker-management-client"

export const metadata = {
  title: "Worker Management | Muthu Farms",
  description: "Local worker, wage, settlement and loan records for Muthu Farms.",
}

export default function WorkerManagementPage() {
  return <WorkerManagementClient />
}
