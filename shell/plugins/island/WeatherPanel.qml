pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui as Ui
import "WeatherModel.js" as WeatherModel

Item {
  id: root

  required property var store
  property real headerRightInset: 32
  property string panelMode: "summary"
  property int hourPage: 0
  property int searchPage: 0
  readonly property int hoursPerPage: 4
  readonly property int resultsPerPage: 3
  readonly property var snapshot: store ? store.snapshot : ({ ready: false, initialized: false,
    status: "loading", mode: "unset", location: null, current: null, hourly: [], error: "",
    saveFailed: false, searching: false, searchResults: [], searchError: "", refreshing: false,
    unit: "system", temperatureUnit: "°C", windUnit: "km/h", ageLabel: "", nativeLocationCandidate: null })
  readonly property string activeMode: panelMode === "summary" && !snapshot.ready ? "setup" : panelMode
  readonly property int hourPageCount: Math.max(1, Math.ceil((snapshot.hourly || []).length / hoursPerPage))
  readonly property int activeHourPage: Math.max(0, Math.min(hourPageCount - 1, hourPage))
  readonly property var visibleHours: (snapshot.hourly || []).slice(activeHourPage * hoursPerPage, (activeHourPage + 1) * hoursPerPage)
  readonly property var locationChoices: root.makeLocationChoices()
  readonly property int searchPageCount: Math.max(1, Math.ceil(locationChoices.length / resultsPerPage))
  readonly property int activeSearchPage: Math.max(0, Math.min(searchPageCount - 1, searchPage))
  readonly property var visibleLocationChoices: locationChoices.slice(activeSearchPage * resultsPerPage,
    (activeSearchPage + 1) * resultsPerPage)
  readonly property real preferredHeight: Math.ceil(activeMode === "search" ? searchColumn.implicitHeight
    : activeMode === "settings" ? settingsColumn.implicitHeight
    : activeMode === "setup" ? setupColumn.implicitHeight : summaryColumn.implicitHeight)

  implicitWidth: 376
  implicitHeight: preferredHeight
  clip: true

  component PageGlyph: Rectangle {
    id: glyphButton
    required property string glyph
    signal invoked
    width: 24
    height: 24
    radius: 12
    color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, activeFocus ? 0.14 : 0.07)
    opacity: enabled ? 1 : 0.35
    activeFocusOnTab: enabled
    Accessible.role: Accessible.Button
    Accessible.name: glyph === "‹" ? "Previous page" : "Next page"
    Accessible.focusable: enabled
    Accessible.onPressAction: if (glyphButton.enabled) glyphButton.invoked()
    Keys.onReturnPressed: function(event) { if (glyphButton.enabled) glyphButton.invoked(); event.accepted = true }
    Keys.onEnterPressed: function(event) { if (glyphButton.enabled) glyphButton.invoked(); event.accepted = true }
    Keys.onSpacePressed: function(event) { if (glyphButton.enabled) glyphButton.invoked(); event.accepted = true }
    Text {
      anchors.centerIn: parent
      text: glyphButton.glyph
      textFormat: Text.PlainText
      color: Color.bar.text
      font.family: Style.font.family
      font.pixelSize: 15
    }
    MouseArea {
      anchors.fill: parent
      enabled: glyphButton.enabled
      cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
      onClicked: glyphButton.invoked()
    }
  }

  component Attribution: Text {
    width: parent ? parent.width : 0
    text: "Weather data © Open-Meteo · IP location by wttr.in"
    textFormat: Text.PlainText
    color: Color.muted
    opacity: 0.75
    font.family: Style.font.family
    font.pixelSize: 8
    elide: Text.ElideRight
  }

  function rounded(value) {
    return typeof value === "number" && isFinite(value) ? Math.round(value) : "—"
  }

  function hourLabel(value) {
    var time = String(value || "")
    return time.length >= 16 ? time.slice(11, 16) : time
  }

  function makeLocationChoices() {
    var choices = []
    if (snapshot.nativeLocationCandidate) choices.push({ location: snapshot.nativeLocationCandidate,
      label: "Saved · " + snapshot.nativeLocationCandidate.name })
    var results = snapshot.searchResults || []
    for (var index = 0; index < results.length; index++) choices.push({ location: results[index], label: results[index].name })
    return choices
  }

  function openSearch() {
    root.searchPage = 0
    root.panelMode = "search"
    searchFocusTimer.restart()
  }

  function startAutomatic() {
    if (store && store.enableAutomatic()) root.panelMode = "summary"
  }

  function choose(result) {
    if (store && store.chooseLocation(result)) {
      root.panelMode = "summary"
      root.searchPage = 0
      searchInput.text = ""
    }
  }

  function stopWeather() {
    if (store) store.disable()
    root.panelMode = "summary"
  }

  Timer {
    id: searchTimer
    interval: 350
    repeat: false
    onTriggered: if (root.store) root.store.search(searchInput.text)
  }

  Timer {
    id: searchFocusTimer
    interval: 0
    repeat: false
    onTriggered: if (root.activeMode === "search") searchInput.forceActiveFocus()
  }

  Column {
    id: summaryColumn
    width: root.width
    spacing: 6
    visible: root.activeMode === "summary"

    Item {
      width: parent.width
      height: 43
      Text {
        id: conditionIcon
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        width: 38
        text: WeatherModel.iconForCode(root.snapshot.current ? root.snapshot.current.weatherCode : -1,
          root.snapshot.current ? root.snapshot.current.isDay : true)
        textFormat: Text.PlainText
        color: Color.accent
        font.family: Style.font.family
        font.pixelSize: 30
        horizontalAlignment: Text.AlignHCenter
      }
      Column {
        anchors.left: conditionIcon.right
        anchors.leftMargin: 8
        anchors.right: settingsButton.left
        anchors.rightMargin: 8
        anchors.verticalCenter: parent.verticalCenter
        spacing: 1
        Text {
          width: parent.width
          text: root.snapshot.location ? root.snapshot.location.name : "Weather"
          textFormat: Text.PlainText
          color: Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 13
          font.weight: Font.DemiBold
          elide: Text.ElideRight
        }
        Text {
          width: parent.width
          text: WeatherModel.conditionLabel(root.snapshot.current ? root.snapshot.current.weatherCode : -1)
            + (root.snapshot.status === "stale" ? " · Stale" : "")
          textFormat: Text.PlainText
          color: root.snapshot.status === "stale" ? Color.accent : Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
          elide: Text.ElideRight
        }
      }
      Ui.Button {
        id: settingsButton
        anchors.right: parent.right
        anchors.rightMargin: root.headerRightInset
        anchors.verticalCenter: parent.verticalCenter
        text: "Settings"
        foreground: Color.bar.text
        fontSize: 9
        focusable: true
        onClicked: root.panelMode = "settings"
      }
    }

    Item {
      width: parent.width
      height: 42
      Text {
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        text: root.rounded(root.snapshot.current ? root.snapshot.current.temperature : null) + root.snapshot.temperatureUnit
        textFormat: Text.PlainText
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 31
        font.weight: Font.Light
      }
      Column {
        anchors.centerIn: parent
        spacing: 2
        Text {
          text: "Feels " + root.rounded(root.snapshot.current ? root.snapshot.current.feelsLike : null) + root.snapshot.temperatureUnit
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
        }
        Text {
          text: "H " + root.rounded(root.snapshot.current ? root.snapshot.current.high : null)
            + "°  L " + root.rounded(root.snapshot.current ? root.snapshot.current.low : null) + "°"
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
        }
      }
      Column {
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        spacing: 2
        Text {
          anchors.right: parent.right
          text: root.snapshot.current && root.snapshot.current.humidity !== null
            ? "Humidity " + root.rounded(root.snapshot.current.humidity) + "%" : ""
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
        }
        Text {
          anchors.right: parent.right
          text: root.snapshot.current && root.snapshot.current.windSpeed !== null
            ? "Wind " + root.rounded(root.snapshot.current.windSpeed) + " " + root.snapshot.windUnit : ""
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
        }
      }
    }

    Row {
      width: parent.width
      height: 66
      spacing: 6
      Repeater {
        model: root.hoursPerPage
        delegate: Rectangle {
          id: hourCard
          required property int index
          readonly property var modelData: root.visibleHours[index] || ({ time: "", weatherCode: -1,
            isDay: true, temperature: null, precipitationProbability: null })
          visible: index < root.visibleHours.length
          width: Math.floor((summaryColumn.width - 18) / 4)
          height: 66
          layer.enabled: true
          radius: 11
          color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, 0.055)
          Column {
            anchors.centerIn: parent
            width: parent.width - 8
            spacing: 1
            Text {
              width: parent.width
              text: root.hourLabel(hourCard.modelData.time)
              textFormat: Text.PlainText
              color: Color.muted
              font.family: Style.font.family
              font.pixelSize: 9
              horizontalAlignment: Text.AlignHCenter
              elide: Text.ElideRight
            }
            Text {
              width: parent.width
              text: WeatherModel.iconForCode(hourCard.modelData.weatherCode, hourCard.modelData.isDay)
              textFormat: Text.PlainText
              color: Color.bar.text
              font.family: Style.font.family
              font.pixelSize: 16
              horizontalAlignment: Text.AlignHCenter
            }
            Text {
              width: parent.width
              text: root.rounded(hourCard.modelData.temperature) + "°"
                + (hourCard.modelData.precipitationProbability !== null ? " · " + hourCard.modelData.precipitationProbability + "%" : "")
              textFormat: Text.PlainText
              color: Color.bar.text
              font.family: Style.font.family
              font.pixelSize: 9
              horizontalAlignment: Text.AlignHCenter
              elide: Text.ElideRight
            }
          }
        }
      }
    }

    Row {
      anchors.horizontalCenter: parent.horizontalCenter
      spacing: 8
      visible: root.hourPageCount > 1
      height: visible ? 24 : 0
      PageGlyph { glyph: "‹"; enabled: root.activeHourPage > 0; onInvoked: root.hourPage = root.activeHourPage - 1 }
      Text {
        anchors.verticalCenter: parent.verticalCenter
        text: (root.activeHourPage + 1) + " / " + root.hourPageCount
        textFormat: Text.PlainText
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 9
      }
      PageGlyph { glyph: "›"; enabled: root.activeHourPage + 1 < root.hourPageCount; onInvoked: root.hourPage = root.activeHourPage + 1 }
    }

    Text {
      width: parent.width
      text: root.snapshot.error || root.snapshot.ageLabel
      textFormat: Text.PlainText
      color: root.snapshot.error ? Color.accent : Color.muted
      font.family: Style.font.family
      font.pixelSize: 9
      elide: Text.ElideRight
      visible: text !== ""
    }
    Attribution {}
  }

  Column {
    id: setupColumn
    width: root.width
    spacing: 6
    visible: root.activeMode === "setup"
    Text {
      width: parent.width - root.headerRightInset
      text: root.snapshot.initialized ? "Choose your weather location" : "Loading weather"
      textFormat: Text.PlainText
      color: Color.bar.text
      font.family: Style.font.family
      font.pixelSize: 15
      font.weight: Font.DemiBold
      elide: Text.ElideRight
    }
    Text {
      width: parent.width
      text: root.snapshot.error || "Search for a city, or opt in to approximate IP location."
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      color: root.snapshot.error ? Color.accent : Color.muted
      font.family: Style.font.family
      font.pixelSize: 10
    }
    Row {
      spacing: 8
      Ui.Button {
        text: "Choose city"
        foreground: Color.bar.text
        bordered: true
        focusable: true
        enabled: root.snapshot.initialized
        onClicked: root.openSearch()
      }
      Ui.Button {
        text: root.snapshot.refreshing ? "Locating…" : "Use IP location"
        foreground: Color.bar.text
        bordered: true
        focusable: true
        enabled: root.snapshot.initialized && !root.snapshot.refreshing
        onClicked: root.startAutomatic()
      }
      Ui.Button {
        text: "Stop weather"
        visible: root.snapshot.mode !== "unset"
        foreground: Color.bar.text
        bordered: true
        focusable: true
        onClicked: root.stopWeather()
      }
    }
    Text {
      width: parent.width
      text: "IP location is opt-in and is sent to wttr.in. Forecasts use Open-Meteo."
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 9
    }
    Attribution {}
  }

  Column {
    id: settingsColumn
    width: root.width
    spacing: 6
    visible: root.activeMode === "settings"
    Item {
      width: parent.width
      height: 28
      Ui.Button {
        id: settingsBack
        anchors.left: parent.left
        text: "Back"
        foreground: Color.bar.text
        fontSize: 10
        focusable: true
        onClicked: root.panelMode = "summary"
      }
      Text {
        anchors.left: settingsBack.right
        anchors.leftMargin: 8
        anchors.right: parent.right
        anchors.rightMargin: root.headerRightInset
        anchors.verticalCenter: parent.verticalCenter
        text: "Weather settings"
        textFormat: Text.PlainText
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 13
        font.weight: Font.DemiBold
        elide: Text.ElideRight
      }
    }
    Row {
      spacing: 3
      Repeater {
        model: [{ id: "system", label: "Auto" }, { id: "metric", label: "°C" }, { id: "imperial", label: "°F" }]
        delegate: Ui.Button {
          id: unitButton
          required property var modelData
          text: modelData.label
          selected: root.snapshot.unit === modelData.id
          foreground: Color.bar.text
          fontSize: 9
          focusable: true
          onClicked: root.store.setUnit(modelData.id)
        }
      }
    }
    Row {
      spacing: 6
      Ui.Button { text: "Change city"; foreground: Color.bar.text; fontSize: 9; focusable: true; onClicked: root.openSearch() }
      Ui.Button {
        text: root.snapshot.refreshing ? "Refreshing…" : "Refresh"
        foreground: Color.bar.text
        fontSize: 9
        focusable: true
        enabled: !root.snapshot.refreshing
        onClicked: root.store.refresh()
      }
      Ui.Button { text: "Stop weather"; foreground: Color.bar.text; fontSize: 9; focusable: true; onClicked: root.stopWeather() }
    }
    Text {
      width: parent.width
      text: root.snapshot.error
      textFormat: Text.PlainText
      color: Color.accent
      font.family: Style.font.family
      font.pixelSize: 9
      elide: Text.ElideRight
      visible: text !== ""
    }
    Ui.Button {
      text: "Retry save"
      foreground: Color.bar.text
      fontSize: 9
      focusable: true
      visible: root.snapshot.saveFailed === true
      onClicked: root.store.retrySaves()
    }
    Attribution {}
  }

  Column {
    id: searchColumn
    width: root.width
    spacing: 7
    visible: root.activeMode === "search"
    Item {
      width: parent.width
      height: 30
      Ui.Button {
        id: searchBack
        anchors.left: parent.left
        text: "Back"
        foreground: Color.bar.text
        fontSize: 9
        focusable: true
        onClicked: root.panelMode = root.snapshot.ready ? "settings" : "summary"
      }
      Rectangle {
        anchors.left: searchBack.right
        anchors.leftMargin: 7
        anchors.right: useIpButton.left
        anchors.rightMargin: 7
        height: 30
        radius: 10
        color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, 0.08)
        border.width: searchInput.activeFocus ? 1 : 0
        border.color: Color.accent
        TextInput {
          id: searchInput
          anchors.fill: parent
          anchors.leftMargin: 9
          anchors.rightMargin: 9
          verticalAlignment: TextInput.AlignVCenter
          color: Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 10
          selectByMouse: true
          clip: true
          onTextChanged: { root.searchPage = 0; searchTimer.restart() }
          Keys.onReturnPressed: root.store.search(text)
        }
        Text {
          anchors.fill: searchInput
          verticalAlignment: Text.AlignVCenter
          text: "Search city"
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
          visible: searchInput.text === ""
          enabled: false
        }
      }
      Ui.Button {
        id: useIpButton
        anchors.right: parent.right
        anchors.rightMargin: root.headerRightInset
        text: root.snapshot.refreshing ? "Locating…" : "Use IP"
        foreground: Color.bar.text
        fontSize: 9
        bordered: true
        focusable: true
        enabled: !root.snapshot.refreshing
        onClicked: root.startAutomatic()
      }
    }
    Text {
      width: parent.width
      text: "IP location is opt-in and is sent to wttr.in. City search uses Open-Meteo."
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 9
    }
    Text {
      width: parent.width
      text: root.snapshot.searching ? "Searching…" : root.snapshot.searchError
      textFormat: Text.PlainText
      color: root.snapshot.searchError ? Color.accent : Color.muted
      font.family: Style.font.family
      font.pixelSize: 9
      visible: text !== ""
    }
    Repeater {
      model: root.visibleLocationChoices
      delegate: Ui.Button {
        id: locationButton
        required property var modelData
        width: searchColumn.width
        height: 32
        text: modelData.label
        tooltipText: modelData.label
        foreground: Color.bar.text
        fontSize: 10
        leftAlign: true
        bordered: true
        focusable: true
        onClicked: root.choose(modelData.location)
      }
    }
    Text {
      width: parent.width
      height: 32
      verticalAlignment: Text.AlignVCenter
      horizontalAlignment: Text.AlignHCenter
      text: searchInput.text.trim() === "" ? "Type a city name to search." : "No matching places."
      textFormat: Text.PlainText
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 10
      visible: !root.snapshot.searching && root.snapshot.searchError === "" && root.locationChoices.length === 0
    }
    Row {
      anchors.horizontalCenter: parent.horizontalCenter
      spacing: 8
      visible: root.searchPageCount > 1
      height: visible ? 24 : 0
      PageGlyph { glyph: "‹"; enabled: root.activeSearchPage > 0; onInvoked: root.searchPage = root.activeSearchPage - 1 }
      Text {
        anchors.verticalCenter: parent.verticalCenter
        text: (root.activeSearchPage + 1) + " / " + root.searchPageCount
        textFormat: Text.PlainText
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 9
      }
      PageGlyph { glyph: "›"; enabled: root.activeSearchPage + 1 < root.searchPageCount; onInvoked: root.searchPage = root.activeSearchPage + 1 }
    }
    Attribution {}
  }
}
