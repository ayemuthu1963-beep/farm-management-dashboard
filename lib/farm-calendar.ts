export const FARM_CALENDAR_ID = "admin.muthufarms@gmail.com"
export const FARM_CALENDAR_TIME_ZONE = "Asia/Kolkata"
export const FARM_CALENDAR_MONTH_ACCOUNT = FARM_CALENDAR_ID

function buildGoogleCalendarUrl(
  pathname: string,
  parameters: Record<string, string>,
) {
  const url = new URL(pathname, "https://calendar.google.com")

  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value)
  }

  return url.toString()
}

// This is Google's normal authenticated embed URL. It contains no secret iCal
// address, OAuth credential, token, or public-sharing shortcut; Google applies
// the signed-in viewer's existing private-calendar permissions.
export const FARM_CALENDAR_WEEKLY_EMBED_URL = buildGoogleCalendarUrl(
  "/calendar/embed",
  {
    src: FARM_CALENDAR_ID,
    ctz: FARM_CALENDAR_TIME_ZONE,
    mode: "WEEK",
    showTitle: "0",
    showCalendars: "0",
    showPrint: "0",
    showTabs: "0",
    showTz: "0",
  },
)

// The Google Calendar application is intentionally used for all writes. The
// calendar ID and signed-in account both point to the dedicated farm account,
// so the Month action does not open an authorized user's personal workspace.
export const FARM_CALENDAR_MONTH_URL = buildGoogleCalendarUrl(
  "/calendar/r/month",
  {
    cid: FARM_CALENDAR_ID,
    authuser: FARM_CALENDAR_MONTH_ACCOUNT,
  },
)
