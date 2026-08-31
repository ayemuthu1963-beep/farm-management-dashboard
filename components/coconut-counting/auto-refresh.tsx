"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"

import {
  createCoconutCountingRefreshController,
  type CoconutCountingRefreshController,
  type CoconutCountingRefreshEnvironment,
} from "@/lib/coconut-counting-refresh"

interface CoconutCountingRefreshContextValue {
  setCloseInProgress(inProgress: boolean): void
}

const CoconutCountingRefreshContext =
  createContext<CoconutCountingRefreshContextValue | null>(null)

export function useCoconutCountingRefresh() {
  const value = useContext(CoconutCountingRefreshContext)
  if (!value) {
    throw new Error("Coconut Counting refresh provider is missing")
  }
  return value
}

function browserRefreshEnvironment(): CoconutCountingRefreshEnvironment {
  return {
    now: () => Date.now(),
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (handle) => window.clearTimeout(handle),
    isVisible: () => document.visibilityState === "visible",
    isOnline: () => navigator.onLine,
    onVisibilityChange(callback) {
      document.addEventListener("visibilitychange", callback)
      return () => document.removeEventListener("visibilitychange", callback)
    },
    onOnline(callback) {
      window.addEventListener("online", callback)
      return () => window.removeEventListener("online", callback)
    },
  }
}

export function CoconutCountingRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [refreshPending, startRefreshTransition] = useTransition()
  const controllerRef = useRef<CoconutCountingRefreshController | null>(null)
  const transitionObservedRef = useRef(false)
  const resolveRefreshRef = useRef<(() => void) | null>(null)

  const requestRouterRefresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        transitionObservedRef.current = false
        resolveRefreshRef.current = resolve
        startRefreshTransition(() => router.refresh())
      }),
    [router],
  )

  useEffect(() => {
    if (refreshPending) {
      transitionObservedRef.current = true
      return
    }
    if (!transitionObservedRef.current) return
    transitionObservedRef.current = false
    const resolve = resolveRefreshRef.current
    resolveRefreshRef.current = null
    resolve?.()
  }, [refreshPending])

  useEffect(() => {
    const controller = createCoconutCountingRefreshController({
      environment: browserRefreshEnvironment(),
      refresh: requestRouterRefresh,
      onRefreshError: (error) => {
        console.error("[coconut-counting] automatic refresh failed", error)
      },
    })
    controllerRef.current = controller
    controller.start()
    return () => {
      controller.stop()
      controllerRef.current = null
      resolveRefreshRef.current?.()
      resolveRefreshRef.current = null
    }
  }, [requestRouterRefresh])

  const setCloseInProgress = useCallback((inProgress: boolean) => {
    controllerRef.current?.setCloseInProgress(inProgress)
  }, [])

  return (
    <CoconutCountingRefreshContext.Provider value={{ setCloseInProgress }}>
      {children}
    </CoconutCountingRefreshContext.Provider>
  )
}
