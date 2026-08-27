"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { pullWorkerSync, pushWorkerSync } from "@/lib/worker-management-api"
import {
  getWorkerOfflineSnapshot,
  syncWorkerOutbox,
  type WorkerOfflineSnapshot,
  type WorkerSyncRun,
} from "@/lib/worker-management-offline"

type WorkerOfflineContextValue = WorkerOfflineSnapshot & {
  online: boolean
  syncing: boolean
  serviceWorkerReady: boolean
  refreshStatus: () => Promise<WorkerOfflineSnapshot>
  syncNow: () => Promise<WorkerSyncRun>
}

const emptySnapshot: WorkerOfflineSnapshot = {
  waiting: 0,
  conflicts: 0,
  lastSync: null,
  cursor: 0,
  operations: [],
}

const WorkerOfflineContext = createContext<WorkerOfflineContextValue | null>(null)

export function WorkerOfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false)
  const [snapshot, setSnapshot] = useState<WorkerOfflineSnapshot>(emptySnapshot)

  const refreshStatus = useCallback(async () => {
    const next = await getWorkerOfflineSnapshot()
    setSnapshot(next)
    return next
  }, [])

  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {
      const result = await syncWorkerOutbox({
        online: typeof navigator !== "undefined" ? navigator.onLine : false,
        push: pushWorkerSync,
        pull: pullWorkerSync,
      })
      setSnapshot(result)
      return result
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    setOnline(navigator.onLine)
    void refreshStatus().catch(() => undefined)

    const handleOnline = () => {
      setOnline(true)
      void syncNow().catch(() => {
        void refreshStatus().catch(() => undefined)
      })
    }
    const handleOffline = () => setOnline(false)
    const handleStorageChange = () => void refreshStatus().catch(() => undefined)
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void syncNow().catch(() => {
          void refreshStatus().catch(() => undefined)
        })
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("mfms-worker-offline-change", handleStorageChange)
    document.addEventListener("visibilitychange", handleVisibility)

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker
        .register("/worker-management-sw.js", { scope: "/worker-management" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => setServiceWorkerReady(true))
        .catch(() => setServiceWorkerReady(false))
    }

    if (navigator.onLine) {
      void syncNow().catch(() => {
        void refreshStatus().catch(() => undefined)
      })
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("mfms-worker-offline-change", handleStorageChange)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [refreshStatus, syncNow])

  const value = useMemo(
    () => ({
      ...snapshot,
      online,
      syncing,
      serviceWorkerReady,
      refreshStatus,
      syncNow,
    }),
    [online, refreshStatus, serviceWorkerReady, snapshot, syncNow, syncing],
  )

  return <WorkerOfflineContext.Provider value={value}>{children}</WorkerOfflineContext.Provider>
}

export function useWorkerOffline(): WorkerOfflineContextValue {
  const value = useContext(WorkerOfflineContext)
  if (!value) throw new Error("useWorkerOffline must be used within WorkerOfflineProvider.")
  return value
}
