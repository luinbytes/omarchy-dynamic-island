var PREFERENCES_VERSION = 1
var CACHE_VERSION = 1
var MAX_SEARCH_RESULTS = 6
var MAX_HOURLY = 24
var MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER || 9007199254740991

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
}

function plainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false
  if (typeof Object.getPrototypeOf !== "function") return true
  var prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function finite(value) {
  return typeof value === "number" && isFinite(value)
}

function integer(value) {
  return finite(value) && Math.floor(value) === value
}

function timestamp(value) {
  return integer(value) && value >= 0 && value <= MAX_TIMESTAMP
}

function cleanText(value, maximum, allowEmpty) {
  if (typeof value !== "string") return null
  var result = value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim()
  if ((!allowEmpty && result === "") || result.length > maximum) return null
  return result
}

function rejectUnknown(value, allowed) {
  var keys = Object.keys(value)
  for (var index = 0; index < keys.length; index++) {
    if (!own(allowed, keys[index])) return false
  }
  return true
}

function coordinate(value, minimum, maximum) {
  var number = typeof value === "string" && value.trim() !== "" ? Number(value) : value
  return finite(number) && number >= minimum && number <= maximum ? number : null
}

function rounded(value) {
  return Math.round(value * 10) / 10
}

function locationKey(mode, latitude, longitude) {
  return mode + ":" + latitude.toFixed(5) + "," + longitude.toFixed(5)
}

function normalizeLocation(raw, expectedMode) {
  if (!plainObject(raw)) return null
  var mode = raw.mode === "automatic" ? "automatic" : raw.mode === "manual" ? "manual" : expectedMode
  if (mode !== "automatic" && mode !== "manual") return null
  if (expectedMode && mode !== expectedMode) return null
  var name = cleanText(raw.name, 160, false)
  var latitude = coordinate(raw.latitude, -90, 90)
  var longitude = coordinate(raw.longitude, -180, 180)
  var timezone = raw.timezone === undefined || raw.timezone === null || raw.timezone === ""
    ? "" : cleanText(raw.timezone, 80, false)
  if (name === null || latitude === null || longitude === null || timezone === null) return null
  return {
    mode: mode,
    name: name,
    latitude: latitude,
    longitude: longitude,
    timezone: timezone,
    key: locationKey(mode, latitude, longitude)
  }
}

function defaultPreferences() {
  return { version: PREFERENCES_VERSION, mode: "unset", unit: "system", manualLocation: null }
}

function normalizeUnit(value) {
  return value === "metric" || value === "imperial" || value === "system" ? value : null
}

function normalizeMode(value) {
  return value === "unset" || value === "automatic" || value === "manual" ? value : null
}

function parsePreferences(raw) {
  var source = String(raw || "").trim()
  if (source === "") return { ok: true, value: defaultPreferences(), error: "" }
  var parsed
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    return { ok: false, value: defaultPreferences(), error: "weather preferences are not valid JSON" }
  }
  var allowed = { version: true, mode: true, unit: true, manualLocation: true }
  if (!plainObject(parsed) || !rejectUnknown(parsed, allowed) || parsed.version !== PREFERENCES_VERSION) {
    return { ok: false, value: defaultPreferences(), error: "weather preferences have an unsupported shape" }
  }
  var mode = normalizeMode(parsed.mode)
  var unit = normalizeUnit(parsed.unit)
  var manual = parsed.manualLocation === null || parsed.manualLocation === undefined
    ? null : normalizeLocation(parsed.manualLocation, "manual")
  if (mode === null || unit === null || (parsed.manualLocation !== null && parsed.manualLocation !== undefined && !manual)) {
    return { ok: false, value: defaultPreferences(), error: "weather preferences contain invalid values" }
  }
  if (mode === "manual" && !manual) {
    return { ok: false, value: defaultPreferences(), error: "manual weather mode needs a location" }
  }
  return {
    ok: true,
    value: { version: PREFERENCES_VERSION, mode: mode, unit: unit, manualLocation: manual },
    error: ""
  }
}

function stringifyPreferences(preferences) {
  var parsed = parsePreferences(JSON.stringify(preferences || {}))
  return parsed.ok ? JSON.stringify(parsed.value, null, 2) + "\n" : ""
}

