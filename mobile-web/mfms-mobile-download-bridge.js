(() => {
  if (window.__muthuFarmsDownloadBridgeInstalled) return
  window.__muthuFarmsDownloadBridgeInstalled = true

  const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024
  const downloadPathPattern = /(?:\/export(?:\/|$)|\.(?:csv|xlsx?|pdf|zip)(?:$|[?#]))/i

  function shouldHandle(anchor) {
    const href = anchor.href || ""
    return (
      anchor.hasAttribute("download") ||
      href.startsWith("blob:") ||
      href.startsWith("data:") ||
      downloadPathPattern.test(href)
    )
  }

  function isTrustedDownloadUrl(value) {
    if (value.startsWith("blob:") || value.startsWith("data:")) return true
    try {
      const url = new URL(value, window.location.href)
      return url.protocol === "https:" && url.origin === window.location.origin
    } catch {
      return false
    }
  }

  function contentDispositionFileName(value) {
    if (!value) return ""
    const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)
    if (encoded) {
      try { return decodeURIComponent(encoded[1]) } catch { return encoded[1] }
    }
    return value.match(/filename="?([^";]+)"?/i)?.[1] || ""
  }

  function requestedFileName(anchor, response) {
    const disposition = response?.headers?.get("content-disposition") || ""
    const fromHeader = contentDispositionFileName(disposition)
    if (fromHeader) return fromHeader
    if (anchor.download) return anchor.download
    try {
      const candidate = new URL(anchor.href, window.location.href).pathname.split("/").pop()
      if (candidate) return decodeURIComponent(candidate)
    } catch {}
    return "muthu-farms-download"
  }

  function sendToNative(payload) {
    if (window.webkit?.messageHandlers?.mfmsDownload) {
      window.webkit.messageHandlers.mfmsDownload.postMessage(payload)
      return true
    }
    if (window.MuthuFarmsDownloads?.saveFile) {
      window.MuthuFarmsDownloads.saveFile(payload.fileName, payload.mimeType, payload.base64Data)
      return true
    }
    return false
  }

  function asBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error || new Error("Unable to read download"))
      reader.onload = () => resolve(String(reader.result || "").split(",", 2)[1] || "")
      reader.readAsDataURL(blob)
    })
  }

  document.addEventListener("click", async (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a") : null
    if (
      !anchor ||
      !shouldHandle(anchor) ||
      !isTrustedDownloadUrl(anchor.href || "") ||
      anchor.dataset.mfmsNativeDownload === "pending"
    ) return

    event.preventDefault()
    anchor.dataset.mfmsNativeDownload = "pending"

    try {
      const response = await fetch(anchor.href, { credentials: "include", redirect: "follow" })
      if (!response.ok) throw new Error(`Download returned HTTP ${response.status}`)
      const blob = await response.blob()
      if (blob.size > MAX_DOWNLOAD_BYTES) throw new Error("Download exceeds the 25 MB in-app export limit")
      const base64Data = await asBase64(blob)
      if (!sendToNative({
        fileName: requestedFileName(anchor, response),
        mimeType: blob.type || "application/octet-stream",
        base64Data,
      })) {
        throw new Error("Native download service is unavailable")
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The file could not be downloaded")
    } finally {
      delete anchor.dataset.mfmsNativeDownload
    }
  }, true)
})()
