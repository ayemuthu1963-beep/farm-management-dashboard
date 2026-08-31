export const COCONUT_COUNTING_REFRESH_INTERVAL_MS = 300000

type TimerHandle = number

export interface CoconutCountingRefreshEnvironment {
  now(): number
  setTimer(callback: () => void, delayMs: number): TimerHandle
  clearTimer(handle: TimerHandle): void
  isVisible(): boolean
  isOnline(): boolean
  onVisibilityChange(callback: () => void): () => void
  onOnline(callback: () => void): () => void
}

interface CoconutCountingRefreshControllerOptions {
  environment: CoconutCountingRefreshEnvironment
  refresh(): Promise<void> | void
  onRefreshError?(error: unknown): void
}

export interface CoconutCountingRefreshController {
  start(): void
  stop(): void
  setCloseInProgress(inProgress: boolean): void
}

export function createCoconutCountingRefreshController({
  environment,
  refresh,
  onRefreshError,
}: CoconutCountingRefreshControllerOptions): CoconutCountingRefreshController {
  let started = false
  let closeInProgress = false
  let refreshInProgress = false
  let refreshOverdue = false
  let timer: TimerHandle | null = null
  let lastRefreshStartedAt = environment.now()
  let removeVisibilityListener: (() => void) | null = null
  let removeOnlineListener: (() => void) | null = null

  function clearScheduledRefresh() {
    if (timer === null) return
    environment.clearTimer(timer)
    timer = null
  }

  function elapsedSinceRefresh() {
    return Math.max(0, environment.now() - lastRefreshStartedAt)
  }

  function scheduleNextRefresh() {
    clearScheduledRefresh()
    if (!started) return
    const delayMs = Math.max(
      0,
      COCONUT_COUNTING_REFRESH_INTERVAL_MS - elapsedSinceRefresh(),
    )
    timer = environment.setTimer(() => {
      timer = null
      requestRefreshIfDue()
    }, delayMs)
  }

  function shouldDeferRefresh() {
    return (
      closeInProgress ||
      refreshInProgress ||
      !environment.isVisible() ||
      !environment.isOnline()
    )
  }

  function requestRefreshIfDue() {
    if (!started) return
    if (elapsedSinceRefresh() < COCONUT_COUNTING_REFRESH_INTERVAL_MS) {
      scheduleNextRefresh()
      return
    }

    if (shouldDeferRefresh()) {
      refreshOverdue = true
      clearScheduledRefresh()
      return
    }

    refreshOverdue = false
    refreshInProgress = true
    lastRefreshStartedAt = environment.now()
    clearScheduledRefresh()

    Promise.resolve()
      .then(refresh)
      .catch((error) => onRefreshError?.(error))
      .finally(() => {
        refreshInProgress = false
        if (!started) return
        if (
          refreshOverdue ||
          elapsedSinceRefresh() >= COCONUT_COUNTING_REFRESH_INTERVAL_MS
        ) {
          requestRefreshIfDue()
          return
        }
        scheduleNextRefresh()
      })
  }

  function catchUpIfRequired() {
    if (!started) return
    if (elapsedSinceRefresh() >= COCONUT_COUNTING_REFRESH_INTERVAL_MS) {
      requestRefreshIfDue()
      return
    }
    scheduleNextRefresh()
  }

  return {
    start() {
      if (started) return
      started = true
      lastRefreshStartedAt = environment.now()
      removeVisibilityListener = environment.onVisibilityChange(catchUpIfRequired)
      removeOnlineListener = environment.onOnline(catchUpIfRequired)
      scheduleNextRefresh()
    },
    stop() {
      if (!started) return
      started = false
      clearScheduledRefresh()
      removeVisibilityListener?.()
      removeOnlineListener?.()
      removeVisibilityListener = null
      removeOnlineListener = null
    },
    setCloseInProgress(inProgress) {
      closeInProgress = inProgress
      if (!inProgress) catchUpIfRequired()
    },
  }
}