function parseNativeLocation(raw) {
  var source = String(raw || "").trim()
  if (source === "") return null
  try {
    var parsed = JSON.parse(source)
    return normalizeLocation({
      mode: "manual",
      name: parsed && parsed.name,
      latitude: parsed && parsed.latitude,
      longitude: parsed && parsed.longitude,
      timezone: parsed && parsed.timezone
    }, "manual")
  } catch (error) {
    return null
  }
}

function parseGeocodingResponse(raw) {
  var parsed
  try {
    parsed = JSON.parse(String(raw || ""))
  } catch (error) {
    return { ok: false, results: [], error: "location search returned invalid data" }
  }
  if (!plainObject(parsed) || (parsed.results !== undefined && !Array.isArray(parsed.results))) {
    return { ok: false, results: [], error: "location search returned an unsupported response" }
  }
  var source = Array.isArray(parsed.results) ? parsed.results : []
  var results = []
  var seen = {}
  for (var index = 0; index < source.length && results.length < MAX_SEARCH_RESULTS; index++) {
    var item = source[index]
    if (!plainObject(item)) continue
    var name = cleanText(item.name, 100, false)
    var latitude = coordinate(item.latitude, -90, 90)
    var longitude = coordinate(item.longitude, -180, 180)
    if (name === null || latitude === null || longitude === null) continue
    var admin = cleanText(item.admin1, 100, true) || ""
    var country = cleanText(item.country, 100, true) || ""
    var timezone = cleanText(item.timezone, 80, true) || ""
    var description = [admin, country].filter(function(part) { return part !== "" }).join(", ")
    var location = normalizeLocation({
      mode: "manual",
      name: description ? name + ", " + description : name,
      latitude: latitude,
      longitude: longitude,
      timezone: timezone
    }, "manual")
    if (!location || own(seen, location.key)) continue
    seen[location.key] = true
    results.push(location)
  }
  return { ok: true, results: results, error: "" }
}

function firstValue(value) {
  if (Array.isArray(value) && value.length > 0) {
    var row = value[0]
    if (plainObject(row) && typeof row.value === "string") return row.value
    return row
  }
  return value
}

function parseAutomaticLocationResponse(raw) {
  var parsed
  try {
    parsed = JSON.parse(String(raw || ""))
  } catch (error) {
    return { ok: false, location: null, error: "automatic location returned invalid data" }
  }
  var area = parsed && Array.isArray(parsed.nearest_area) ? parsed.nearest_area[0] : null
  if (!plainObject(area)) return { ok: false, location: null, error: "automatic location was unavailable" }
  var city = cleanText(String(firstValue(area.areaName) || ""), 100, false)
  var region = cleanText(String(firstValue(area.region) || ""), 100, true) || ""
  var country = cleanText(String(firstValue(area.country) || ""), 100, true) || ""
  var suffix = [region, country].filter(function(part) { return part !== "" }).join(", ")
  var location = normalizeLocation({
    mode: "automatic",
    name: city && suffix ? city + ", " + suffix : city,
    latitude: area.latitude,
    longitude: area.longitude,
    timezone: ""
  }, "automatic")
  return location
    ? { ok: true, location: location, error: "" }
    : { ok: false, location: null, error: "automatic location did not include usable coordinates" }
}

function numeric(value, minimum, maximum) {
  return finite(value) && value >= minimum && value <= maximum ? value : null
}

function normalizeCurrent(raw) {
  if (!plainObject(raw)) return null
  var time = cleanText(raw.time, 40, false)
  var temperature = numeric(raw.temperature, -120, 80)
  var feelsLike = numeric(raw.feelsLike, -120, 80)
  var high = raw.high === null || raw.high === undefined ? null : numeric(raw.high, -120, 80)
  var low = raw.low === null || raw.low === undefined ? null : numeric(raw.low, -120, 80)
  var humidity = raw.humidity === null || raw.humidity === undefined ? null : numeric(raw.humidity, 0, 100)
  var windSpeed = raw.windSpeed === null || raw.windSpeed === undefined ? null : numeric(raw.windSpeed, 0, 500)
  var weatherCode = numeric(raw.weatherCode, 0, 99)
  var isDay = raw.isDay === true || raw.isDay === 1
  var hasValidDay = raw.isDay === true || raw.isDay === false || raw.isDay === 1 || raw.isDay === 0
  if (time === null || temperature === null || feelsLike === null || weatherCode === null
    || !integer(weatherCode) || !hasValidDay) return null
  if ((raw.high !== null && raw.high !== undefined && high === null)
    || (raw.low !== null && raw.low !== undefined && low === null)
    || (raw.humidity !== null && raw.humidity !== undefined && humidity === null)
    || (raw.windSpeed !== null && raw.windSpeed !== undefined && windSpeed === null)) return null
  return {
    time: time,
    temperature: temperature,
    feelsLike: feelsLike,
    high: high,
    low: low,
    humidity: humidity,
    windSpeed: windSpeed,
    weatherCode: Math.round(weatherCode),
    isDay: isDay
  }
}

