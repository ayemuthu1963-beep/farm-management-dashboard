import type { CapacitorConfig } from "@capacitor/cli"

const PREVIEW_URL = "https://preview.muthufarms.com"
const ALLOWED_HOSTS = new Set([
  "preview.muthufarms.com",
  "muthufarms.com",
  "www.muthufarms.com",
])
const PRODUCTION_HOSTS = new Set(["muthufarms.com", "www.muthufarms.com"])

function resolveMobileWebUrl(): URL {
  const target = new URL(process.env.MOBILE_WEB_URL?.trim() || PREVIEW_URL)

  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.port ||
    target.pathname !== "/" ||
    target.search ||
    target.hash ||
    !ALLOWED_HOSTS.has(target.hostname)
  ) {
    throw new Error(
      "MOBILE_WEB_URL must be the HTTPS origin for an approved Muthu Farms website.",
    )
  }

  if (
    PRODUCTION_HOSTS.has(target.hostname) &&
    process.env.ALLOW_PRODUCTION_MOBILE_TARGET !== "true"
  ) {
    throw new Error(
      "Production mobile targeting is blocked. Use Preview until explicit approval is recorded.",
    )
  }

  return target
}

const mobileWebUrl = resolveMobileWebUrl()
const navigationHosts = [mobileWebUrl.hostname, "auth.muthufarms.com"]

if (PRODUCTION_HOSTS.has(mobileWebUrl.hostname)) {
  navigationHosts.push("muthufarms.com", "www.muthufarms.com")
}

const config: CapacitorConfig = {
  appId: "com.muthufarms.app",
  appName: "Muthu Farms",
  webDir: "mobile-web",
  appendUserAgent: " MuthuFarmsMobile/1.0",
  backgroundColor: "#eaf6df",
  loggingBehavior: "debug",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    allowsLinkPreview: false,
    contentInset: "automatic",
    preferredContentMode: "mobile",
    webContentsDebuggingEnabled: false,
  },
  server: {
    url: mobileWebUrl.origin,
    cleartext: false,
    allowNavigation: [...new Set(navigationHosts)],
    errorPath: "offline.html",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#eaf6dfff",
      showSpinner: false,
    },
  },
}

export default config
