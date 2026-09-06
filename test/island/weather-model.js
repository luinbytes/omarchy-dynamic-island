const assert = require("node:assert/strict")
const fs = require("node:fs")
const weather = require("../../shell/plugins/island/WeatherModel.js")

const location = weather.normalizeLocation({
  mode: "manual",
  name: "London, England, United Kingdom",
  latitude: 51.5072,
  longitude: -0.1276,
  timezone: "Europe/London"
}, "manual")

assert.ok(location, "valid manual coordinates normalize")
assert.equal(location.key, "manual:51.50720,-0.12760", "location identity is stable")
assert.equal(weather.normalizeLocation({ mode: "manual", name: "Nowhere", latitude: 91, longitude: 0 }, "manual"), null,
  "out-of-range coordinates are rejected")

assert.deepEqual(weather.parsePreferences("").value, weather.defaultPreferences(),
  "a missing preference file starts unconfigured")
assert.equal(weather.parsePreferences("{bad json").ok, false, "malformed preferences are rejected")
assert.equal(weather.parsePreferences(JSON.stringify({ version: 1, mode: "manual", unit: "metric", manualLocation: null })).ok, false,
  "manual mode requires a valid location")
const preferences = { version: 1, mode: "manual", unit: "metric", manualLocation: location }
assert.deepEqual(weather.parsePreferences(weather.stringifyPreferences(preferences)).value, preferences,
  "versioned preferences round trip")

assert.equal(weather.parseNativeLocation(JSON.stringify({ name: "London", latitude: 51.5, longitude: -0.12 })).name, "London",
  "the shared Omarchy location is accepted as a manual candidate")
assert.equal(weather.parseNativeLocation(JSON.stringify({ name: "London" })), null,
  "a shared name without coordinates never triggers implicit geocoding")

const geocoding = weather.parseGeocodingResponse(JSON.stringify({ results: [
  { name: "London", admin1: "England", country: "United Kingdom", latitude: 51.5072, longitude: -0.1276, timezone: "Europe/London" },
  { name: "London duplicate", latitude: 51.5072, longitude: -0.1276 },
  { name: "Invalid", latitude: 200, longitude: 0 }
] }))
assert.equal(geocoding.ok, true, "Open-Meteo search data parses")
assert.equal(geocoding.results.length, 1, "search results are validated and deduplicated")
assert.equal(geocoding.results[0].name, "London, England, United Kingdom", "search labels retain useful place context")

const automatic = weather.parseAutomaticLocationResponse(JSON.stringify({ nearest_area: [{
  areaName: [{ value: "London" }],
  region: [{ value: "England" }],
  country: [{ value: "United Kingdom" }],
  latitude: "51.50",
  longitude: "-0.12"
}] }))
assert.equal(automatic.ok, true, "opt-in IP location results normalize")
assert.equal(automatic.location.mode, "automatic", "automatic ownership remains explicit")

const start = Date.UTC(2026, 8, 5, 10)
const hourlyTimes = Array.from({ length: 30 }, (_, index) => new Date(start + index * 3600000).toISOString().slice(0, 16))
const response = {
  timezone: "Europe/London",
  current: {
    time: "2026-09-05T12:00",
    temperature_2m: 20.4,
    apparent_temperature: 19.6,
    relative_humidity_2m: 64,
    wind_speed_10m: 15,
    weather_code: 2,
    is_day: 1
  },
  hourly: {
    time: hourlyTimes,
    temperature_2m: hourlyTimes.map((_, index) => 18 + index / 10),
    weather_code: hourlyTimes.map(() => 2),
    is_day: hourlyTimes.map((_, index) => index > 0 && index < 13 ? 1 : 0),
    precipitation_probability: hourlyTimes.map((_, index) => index)
  },
  daily: {
    temperature_2m_max: [23.2],
    temperature_2m_min: [13.1]
  }
}
const fetchedAt = Date.now()
const parsedForecast = weather.parseForecastResponse(JSON.stringify(response), location, fetchedAt)
assert.equal(parsedForecast.ok, true, "current and hourly Open-Meteo data parse")
assert.equal(typeof parsedForecast.forecast.current.temperature, "number", "current.temperature stays numeric")
assert.equal(parsedForecast.forecast.hourly[0].time, "2026-09-05T12:00", "hourly presentation begins at the current hour")
assert.equal(typeof parsedForecast.forecast.hourly[0].isDay, "boolean", "hourly day and night state stays explicit")
assert.equal(parsedForecast.forecast.hourly.length, weather.MAX_HOURLY, "hourly data has a bounded presentation size")

const noFuture = JSON.parse(JSON.stringify(response))
noFuture.current.time = "2099-01-01T00:00"
assert.equal(weather.parseForecastResponse(JSON.stringify(noFuture), location, fetchedAt).ok, false,
  "a response with no upcoming hour is rejected instead of replaying past hours")

const cacheText = weather.stringifyCache(parsedForecast.forecast)
assert.equal(weather.parseCache(cacheText).ok, true, "validated last-good forecasts round trip through cache")
const futureCache = JSON.parse(cacheText)
futureCache.forecast.fetchedAt = Date.now() + 10 * 60 * 1000
assert.equal(weather.parseCache(JSON.stringify(futureCache)).ok, false, "implausibly future cache timestamps are rejected")
assert.equal(weather.parseCache("{bad json").ok, false, "corrupt caches never become live weather")