function normalizeHour(raw) {
  if (!plainObject(raw)) return null
  var time = cleanText(raw.time, 40, false)
  var temperature = numeric(raw.temperature, -120, 80)
  var weatherCode = numeric(raw.weatherCode, 0, 99)
  var isDay = raw.isDay === true || raw.isDay === 1
  var hasValidDay = raw.isDay === true || raw.isDay === false || raw.isDay === 1 || raw.isDay === 0
  var precipitationProbability = raw.precipitationProbability === null || raw.precipitationProbability === undefined
    ? null : numeric(raw.precipitationProbability, 0, 100)
  if (time === null || temperature === null || weatherCode === null || !integer(weatherCode) || !hasValidDay
    || (raw.precipitationProbability !== null && raw.precipitationProbability !== undefined && precipitationProbability === null)) return null
  return {
    time: time,
    temperature: temperature,
    weatherCode: Math.round(weatherCode),
    isDay: isDay,
    precipitationProbability: precipitationProbability === null ? null : Math.round(precipitationProbability)
  }
}

function normalizeForecast(raw) {
  if (!plainObject(raw)) return null
  var location = normalizeLocation(raw.location)
  var current = normalizeCurrent(raw.current)
  var fetchedAt = raw.fetchedAt
  var timezone = cleanText(raw.timezone || "", 80, true)
  if (!location || !current || !timestamp(fetchedAt) || timezone === null || !Array.isArray(raw.hourly)) return null
  var hourly = []
  for (var index = 0; index < raw.hourly.length && hourly.length < MAX_HOURLY; index++) {
    var hour = normalizeHour(raw.hourly[index])
    if (!hour) return null
    hourly.push(hour)
  }
  if (hourly.length === 0) return null
  return {
    location: location,
    current: current,
    hourly: hourly,
    fetchedAt: fetchedAt,
    timezone: timezone
  }
}

function parseForecastResponse(raw, rawLocation, fetchedAt) {
  var location = normalizeLocation(rawLocation)
  if (!location || !timestamp(fetchedAt)) return { ok: false, forecast: null, error: "forecast request context is invalid" }
  var parsed
  try {
    parsed = JSON.parse(String(raw || ""))
  } catch (error) {
    return { ok: false, forecast: null, error: "forecast returned invalid data" }
  }
  var currentSource = parsed && parsed.current
  var hourlySource = parsed && parsed.hourly
  if (!plainObject(currentSource) || !plainObject(hourlySource)
    || !Array.isArray(hourlySource.time) || !Array.isArray(hourlySource.temperature_2m)
    || !Array.isArray(hourlySource.weather_code) || !Array.isArray(hourlySource.is_day)) {
    return { ok: false, forecast: null, error: "forecast response is missing current or hourly data" }
  }
  var currentTime = cleanText(currentSource.time, 40, false)
  var temperature = numeric(currentSource.temperature_2m, -120, 80)
  var apparent = numeric(currentSource.apparent_temperature, -120, 80)
  var code = numeric(currentSource.weather_code, 0, 99)
  var hasValidCurrentDay = currentSource.is_day === true || currentSource.is_day === false
    || currentSource.is_day === 1 || currentSource.is_day === 0
  if (currentTime === null || temperature === null || apparent === null || code === null
    || !integer(code) || !hasValidCurrentDay) {
    return { ok: false, forecast: null, error: "forecast current conditions are invalid" }
  }
  var daily = parsed.daily
  var high = daily && Array.isArray(daily.temperature_2m_max) ? numeric(daily.temperature_2m_max[0], -120, 80) : null
  var low = daily && Array.isArray(daily.temperature_2m_min) ? numeric(daily.temperature_2m_min[0], -120, 80) : null
  var current = {
    time: currentTime,
    temperature: temperature,
    feelsLike: apparent,
    high: high,
    low: low,
    humidity: numeric(currentSource.relative_humidity_2m, 0, 100),
    windSpeed: numeric(currentSource.wind_speed_10m, 0, 500),
    weatherCode: Math.round(code),
    isDay: currentSource.is_day === 1 || currentSource.is_day === true
  }
  var precipitation = Array.isArray(hourlySource.precipitation_probability) ? hourlySource.precipitation_probability : []
  var dayValues = Array.isArray(hourlySource.is_day) ? hourlySource.is_day : []
  var start = -1
  for (var timeIndex = 0; timeIndex < hourlySource.time.length; timeIndex++) {
    if (String(hourlySource.time[timeIndex]) >= currentTime) {
      start = timeIndex
      break
    }
  }
  if (start < 0) {
    return { ok: false, forecast: null, error: "forecast response did not contain upcoming hours" }
  }
  var hourly = []
  for (var index = start; index < hourlySource.time.length && hourly.length < MAX_HOURLY; index++) {
    var hour = normalizeHour({
      time: hourlySource.time[index],
      temperature: hourlySource.temperature_2m[index],
      weatherCode: hourlySource.weather_code[index],
      isDay: dayValues.length > index ? dayValues[index] : null,
      precipitationProbability: precipitation.length > index ? precipitation[index] : null
    })
    if (!hour) return { ok: false, forecast: null, error: "forecast hourly data is invalid" }
    hourly.push(hour)
  }
  var forecast = normalizeForecast({
    location: location,
    current: current,
    hourly: hourly,
    fetchedAt: fetchedAt,
    timezone: cleanText(parsed.timezone || "", 80, true) || ""
  })
  return forecast
    ? { ok: true, forecast: forecast, error: "" }
    : { ok: false, forecast: null, error: "forecast response did not contain upcoming hours" }
}

