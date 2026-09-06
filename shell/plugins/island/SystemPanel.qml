pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui as Ui

Item {
  id: root

  required property var store
  property var content: null
  property real headerRightInset: 32
  property int page: 0
  readonly property string contentKey: content && typeof content === "object" ? String(content.key || "") : ""
  readonly property var snapshot: store ? store.snapshot : ({
    available: false,
    error: "",
    readings: { cpu: null, ram: null, gpu: null, cpuPressure: null, memoryPressure: null, ioPressure: null },
    events: [],
    sampledAt: 0
  })
  readonly property var selectedChoice: selectedFor(snapshot.events, content)
  readonly property var selectedEvent: selectedChoice.event
  readonly property bool selectedEventCurrent: selectedChoice.current
  readonly property bool selectedIsProcess: isProcessEvent(selectedEvent)
  readonly property var otherEvents: remainingEvents(snapshot.events, selectedEvent)
  readonly property int pageCount: 2 + otherEvents.length
  readonly property var pageEvent: eventForPage(otherEvents, page)
  readonly property var strongestReading: strongest()
  readonly property real preferredHeight: Math.ceil(contentColumn.implicitHeight)

  implicitWidth: 376
  implicitHeight: preferredHeight
  clip: true

  function remainingEvents(events, selected) {
    var result = []
    var selectedKey = selected ? selected.key : ""
    for (var index = 0; index < events.length; index++) {
      if (events[index].key !== selectedKey) result.push(events[index])
    }
    return result
  }

  function selectedFor(events, selected) {
    var selectedKey = selected && typeof selected === "object" ? String(selected.key || "") : ""
    if (selectedKey) {
      for (var index = 0; index < events.length; index++) {
        if (events[index].key === selectedKey) return { event: events[index], current: true }
      }
      return { event: selected, current: false }
    }
    return { event: events.length > 0 ? events[0] : null, current: events.length > 0 }
  }

  function eventForPage(events, pageIndex) {
    var index = pageIndex - 2
    return index >= 0 && index < events.length ? events[index] : null
  }

  function isProcessEvent(event) {
    return !!event && String(event.key || "").indexOf("system:process:") === 0
  }

  function strongest() {
    var readings = [
      { label: "CPU busy", value: snapshot.readings.cpu },
      { label: "Memory used", value: snapshot.readings.ram },
      { label: "GPU busy", value: snapshot.readings.gpu }
    ]
    var best = null
    for (var index = 0; index < readings.length; index++) {
      var reading = readings[index]
      if (typeof reading.value !== "number" || !isFinite(reading.value)) continue
      if (!best || reading.value > best.value) best = reading
    }
    return best
  }

  function valueText(value) {
    if (typeof value !== "number" || !isFinite(value)) return "Unavailable"
    return (snapshot.available ? "" : "Last known ") + Math.round(value * 10) / 10 + "%"
  }

  function sampleAge() {
    if (!snapshot.sampledAt) return "No current sample"
    var seconds = Math.max(0, Math.floor((Date.now() - snapshot.sampledAt) / 1000))
    return (snapshot.available ? "Sampled " : "Last sampled ") + (seconds < 2 ? "now" : seconds + "s ago")
  }

  function previousPage() {
    page = Math.max(0, page - 1)
  }

  function nextPage() {
    page = Math.min(pageCount - 1, page + 1)
  }

  onPageCountChanged: page = Math.min(page, pageCount - 1)
  onContentKeyChanged: page = 0

  Column {
    id: contentColumn
    width: root.width > 0 ? root.width : root.implicitWidth
    spacing: 6

    Item {
      width: parent.width
      height: 28

      Text {
        anchors.left: parent.left
        anchors.right: pageControls.left
        anchors.rightMargin: 8
        anchors.verticalCenter: parent.verticalCenter
        text: "System activity"
        textFormat: Text.PlainText
        elide: Text.ElideRight
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 15
        font.weight: Font.DemiBold
      }

      Row {
        id: pageControls
        anchors.right: parent.right
        anchors.rightMargin: root.headerRightInset
        anchors.verticalCenter: parent.verticalCenter
        spacing: 3

        Text {
          anchors.verticalCenter: parent.verticalCenter
          text: (root.page + 1) + "/" + root.pageCount
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 9
        }

        Ui.Button {
          text: "‹"
          width: 26
          height: 24
          radius: height / 2
          foreground: Color.bar.text
          fontSize: 13
          horizontalPadding: 0
          verticalPadding: 0
          enabled: root.page > 0
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: "Previous system page"
          Accessible.focusable: enabled
          Accessible.onPressAction: if (enabled) root.previousPage()
          onClicked: root.previousPage()
        }

        Ui.Button {
          text: "›"
          width: 26
          height: 24
          radius: height / 2
          foreground: Color.bar.text
          fontSize: 13
          horizontalPadding: 0
          verticalPadding: 0
          enabled: root.page + 1 < root.pageCount
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: "Next system page"
          Accessible.focusable: enabled
          Accessible.onPressAction: if (enabled) root.nextPage()
          onClicked: root.nextPage()
        }
      }
    }

    Text {
      width: parent.width
      text: root.snapshot.error || root.sampleAge()
      textFormat: Text.PlainText
      elide: Text.ElideRight
      color: root.snapshot.available && !root.snapshot.error ? Color.muted : Color.accent
      font.family: Style.font.family
      font.pixelSize: 9
    }

    Column {
      width: parent.width
      spacing: 5
      visible: root.page === 0

      Text {
        width: parent.width
        text: root.selectedIsProcess ? "Observed process state" : root.selectedEvent ? root.selectedEvent.label
          : root.strongestReading ? root.strongestReading.label : "No current readings"
        textFormat: Text.PlainText
        elide: Text.ElideRight
        color: root.selectedEvent && root.selectedEvent.phase === "attention" ? Color.accent : Color.muted
        font.family: Style.font.family
        font.pixelSize: 10
      }

      Text {
        width: parent.width
        text: root.selectedIsProcess ? root.selectedEvent.label : root.selectedEvent ? root.selectedEvent.value
          : root.strongestReading ? root.valueText(root.strongestReading.value) : "Unavailable"
        textFormat: Text.PlainText
        wrapMode: Text.WordWrap
        maximumLineCount: 2
        elide: Text.ElideRight
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 24
        font.weight: Font.DemiBold
      }

      Text {
        width: parent.width
        visible: !!root.selectedEvent
        text: !root.selectedEvent ? "" : root.selectedIsProcess
          ? root.selectedEvent.value + (root.selectedEventCurrent ? "" : " · retained observation")
          : !root.selectedEventCurrent ? "Retained observation · no longer current"
          : root.selectedEvent.phase === "terminal" ? "Observed recovery" : "Sustained observation"
        textFormat: Text.PlainText
        wrapMode: Text.WordWrap
        maximumLineCount: 2
        elide: Text.ElideRight
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: root.selectedIsProcess ? 11 : 9
      }
    }

    Row {
      width: parent.width
      spacing: 6
      visible: root.page === 0

      Metric {
        width: Math.max(0, (parent.width - parent.spacing * 2) / 3)
        label: "CPU"
        reading: root.snapshot.readings.cpu
      }
      Metric {
        width: Math.max(0, (parent.width - parent.spacing * 2) / 3)
        label: "RAM"
        reading: root.snapshot.readings.ram
      }
      Metric {
        width: Math.max(0, (parent.width - parent.spacing * 2) / 3)
        label: "GPU"
        reading: root.snapshot.readings.gpu
      }
    }

    Column {
      width: parent.width
      spacing: 6
      visible: root.page === 1

      Text {
        width: parent.width
        text: "Linux pressure · 10 second average"
        textFormat: Text.PlainText
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 10
      }

      Pressure { label: "CPU pressure"; reading: root.snapshot.readings.cpuPressure }
      Pressure { label: "Memory pressure"; reading: root.snapshot.readings.memoryPressure }
      Pressure { label: "I/O pressure"; reading: root.snapshot.readings.ioPressure }
    }

    Column {
      width: parent.width
      spacing: 7
      visible: root.page >= 2 && !!root.pageEvent

      Text {
        width: parent.width
        text: root.pageEvent ? root.pageEvent.label : ""
        textFormat: Text.PlainText
        elide: Text.ElideRight
        color: root.pageEvent && root.pageEvent.phase === "attention" ? Color.accent : Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 15
        font.weight: Font.DemiBold
      }

      Text {
        width: parent.width
        text: root.pageEvent ? root.pageEvent.value : ""
        textFormat: Text.PlainText
        wrapMode: Text.WordWrap
        maximumLineCount: 3
        elide: Text.ElideRight
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: root.isProcessEvent(root.pageEvent) ? 11 : 18
      }

      Text {
        width: parent.width
        text: root.pageEvent && root.pageEvent.phase === "terminal" ? "Observed recovery"
          : "Observed condition · no process outcome inferred"
        textFormat: Text.PlainText
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 9
      }
    }
  }

  component Metric: Item {
    id: metric
    required property string label
    property var reading: null
    readonly property bool supported: typeof reading === "number" && isFinite(reading)
    height: 47

    Text {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.top: parent.top
      text: metric.label
      textFormat: Text.PlainText
      horizontalAlignment: Text.AlignHCenter
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 9
    }

    Text {
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      text: root.valueText(metric.reading)
      textFormat: Text.PlainText
      horizontalAlignment: Text.AlignHCenter
      elide: Text.ElideRight
      color: metric.supported ? Color.bar.text : Color.muted
      font.family: Style.font.family
      font.pixelSize: 13
      font.weight: Font.DemiBold
    }
  }

  component Pressure: Item {
    id: pressure
    required property string label
    property var reading: null
    width: contentColumn.width
    height: 25

    Text {
      anchors.left: parent.left
      anchors.verticalCenter: parent.verticalCenter
      text: pressure.label
      textFormat: Text.PlainText
      color: Color.bar.text
      font.family: Style.font.family
      font.pixelSize: 10
    }

    Text {
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      text: root.valueText(pressure.reading)
      textFormat: Text.PlainText
      color: typeof pressure.reading === "number" && isFinite(pressure.reading) ? Color.bar.text : Color.muted
      font.family: Style.font.family
      font.pixelSize: 10
    }
  }
}
