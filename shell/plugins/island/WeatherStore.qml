import QtQuick
import Quickshell
import Quickshell.Io
import "WeatherModel.js" as WeatherModel

Item {
  id: root

  readonly property string home: Quickshell.env("HOME")
  readonly property string stateHome: Quickshell.env("XDG_STATE_HOME") || (home + "/.local/state")
  readonly property string cacheHome: Quickshell.env("XDG_CACHE_HOME") || (home + "/.cache")
  readonly property string stateDirectory: stateHome + "/omarchy/luinbytes.island"
  readonly property string cacheDirectory: cacheHome + "/omarchy/luinbytes.island"
  readonly property string preferencesPath: stateDirectory + "/weather.json"
  readonly property string cachePath: cacheDirectory + "/weather.json"
  readonly property string nativeLocationPath: home + "/.local/state/omarchy/settings/weather.json"
  readonly property int staleAfterMs: 45 * 60 * 1000

  property bool _directoriesReady: false
  property bool _preferencesLoaded: false
  property bool _cacheLoaded: false
  property bool _loadedStateApplied: false
  property var _preferences: WeatherModel.defaultPreferences()
  property var _cachedForecast: null
  property var _forecast: null
  property var _location: null
  property var _searchResults: []
  property var _nativeLocationCandidate: null
  property bool _refreshing: false
  property bool _searching: false
  property double _nowMs: Date.now()

  property string _preferencesLoadError: ""
  property string _cacheLoadError: ""
  property string _preferencesSaveError: ""
  property string _cacheSaveError: ""
  property string _requestError: ""
  property string _searchError: ""
  property bool _cacheWriteBlocked: false

  property bool _preferencesDirty: false
  property bool _preferencesSaving: false
  property bool _cacheDirty: false
  property bool _cacheSaving: false
  property int _preferencesSaveRetries: 0
  property int _cacheSaveRetries: 0

  property int _requestGeneration: 0
  property int _searchGeneration: 0
  property var _activeAutomaticRequest: null
  property var _pendingAutomaticRequest: null
  property var _activeForecastRequest: null
  property var _pendingForecastRequest: null
  property var _activeSearchRequest: null
  property var _pendingSearchRequest: null
  property string _automaticOutput: ""
  property string _automaticErrorOutput: ""
  property string _forecastOutput: ""
  property string _forecastErrorOutput: ""
  property string _searchOutput: ""
  property string _searchErrorOutput: ""
  property bool _automaticStreamFinished: false
  property bool _automaticExited: false
  property int _automaticExitCode: -1
  property bool _forecastStreamFinished: false
  property bool _forecastExited: false
  property int _forecastExitCode: -1
  property bool _searchStreamFinished: false
  property bool _searchExited: false
  property int _searchExitCode: -1

  readonly property bool initialized: _directoriesReady && _preferencesLoaded && _cacheLoaded && _loadedStateApplied
  readonly property string unit: _preferences.unit || "system"
  readonly property string resolvedUnit: WeatherModel.resolveUnit(unit, Qt.locale().name)
  readonly property string mode: _preferences.mode || "unset"
  readonly property var _presented: initialized && _forecast
    ? WeatherModel.presentForecast(_forecast, unit, Qt.locale().name) : null
  readonly property var location: _presented ? _presented.location : _location
  readonly property var current: _presented ? _presented.current : null
  readonly property var hourly: _presented ? _presented.hourly : []
  readonly property double fetchedAt: _presented ? _presented.fetchedAt : 0
  readonly property bool ready: initialized && current !== null
  readonly property string icon: WeatherModel.iconForCode(current ? current.weatherCode : -1,
    current ? current.isDay : true)
  readonly property bool refreshing: _refreshing
  readonly property bool searching: _searching
  readonly property var searchResults: _searchResults
  readonly property var nativeLocationCandidate: _nativeLocationCandidate
  readonly property string searchError: _searchError
  readonly property string error: _preferencesLoadError || _cacheLoadError || _preferencesSaveError
    || _cacheSaveError || _requestError
  readonly property string status: !initialized
    ? ((_preferencesLoadError || _cacheLoadError) ? "error" : "loading")
    : WeatherModel.statusFor(mode, _refreshing, _forecast, _nowMs, error, staleAfterMs)
  readonly property string ageLabel: WeatherModel.ageLabel(fetchedAt, _nowMs)
  readonly property var snapshot: ({
    ready: ready,
    initialized: initialized,
    status: status,
    mode: mode,
    location: location,
    current: current,
    icon: icon,
    hourly: hourly,
    fetchedAt: fetchedAt,
    error: error,
    saveFailed: _preferencesSaveError !== "" || _cacheSaveError !== "",
    searchResults: searchResults,
    searching: searching,
    searchError: searchError,
    refreshing: refreshing,
    unit: unit,
    resolvedUnit: resolvedUnit,
    temperatureUnit: _presented ? _presented.temperatureUnit : (resolvedUnit === "imperial" ? "°F" : "°C"),
    windUnit: _presented ? _presented.windUnit : (resolvedUnit === "imperial" ? "mph" : "km/h"),
    ageLabel: ageLabel,
    nativeLocationCandidate: nativeLocationCandidate
  })

  function nextRequestGeneration() {
    _requestGeneration = _requestGeneration >= 2147483646 ? 1 : _requestGeneration + 1
    return _requestGeneration
  }

  function nextSearchGeneration() {
    _searchGeneration = _searchGeneration >= 2147483646 ? 1 : _searchGeneration + 1
    return _searchGeneration
  }

  function curlCommand(url, timeoutSeconds) {
    return [
      "curl", "-fsS", "--location", "--proto", "=https", "--proto-redir", "=https",
      "--max-filesize", "1048576",
      "--connect-timeout", "3", "--max-time", String(timeoutSeconds), url
    ]
  }

  function fileError(label, error) {
    return label + " failed: " + FileViewError.toString(error)
  }

  function loadPreferences(raw) {
    if (_preferencesLoaded) return
    var result = WeatherModel.parsePreferences(raw)
    _preferences = result.value
    _preferencesLoadError = result.ok ? "" : result.error
    _preferencesLoaded = true
    applyLoadedState()
  }

  function failPreferencesLoad(error) {
    if (_preferencesLoaded) return
    if (error === FileViewError.FileNotFound) {
      loadPreferences("")
      return
    }
    _preferences = WeatherModel.defaultPreferences()
    _preferencesLoadError = fileError("weather preferences load", error)
    _preferencesLoaded = true
    applyLoadedState()
  }

  function loadCache(raw) {
    if (_cacheLoaded) return
    var result = WeatherModel.parseCache(raw)
    _cachedForecast = result.forecast
    _cacheLoadError = result.ok ? "" : result.error
    _cacheWriteBlocked = false
    _cacheLoaded = true
    applyLoadedState()
  }

  function failCacheLoad(error) {
    if (_cacheLoaded) return
    if (error === FileViewError.FileNotFound) {
      loadCache("")
      return
    }
    _cachedForecast = null
    _cacheLoadError = fileError("weather cache load", error)
    _cacheWriteBlocked = true
    _cacheLoaded = true
    applyLoadedState()
  }

  function applyLoadedState() {
    if (_loadedStateApplied || !_preferencesLoaded || !_cacheLoaded) return
    var selected = null
    if (_preferences.mode === "manual") selected = _preferences.manualLocation
    else if (_preferences.mode === "automatic" && _cachedForecast && _cachedForecast.location.mode === "automatic") selected = _cachedForecast.location
    _location = selected
    if (_cachedForecast && selected && _cachedForecast.location.key === selected.key) _forecast = _cachedForecast
    _loadedStateApplied = true
    if (!_preferencesLoadError && !_cacheLoadError && _preferences.mode !== "unset") {
      Qt.callLater(function() { if (root.initialized) root.refresh() })
    }
  }

  function queuePreferencesSave() {
    if (!_preferencesLoaded || !_directoriesReady || _preferencesLoadError) return false
    _preferencesDirty = true
    _preferencesSaveRetries = 0
    if (!_preferencesSaving) preferencesSaveTimer.restart()
    return true
  }

  function flushPreferences() {
    if (!_preferencesDirty || _preferencesSaving || !_preferencesLoaded || !_directoriesReady
      || _preferencesLoadError) return
    var text = WeatherModel.stringifyPreferences(_preferences)
    if (!text) {
      _preferencesSaveError = "weather preferences could not be serialized"
      return
    }
    _preferencesDirty = false
    _preferencesSaving = true
    preferencesFile.setText(text)
  }

  function queueCacheSave() {
    if (!_cacheLoaded || !_directoriesReady || _cacheWriteBlocked || !_forecast) return false
    _cacheDirty = true
    _cacheSaveRetries = 0
    if (!_cacheSaving) cacheSaveTimer.restart()
    return true
  }

  function flushCache() {
    if (!_cacheDirty || _cacheSaving || !_cacheLoaded || !_directoriesReady
      || _cacheWriteBlocked || !_forecast) return
    var text = WeatherModel.stringifyCache(_forecast)
    if (!text) {
      _cacheSaveError = "weather cache could not be serialized"
      return
    }
    _cacheDirty = false
    _cacheSaving = true
    cacheFile.setText(text)
  }

  function retrySaves() {
    _preferencesSaveRetries = 0
    _cacheSaveRetries = 0
    if (_preferencesDirty && !_preferencesSaving) preferencesSaveTimer.restart()
    if (_cacheDirty && !_cacheSaving) cacheSaveTimer.restart()
  }

  function setUnit(nextUnit) {
    var normalized = WeatherModel.normalizeUnit(nextUnit)
    if (!initialized || _preferencesLoadError || !normalized) return false
    if (normalized === _preferences.unit) return true
    _preferences = {
      version: _preferences.version,
      mode: _preferences.mode,
      unit: normalized,
      manualLocation: _preferences.manualLocation
    }
    _preferencesSaveError = ""
    queuePreferencesSave()
    return true
  }

  function chooseLocation(result) {
    var locationResult = WeatherModel.normalizeLocation(result, "manual")
    if (!initialized || _preferencesLoadError || !locationResult) return false
    var generation = nextRequestGeneration()
    nextSearchGeneration()
    _pendingSearchRequest = null
    _preferences = {
      version: _preferences.version,
      mode: "manual",
      unit: _preferences.unit,
      manualLocation: locationResult
    }
    _location = locationResult
    _forecast = null
    _requestError = ""
    _searchError = ""
    _searchResults = []
    _searching = false
    queuePreferencesSave()
    queueForecast({ generation: generation, location: locationResult })
    return true
  }

  function enableAutomatic() {
    if (!initialized || _preferencesLoadError) return false
    var generation = nextRequestGeneration()
    nextSearchGeneration()
    _pendingSearchRequest = null
    _searchResults = []
    _searching = false
    _preferences = {
      version: _preferences.version,
      mode: "automatic",
      unit: _preferences.unit,
      manualLocation: _preferences.manualLocation
    }
    _location = _forecast && _forecast.location.mode === "automatic" ? _forecast.location : null
    if (_forecast && _forecast.location.mode !== "automatic") _forecast = null
    _requestError = ""
    queuePreferencesSave()
    queueAutomatic({ generation: generation })
    return true
  }

  function disable() {
    if (!initialized || _preferencesLoadError) return false
    nextRequestGeneration()
    nextSearchGeneration()
    _pendingAutomaticRequest = null
    _pendingForecastRequest = null
    _pendingSearchRequest = null
    automaticProcess.running = false
    forecastProcess.running = false
    searchProcess.running = false
    _preferences = {
      version: _preferences.version,
      mode: "unset",
      unit: _preferences.unit,
      manualLocation: _preferences.manualLocation
    }
    _location = null
    _forecast = null
    _searchResults = []
    _refreshing = false
    _searching = false
    _requestError = ""
    _searchError = ""
    _preferencesSaveError = ""
    queuePreferencesSave()
    return true
  }

  function refresh() {
    if (!initialized || _preferencesLoadError) return false
    var generation = nextRequestGeneration()
    _requestError = ""
    if (_preferences.mode === "automatic") {
      queueAutomatic({ generation: generation })
      return true
    }
    if (_preferences.mode === "manual" && _preferences.manualLocation) {
      _location = _preferences.manualLocation
      queueForecast({ generation: generation, location: _preferences.manualLocation })
      return true
    }
    return false
  }

  function search(query) {
    if (!initialized) return false
    var url = WeatherModel.geocodingUrl(query)
    var generation = nextSearchGeneration()
    _searchError = ""
    if (!url) {
      _searchResults = []
      _searching = false
      _pendingSearchRequest = null
      return false
    }
    queueSearch({ generation: generation, url: url })
    return true
  }

  function queueAutomatic(request) {
    _refreshing = true
    if (automaticProcess.running || _activeAutomaticRequest) {
      _pendingAutomaticRequest = request
      return
    }
    startAutomatic(request)
  }

  function startAutomatic(request) {
    _activeAutomaticRequest = request
    _automaticOutput = ""
    _automaticErrorOutput = ""
    _automaticStreamFinished = false
    _automaticExited = false
    _automaticExitCode = -1
    automaticProcess.command = curlCommand("https://wttr.in/?format=j1", 8)
    automaticProcess.running = true
  }

  function completeAutomaticIfReady() {
    if (!_automaticStreamFinished || !_automaticExited || !_activeAutomaticRequest) return
    var request = _activeAutomaticRequest
    if (request.generation === _requestGeneration && _preferences.mode === "automatic") {
      if (_automaticExitCode !== 0) {
        _requestError = "automatic location request failed"
      } else if (_automaticOutput === "") {
        _requestError = "automatic location returned no data"
      } else {
        var result = WeatherModel.parseAutomaticLocationResponse(_automaticOutput)
        if (!result.ok) {
          _requestError = result.error
        } else {
          if (_forecast && _forecast.location.key !== result.location.key) _forecast = null
          _location = result.location
          queueForecast({ generation: request.generation, location: result.location })
        }
      }
    }
    _activeAutomaticRequest = null
    if (_pendingAutomaticRequest) {
      var pending = _pendingAutomaticRequest
      _pendingAutomaticRequest = null
      startAutomatic(pending)
    } else if (!_activeForecastRequest && !_pendingForecastRequest) {
      _refreshing = false
    }
  }

  function markAutomaticExited(exitCode) {
    _automaticExitCode = exitCode
    _automaticExited = true
    completeAutomaticIfReady()
  }

  function markAutomaticStreamFinished() {
    _automaticStreamFinished = true
    completeAutomaticIfReady()
  }

  function queueForecast(request) {
    _refreshing = true
    if (forecastProcess.running || _activeForecastRequest) {
      _pendingForecastRequest = request
      return
    }
    startForecast(request)
  }

  function startForecast(request) {
    var url = WeatherModel.forecastUrl(request.location)
    if (!url) {
      _requestError = "forecast location is invalid"
      _refreshing = false
      return
    }
    _activeForecastRequest = request
    _forecastOutput = ""
    _forecastErrorOutput = ""
    _forecastStreamFinished = false
    _forecastExited = false
    _forecastExitCode = -1
    forecastProcess.command = curlCommand(url, 10)
    forecastProcess.running = true
  }

  function completeForecastIfReady() {
    if (!_forecastStreamFinished || !_forecastExited || !_activeForecastRequest) return
    var request = _activeForecastRequest
    if (request.generation === _requestGeneration && _location && request.location.key === _location.key) {
      if (_forecastExitCode !== 0) {
        _requestError = "forecast request failed"
      } else if (_forecastOutput === "") {
        _requestError = "forecast returned no data"
      } else {
        var result = WeatherModel.parseForecastResponse(_forecastOutput, request.location, Date.now())
        if (!result.ok) {
          _requestError = result.error
        } else {
          _forecast = result.forecast
          _location = result.forecast.location
          _nowMs = result.forecast.fetchedAt
          _requestError = ""
          _cacheSaveError = ""
          if (!_cacheWriteBlocked) _cacheLoadError = ""
          queueCacheSave()
        }
      }
    }
    _activeForecastRequest = null
    if (_pendingForecastRequest) {
      var pending = _pendingForecastRequest
      _pendingForecastRequest = null
      startForecast(pending)
    } else if (!_activeAutomaticRequest && !_pendingAutomaticRequest) {
      _refreshing = false
    }
  }

  function markForecastExited(exitCode) {
    _forecastExitCode = exitCode
    _forecastExited = true
    completeForecastIfReady()
  }

  function markForecastStreamFinished() {
    _forecastStreamFinished = true
    completeForecastIfReady()
  }

  function queueSearch(request) {
    _searching = true
    if (searchProcess.running || _activeSearchRequest) {
      _pendingSearchRequest = request
      return
    }
    startSearch(request)
  }

  function startSearch(request) {
    _activeSearchRequest = request
    _searchOutput = ""
    _searchErrorOutput = ""
    _searchStreamFinished = false
    _searchExited = false
    _searchExitCode = -1
    searchProcess.command = curlCommand(request.url, 8)
    searchProcess.running = true
  }

  function completeSearchIfReady() {
    if (!_searchStreamFinished || !_searchExited || !_activeSearchRequest) return
    var request = _activeSearchRequest
    if (request.generation === _searchGeneration) {
      if (_searchExitCode !== 0) {
        _searchResults = []
        _searchError = "location search failed"
      } else if (_searchOutput === "") {
        _searchResults = []
        _searchError = "location search returned no data"
      } else {
        var result = WeatherModel.parseGeocodingResponse(_searchOutput)
        _searchResults = result.results
        _searchError = result.ok ? "" : result.error
      }
    }
    _activeSearchRequest = null
    if (_pendingSearchRequest) {
      var pending = _pendingSearchRequest
      _pendingSearchRequest = null
      startSearch(pending)
    } else {
      _searching = false
    }
  }

  function markSearchExited(exitCode) {
    _searchExitCode = exitCode
    _searchExited = true
    completeSearchIfReady()
  }

  function markSearchStreamFinished() {
    _searchStreamFinished = true
    completeSearchIfReady()
  }

  Process {
    id: ensureDirectoriesProcess
    command: ["mkdir", "-p", "-m", "700", root.stateDirectory, root.cacheDirectory]
    onExited: function(exitCode, exitStatus) {
      if (exitCode !== 0) {
        root._preferencesLoadError = "weather storage directories could not be created"
        root._cacheLoadError = root._preferencesLoadError
        return
      }
      root._directoriesReady = true
      Qt.callLater(function() {
        preferencesFile.reload()
        cacheFile.reload()
        nativeLocationFile.reload()
      })
    }
  }

  FileView {
    id: preferencesFile
    path: root._directoriesReady ? root.preferencesPath : ""
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onLoaded: root.loadPreferences(text())
    onLoadFailed: function(error) { root.failPreferencesLoad(error) }
    onSaved: {
      root._preferencesSaving = false
      root._preferencesSaveRetries = 0
      root._preferencesSaveError = ""
      if (root._preferencesDirty) preferencesSaveTimer.restart()
    }
    onSaveFailed: function(error) {
      root._preferencesSaving = false
      root._preferencesDirty = true
      root._preferencesSaveError = root.fileError("weather preferences save", error)
      if (root._preferencesSaveRetries < 3) {
        root._preferencesSaveRetries += 1
        preferencesSaveTimer.restart()
      }
    }
  }

  FileView {
    id: cacheFile
    path: root._directoriesReady ? root.cachePath : ""
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onLoaded: root.loadCache(text())
    onLoadFailed: function(error) { root.failCacheLoad(error) }
    onSaved: {
      root._cacheSaving = false
      root._cacheSaveRetries = 0
      root._cacheSaveError = ""
      if (root._cacheDirty) cacheSaveTimer.restart()
    }
    onSaveFailed: function(error) {
      root._cacheSaving = false
      root._cacheDirty = true
      root._cacheSaveError = root.fileError("weather cache save", error)
      if (root._cacheSaveRetries < 3) {
        root._cacheSaveRetries += 1
        cacheSaveTimer.restart()
      }
    }
  }

  FileView {
    id: nativeLocationFile
    path: root.nativeLocationPath
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root._nativeLocationCandidate = WeatherModel.parseNativeLocation(text())
    onLoadFailed: root._nativeLocationCandidate = null
  }

  Timer {
    id: preferencesSaveTimer
    interval: 150 * Math.pow(2, root._preferencesSaveRetries)
    repeat: false
    onTriggered: root.flushPreferences()
  }

  Timer {
    id: cacheSaveTimer
    interval: 150 * Math.pow(2, root._cacheSaveRetries)
    repeat: false
    onTriggered: root.flushCache()
  }

  Timer {
    interval: 60000
    repeat: true
    running: root.initialized
    onTriggered: root._nowMs = Date.now()
  }

  Timer {
    interval: 30 * 60 * 1000
    repeat: true
    running: root.initialized && root.mode !== "unset"
    onTriggered: root.refresh()
  }

  Process {
    id: automaticProcess
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root._automaticOutput = String(text || "")
        root.markAutomaticStreamFinished()
      }
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._automaticErrorOutput = String(text || "")
    }
    onExited: function(exitCode, exitStatus) { root.markAutomaticExited(exitCode) }
  }

  Process {
    id: forecastProcess
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root._forecastOutput = String(text || "")
        root.markForecastStreamFinished()
      }
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._forecastErrorOutput = String(text || "")
    }
    onExited: function(exitCode, exitStatus) { root.markForecastExited(exitCode) }
  }

  Process {
    id: searchProcess
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root._searchOutput = String(text || "")
        root.markSearchStreamFinished()
      }
    }
    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._searchErrorOutput = String(text || "")
    }
    onExited: function(exitCode, exitStatus) { root.markSearchExited(exitCode) }
  }

  Component.onCompleted: ensureDirectoriesProcess.running = true
}