const imperial = weather.presentForecast(parsedForecast.forecast, "imperial", "en_US")
assert.equal(imperial.resolvedUnit, "imperial", "explicit imperial units win")
assert.equal(imperial.temperatureUnit, "°F", "presented units are exposed")
assert.equal(imperial.current.temperature, 68.7, "temperature conversion happens only at presentation")
assert.equal(weather.resolveUnit("system", "en_US"), "imperial", "US system units resolve to imperial")
assert.equal(weather.resolveUnit("system", "en_GB"), "metric", "other system units resolve to metric")

assert.equal(weather.statusFor("manual", false, parsedForecast.forecast, fetchedAt, "", 1000), "ready",
  "fresh cached weather is ready")
assert.equal(weather.statusFor("manual", false, parsedForecast.forecast, fetchedAt + 1001, "", 1000), "stale",
  "aged last-good weather is marked stale")
assert.equal(weather.statusFor("manual", false, parsedForecast.forecast, fetchedAt, "offline", 1000), "stale",
  "last-good weather remains visible during a refresh error")
assert.equal(weather.ageLabel(fetchedAt, fetchedAt + 2 * 60 * 60000), "Updated 2h ago", "update age is human readable")

assert.match(weather.geocodingUrl("New York"), /New%20York/, "manual city search encodes user input")
assert.match(weather.forecastUrl(location), /^https:\/\/api\.open-meteo\.com\//, "forecast requests stay on the selected provider")
assert.equal(weather.forecastUrl({ name: "missing coordinates" }), "", "invalid forecast locations do not form requests")

const storeSource = fs.readFileSync(require.resolve("../../shell/plugins/island/WeatherStore.qml"), "utf8")
assert.match(storeSource, /FileViewError\.FileNotFound/, "missing files are distinguished from load failures")
assert.match(storeSource, /atomicWrites: true/g, "weather preferences and cache use atomic FileView writes")
assert.match(storeSource, /onSaved:/, "successful asynchronous saves are observed")
assert.match(storeSource, /onSaveFailed:/, "failed asynchronous saves are surfaced")
assert.match(storeSource, /--max-filesize", "1048576"/, "provider responses are size bounded")
assert.match(storeSource, /--proto-redir", "=https"/, "curl redirects remain HTTPS-only")
assert.match(storeSource, /function completeForecastIfReady\(/, "forecast acceptance waits for stdout and process exit")
assert.match(storeSource, /_forecastExitCode !== 0/, "failed curl exits cannot publish payloads")
assert.match(storeSource, /_preferencesLoadError \|\| !locationResult/, "corrupt preferences block location changes and overwrite")
assert.match(storeSource, /command: \["mkdir", "-p", "-m", "700"/, "plugin weather storage is private")
assert.match(storeSource, /function disable\(\)/, "weather activity and automatic refresh can be revoked")
assert.match(storeSource, /automaticProcess\.running = false/, "revocation stops the store's automatic-location process")
assert.match(storeSource, /icon: icon/, "the snapshot exposes its real current-condition icon")

const panelSource = fs.readFileSync(require.resolve("../../shell/plugins/island/WeatherPanel.qml"), "utf8")
assert.match(panelSource, /required property var store/, "weather panel consumes the domain store")
assert.match(panelSource, /Use IP location|Use IP/, "automatic location is an explicit action")
assert.match(panelSource, /Stop weather/, "automatic refresh has a visible revocation path")
assert.match(panelSource, /opt-in and is sent to wttr\.in/, "automatic location discloses its provider boundary")
assert.match(panelSource, /Weather data © Open-Meteo/, "weather attribution remains visible")
assert.match(panelSource, /snapshot\.hourly/, "the panel renders a real hourly outlook")
assert.match(panelSource, /Style\.font\.family/, "the panel uses the system font")
assert.match(panelSource, /readonly property real preferredHeight:/, "weather height follows the active bounded content")
assert.match(panelSource, /property real headerRightInset: 32/, "weather reserves only its upper-right heading inset")
assert.match(panelSource, /readonly property int hoursPerPage: 4/, "hourly pages fit four tiles")
assert.match(panelSource, /readonly property int resultsPerPage: 3/, "location search is bounded to three rows")
assert.match(panelSource, /panelMode = "settings"/, "weather controls stay behind an explicit settings mode")
assert.match(panelSource, /readonly property int activeSearchPage:/, "search page bounds are derived without reactive writes")
assert.doesNotMatch(panelSource, /onSnapshotChanged:/, "snapshot evaluation never mutates pager state")
assert.doesNotMatch(panelSource, /property bool allowed:/, "page controls use their native enabled lifecycle")
assert.doesNotMatch(panelSource, /Qt\.callLater/, "weather focus work cannot outlive the panel")
assert.doesNotMatch(panelSource, /Flickable|ListView|ScrollView/, "weather has no scroll surface")

console.log("weather model, persistence boundary and panel contract assertions passed")