function parseCache(raw) {
  var source = String(raw || "").trim()
  if (source === "") return { ok: true, forecast: null, error: "" }
  var parsed
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    return { ok: false, forecast: null, error: "weather cache is not valid JSON" }
  }
  if (!plainObject(parsed) || parsed.version !== CACHE_VERSION || !rejectUnknown(parsed, { version: true, forecast: true })) {
    return { ok: false, forecast: null, error: "weather cache has an unsupported shape" }
  }
  var forecast = normalizeForecast(parsed.forecast)
  if (forecast && forecast.fetchedAt > Date.now() + 5 * 60 * 1000) {
    return { ok: false, forecast: null, error: "weather cache timestamp is in the future" }
  }
  return forecast
    ? { ok: true, forecast: forecast, error: "" }
    : { ok: false, forecast: null, error: "weather cache contains invalid values" }
}

function stringifyCache(forecast) {
  var normalized = normalizeForecast(forecast)
  return normalized ? JSON.stringify({ version: CACHE_VERSION, forecast: normalized }, null, 2) + "\n" : ""
}

function resolveUnit(unit, localeName) {
  if (unit === "metric" || unit === "imperial") return unit
  var locale = String(localeName || "").replace(".", "_")
  return /^en[_-](US|LR)($|[_.-])/.test(locale) || /^my($|[_.-])/.test(locale) ? "imperial" : "metric"
}

function convertTemperature(value, unit) {
  return rounded(unit === "imperial" ? value * 9 / 5 + 32 : value)
}

function presentForecast(rawForecast, unit, localeName) {
  var forecast = normalizeForecast(rawForecast)
  if (!forecast) return null
  var resolved = resolveUnit(unit, localeName)
  var current = forecast.current
  var presentedCurrent = {
    time: current.time,
    temperature: convertTemperature(current.temperature, resolved),
    feelsLike: convertTemperature(current.feelsLike, resolved),
    high: current.high === null ? null : convertTemperature(current.high, resolved),
    low: current.low === null ? null : convertTemperature(current.low, resolved),
    humidity: current.humidity,
    windSpeed: current.windSpeed === null ? null : rounded(resolved === "imperial" ? current.windSpeed * 0.621371 : current.windSpeed),
    weatherCode: current.weatherCode,
    isDay: current.isDay
  }
  var hourly = forecast.hourly.map(function(hour) {
    return {
      time: hour.time,
      temperature: convertTemperature(hour.temperature, resolved),
      weatherCode: hour.weatherCode,
      isDay: hour.isDay,
      precipitationProbability: hour.precipitationProbability
    }
  })
  return {
    location: forecast.location,
    current: presentedCurrent,
    hourly: hourly,
    fetchedAt: forecast.fetchedAt,
    timezone: forecast.timezone,
    resolvedUnit: resolved,
    temperatureUnit: resolved === "imperial" ? "°F" : "°C",
    windUnit: resolved === "imperial" ? "mph" : "km/h"
  }
}

