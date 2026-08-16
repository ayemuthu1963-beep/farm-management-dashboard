import type { CapacitorConfig } from "@capacitor/cli"

const PREVIEW_URL = "https://preview.muthufarms.com"
const PRODUCTION_URL = "https://muthufarms.com"
const ALLOWED_HOSTS = new Set([
  "preview.muthufarms.com",
  "muthufarms.com",
  "www.muthufarms.com",
])
const PRODUCTION_HOSTS = new Set(["muthufarms.com", "www.muthufarms.com"])

type MobileReleaseEnvironment = "preview" | "production"

function resolveMobileReleaseEnvironment(): MobileReleaseEnvironment {
  const environment = (process.env.MFMS_MOBILE_RELEASE_ENVIRONMENT || "preview")
    .trim()
    .toLowerCase()

  if (environment !== "preview" && environment !== "production") {
    throw new Error(
      "MFMS_MOBILE_RELEASE_ENVIRONMENT must be either preview or production.",
    )
  }

  return environment
}

function resolveMobileWebUrl(environment: MobileReleaseEnvironment): URL {
  const defaultUrl = environment === "production" ? PRODUCTION_URL : PREVIEW_URL
  const target = new URL(process.env.MOBILE_WEB_URL?.trim() || defaultUrl)

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

  if (environment === "production" && !PRODUCTION_HOSTS.has(target.hostname)) {
    throw new Error("A production mobile release must target the Production website.")
  }

  if (environment === "preview" && target.origin !== PREVIEW_URL) {
    throw new Error("A preview mobile release must target the Preview website.")
  }

  return target
}

const mobileReleaseEnvironment = resolveMobileReleaseEnvironment()
const mobileWebUrl = resolveMobileWebUrl(mobileReleaseEnvironment)
const navigationHosts = [mobileWebUrl.hostname, "auth.muthufarms.com"]
const androidOnlyBuild = process.env.MFMS_ANDROID_ONLY === "true"

if (PRODUCTION_HOSTS.has(mobileWebUrl.hostname)) {
  navigationHosts.push("muthufarms.com", "www.muthufarms.com")
}

const config: CapacitorConfig = {
  appId: "com.muthufarms.app",
  appName: "Muthu Farms",
  webDir: "mobile-web",
  appendUserAgent: ` MuthuFarmsMobile/${process.env.MFMS_ANDROID_VERSION_NAME?.trim() || "1.0.0"}`,
  backgroundColor: "#eaf6df",
  loggingBehavior: mobileReleaseEnvironment === "production" ? "none" : "debug",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: androidOnlyBuild ? undefined : {
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