function conditionLabel(code) {
  var value = Math.round(Number(code))
  if (value === 0) return "Clear"
  if (value === 1 || value === 2) return "Partly cloudy"
  if (value === 3) return "Cloudy"
  if (value === 45 || value === 48) return "Fog"
  if (value >= 51 && value <= 57) return "Drizzle"
  if ((value >= 61 && value <= 67) || (value >= 80 && value <= 82)) return "Rain"
  if ((value >= 71 && value <= 77) || value === 85 || value === 86) return "Snow"
  if (value >= 95) return "Thunderstorm"
  return "Conditions unavailable"
}

function iconForCode(code, isDay) {
  var value = Math.round(Number(code))
  if (value === 0) return isDay === false ? "" : ""
  if (value === 1 || value === 2) return isDay === false ? "" : ""
  if (value === 3) return ""
  if (value === 45 || value === 48) return isDay === false ? "" : ""
  if (value >= 51 && value <= 57) return ""
  if ((value >= 61 && value <= 67) || (value >= 80 && value <= 82)) return ""
  if ((value >= 71 && value <= 77) || value === 85 || value === 86) return ""
  if (value >= 95) return ""
  return ""
}

function statusFor(mode, loading, forecast, nowMs, error, staleAfterMs) {
  var normalized = normalizeForecast(forecast)
  var now = timestamp(nowMs) ? nowMs : 0
  var staleAfter = finite(staleAfterMs) && staleAfterMs > 0 ? staleAfterMs : 2700000
  if (normalized) {
    if (error || now - normalized.fetchedAt > staleAfter) return "stale"
    return "ready"
  }
  if (loading) return "loading"
  if (mode === "unset") return "unconfigured"
  return error ? "error" : "loading"
}

function ageLabel(fetchedAt, nowMs) {
  if (!timestamp(fetchedAt) || !timestamp(nowMs) || nowMs < fetchedAt) return ""
  var minutes = Math.floor((nowMs - fetchedAt) / 60000)
  if (minutes < 1) return "Updated now"
  if (minutes < 60) return "Updated " + minutes + "m ago"
  var hours = Math.floor(minutes / 60)
  if (hours < 24) return "Updated " + hours + "h ago"
  return "Updated " + Math.floor(hours / 24) + "d ago"
}

function geocodingUrl(query) {
  var text = cleanText(query, 120, false)
  return text === null ? "" : "https://geocoding-api.open-meteo.com/v1/search?name="
    + encodeURIComponent(text) + "&count=" + MAX_SEARCH_RESULTS + "&language=en&format=json"
}

function forecastUrl(rawLocation) {
  var location = normalizeLocation(rawLocation)
  if (!location) return ""
  return "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(String(location.latitude))
    + "&longitude=" + encodeURIComponent(String(location.longitude))
    + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day"
    + "&hourly=temperature_2m,weather_code,precipitation_probability,is_day"
    + "&daily=temperature_2m_max,temperature_2m_min"
    + "&temperature_unit=celsius&wind_speed_unit=kmh"
    + "&forecast_days=2&timezone=auto"
}

if (typeof module !== "undefined") {
  module.exports = {
    MAX_HOURLY: MAX_HOURLY,
    defaultPreferences: defaultPreferences,
    normalizeLocation: normalizeLocation,
    normalizeUnit: normalizeUnit,
    parsePreferences: parsePreferences,
    stringifyPreferences: stringifyPreferences,
    parseNativeLocation: parseNativeLocation,
    parseGeocodingResponse: parseGeocodingResponse,
    parseAutomaticLocationResponse: parseAutomaticLocationResponse,
    parseForecastResponse: parseForecastResponse,
    parseCache: parseCache,
    stringifyCache: stringifyCache,
    resolveUnit: resolveUnit,
    presentForecast: presentForecast,
    conditionLabel: conditionLabel,
    iconForCode: iconForCode,
    statusFor: statusFor,
    ageLabel: ageLabel,
    geocodingUrl: geocodingUrl,
    forecastUrl: forecastUrl
  }
}
