import QtQuick
import QtQuick.Effects
import QtQuick.Shapes
import qs.Commons
import "ViewModel.js" as ViewModel

Item {
  id: root

  property var visual: null
  property bool interactive: false
  property bool backgroundVisible: true
  property bool reducedMotion: false
  property var service: null
  property string screenName: ""
  property real detailHeightBudget: 0
  property var outlineMetrics: ({})
  signal clicked(string key)
  signal actionRequested(string actionId)
  signal seekRequested(string trackToken, real positionSeconds)
  signal layoutReported(string key, int widthToken, real preferredHeight)

  readonly property bool drawn: !!visual && visual.visible
  readonly property var rect: drawn ? visual.rect : ({ x: 0, y: 0, width: 0, height: 0, radius: 0 })
  readonly property var outline: ViewModel.activityOutline(rect, outlineMetrics)
  readonly property bool contentSafe: !root.outline || root.outline.contentSafe !== false
  readonly property var sharedTitle: root.visual && root.visual.sharedTitle ? root.visual.sharedTitle : null
  readonly property bool secondaryUsesCompactText: !!root.visual && root.visual.role === "secondary"
    && !!root.visual.incoming && !!root.visual.incoming.content && typeof root.visual.incoming.content.compactText === "string"
    && root.visual.incoming.content.compactText !== ""
  readonly property bool hubNavigationInteractive: root.interactive && !!root.service && !!root.service.hubState
    && root.service.hubState.expanded && root.service.hubState.ownerScreen === root.screenName
    && !!root.visual && root.service.hubState.entityKey === root.visual.key
    && !!root.visual.incoming && root.visual.incoming.expanded === true
    && !!root.visual.incoming.content && root.visual.incoming.content.hub === true
    && root.visual.incoming.content.key === root.visual.key
  readonly property bool chooserOwnsHeader: root.hubNavigationInteractive && root.service.hubState.chooserOpen
  readonly property var sharedTitleSample: root.sharedTitle && root.sharedTitle.present
    ? ViewModel.titleSample(root.visual && root.visual.titleSampleRect ? root.visual.titleSampleRect : root.rect, root.sharedTitle)
    : ({ progress: 0, x: 0, visualWidth: 0 })
  readonly property int sharedTitleBackingSize: root.visual && root.visual.geometrySettled && root.sharedTitle && root.sharedTitle.target === "compact" ? 11 : 14
  readonly property real sharedTitleScale: root.sharedTitle && root.sharedTitle.present && root.sharedTitleBackingSize === 14 ? Math.max(0.1, (11 + 3 * root.sharedTitleSample.progress) / 14) : 1
  readonly property real sharedTitleAscent: root.sharedTitleBackingSize === 11 ? compactTitleMetrics.ascent : expandedTitleMetrics.ascent
  readonly property real compactTitleBaseline: root.sharedTitle && root.sharedTitle.compact && root.sharedTitle.compact.body
    ? root.sharedTitle.compact.body.y + Math.floor((root.sharedTitle.compact.body.height - compactTitleProbe.implicitHeight) / 2) + compactTitleProbe.baselineOffset : 0
  readonly property real expandedTitleBaseline: root.sharedTitle && root.sharedTitle.expanded && root.sharedTitle.expanded.body
    ? root.sharedTitle.expanded.body.y + 14 + expandedTitleMetrics.ascent : 0
  readonly property real sharedTitleBaseline: root.compactTitleBaseline + (root.expandedTitleBaseline - root.compactTitleBaseline) * root.sharedTitleSample.progress
  readonly property bool sharedTitleVisible: !!root.sharedTitle && root.sharedTitle.present && root.sharedTitle.owned === true
  readonly property bool sharedArtworkOwned: root.sharedTitleVisible
  readonly property var sharedTitleTransition: root.sharedTitle && root.sharedTitle.transition ? root.sharedTitle.transition : null
  readonly property real sharedTitleMix: root.sharedTitleTransition ? root.sharedTitleTransition.progress : 1
  readonly property bool sharedSubtitleVisible: root.sharedTitleVisible && root.sharedTitle && root.sharedTitle.target === "expanded"
  readonly property bool controlsInteractive: root.interactive && !!root.visual && root.visual.geometrySettled
  readonly property bool chooserSelectionInteractive: root.chooserOwnsHeader
  readonly property bool incomingInteractive: root.controlsInteractive || root.hubNavigationInteractive

  function mediaSourceLabel() {
    var music = root.service && root.service.music ? root.service.music : null
    var players = music && music.players ? music.players : []
    for (var index = 0; index < players.length; index++) {
      if (players[index] && players[index].key === music.publishedKey) return String(players[index].label || "")
    }
    return ""
  }

  function sharedSubtitle(title) {
    var subtitle = title && typeof title.subtitle === "string" ? title.subtitle : ""
    return subtitle !== "" ? subtitle : root.mediaSourceLabel()
  }

  function mediaDiagnostic() {
    var media = incomingContent.mediaDiagnostic()
    if (!media) return null
    media.title = {
      x: root.x + bodyClip.x + sharedMediaTitle.x,
      baseline: root.y + bodyClip.y + sharedMediaTitle.y + root.sharedTitleAscent * root.sharedTitleScale,
      visualWidth: root.sharedTitleSample.visualWidth,
      scale: root.sharedTitleScale,
      identity: root.sharedTitle ? root.sharedTitle.identity : null,
      backingSize: sharedMediaTitle.font.pixelSize
    }
    media.artwork = root.sharedArtworkOwned ? sharedArtImage.status === Image.Ready ? "ready"
      : sharedArtImage.status === Image.Loading ? "loading" : sharedArtImage.status === Image.Error ? "error" : "fallback" : media.artwork
    media.headerArtwork = {
      x: root.rect.x + sharedArtwork.x,
      y: root.rect.y + sharedArtwork.y,
      size: sharedArtwork.width,
      identity: root.sharedTitle ? root.sharedTitle.identity : null
    }
    return media
  }

  x: outline.bounds.x
  y: outline.bounds.y
  width: outline.bounds.width
  height: outline.bounds.height
  visible: drawn && width > 0 && height > 0
  opacity: 1
  clip: true

  Shape {
    id: capsuleBackground
    visible: root.backgroundVisible
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer

    ShapePath {
      fillColor: Color.bar.background
      strokeColor: root.visual && root.visual.alertOpacity > 0 ? Color.accent : "transparent"
      strokeWidth: root.visual && root.visual.alertOpacity > 0 ? 1 : -1

      PathSvg {
        path: root.outline.perimeter
      }
    }
  }

  Item {
    id: bodyClip
    visible: root.contentSafe
    x: root.outline.body.x - root.outline.bounds.x
    y: root.outline.body.y - root.outline.bounds.y
    width: root.outline.body.width
    height: root.outline.body.height
    clip: true

  Item {
    id: outgoingLayer
    readonly property var layout: root.visual && root.visual.outgoing ? root.visual.outgoing.layout : ({ width: 0, height: 0 })
    width: Math.max(0, layout.width || 0)
    height: Math.max(0, layout.height || 0)
    x: root.visual && root.visual.outgoing && root.visual.outgoing.offsetX !== undefined
      ? root.visual.outgoing.offsetX : (parent.width - width) / 2
    y: root.visual && root.visual.outgoing ? root.visual.outgoing.offsetY || 0 : 0
    clip: true
    visible: !!root.visual && !!root.visual.outgoing
    opacity: 1
    enabled: false

    IslandContent {
      id: outgoingContent
      anchors.fill: parent
      content: root.visual && root.visual.outgoing ? root.visual.outgoing.content : null
      expanded: root.visual && root.visual.outgoing ? root.visual.outgoing.expanded : false
      actionsEnabled: false
      reducedMotion: root.reducedMotion
      mediaTitleOwnedByBody: !!root.sharedTitle && root.sharedTitle.owned === true
      mediaArtworkOwnedByBody: root.sharedArtworkOwned
      visible: !content || !content.hub
    }

    Loader {
      anchors.fill: parent
      active: !!root.service && !!root.visual && !!root.visual.outgoing && root.visual.outgoing.expanded && root.visual.outgoing.content.hub === true
      sourceComponent: Component {
        HubContent {
          service: root.service
          screenName: root.screenName
          content: root.visual.outgoing.content
          interactive: false
          reducedMotion: root.reducedMotion
          titleOwnedByBody: !!root.sharedTitle && root.sharedTitle.owned === true
          artworkOwnedByBody: root.sharedArtworkOwned
        }
      }
    }
  }

  Item {
    id: incomingLayer
    enabled: root.incomingInteractive
    readonly property var layout: root.visual && root.visual.incoming ? root.visual.incoming.layout : ({ width: 0, height: 0 })
    width: Math.max(0, layout.width || 0)
    height: Math.max(0, layout.height || 0)
    x: root.visual && root.visual.incoming && root.visual.incoming.offsetX !== undefined
      ? root.visual.incoming.offsetX : (parent.width - width) / 2
    y: root.visual && root.visual.incoming ? root.visual.incoming.offsetY || 0 : 0
    clip: true
    visible: !!root.visual && !!root.visual.incoming
    opacity: 1

    IslandContent {
      id: incomingContent
      anchors.fill: parent
      content: root.visual && root.visual.incoming ? root.visual.incoming.content : null
      expanded: root.visual && root.visual.incoming ? root.visual.incoming.expanded : false
      actionsEnabled: root.controlsInteractive
      reducedMotion: root.reducedMotion
      mediaTitleOwnedByBody: !!root.sharedTitle && root.sharedTitle.owned === true
      mediaArtworkOwnedByBody: root.sharedArtworkOwned
      visible: (!content || !content.hub) && !(root.visual && (root.visual.role === "minimal"
        || (root.visual.role === "secondary" && !root.secondaryUsesCompactText)))
      onActionRequested: function(actionId) { root.actionRequested(actionId) }
      onSeekRequested: function(trackToken, positionSeconds) { root.seekRequested(trackToken, positionSeconds) }
    }

    Loader {
      anchors.fill: parent
      active: !!root.service && !!root.visual && !!root.visual.incoming && root.visual.incoming.expanded && root.visual.incoming.content.hub === true
      sourceComponent: Component {
        HubContent {
          service: root.service
          screenName: root.screenName
          content: root.visual.incoming.content
          interactive: root.interactive
          controlsEnabled: root.controlsInteractive
          chooserNavigationEnabled: root.hubNavigationInteractive
          chooserSelectionEnabled: root.chooserSelectionInteractive
          reducedMotion: root.reducedMotion
          titleOwnedByBody: !!root.sharedTitle && root.sharedTitle.owned === true
          artworkOwnedByBody: root.sharedArtworkOwned
          reportLayout: root.interactive
          heightBudget: root.detailHeightBudget
          onLayoutReported: function(key, widthToken, preferredHeight) {
            root.layoutReported(key, widthToken, preferredHeight)
          }
        }
      }
    }

    Item {
      id: minimalContent
      anchors.fill: parent
      visible: !!root.visual && !(root.sharedArtworkOwned && root.visual.incoming && root.visual.incoming.content.media)
        && (root.visual.role === "minimal"
        || (root.visual.role === "secondary" && !root.secondaryUsesCompactText))
      Image {
        id: minimalArt
        anchors.centerIn: parent
        width: 16
        height: 16
        source: root.visual && root.visual.incoming && root.visual.incoming.content.media ? root.visual.incoming.content.media.artUrl || "" : ""
        sourceSize.width: 32
        sourceSize.height: 32
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        visible: status === Image.Ready
      }
      ActivityIcon {
        anchors.centerIn: parent
        width: 16
        height: 16
        name: root.visual && root.visual.incoming ? root.visual.incoming.content.icon || "" : ""
        size: 14
        color: Color.bar.text
        fallbackText: root.visual && root.visual.incoming
          ? root.visual.incoming.content.minimalValue || root.visual.incoming.content.icon || "◦" : ""
        visible: minimalArt.status !== Image.Ready
      }
      Rectangle {
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 2
        width: 3
        height: 3
        radius: 1.5
        color: Color.accent
        visible: !!root.visual && !!root.visual.incoming && !!root.visual.incoming.content.media && root.visual.incoming.content.media.playing === true
      }
    }
  }

  Item {
    id: sharedArtwork
    readonly property real progress: root.sharedTitleSample.progress
    readonly property var compactBody: root.sharedTitle && root.sharedTitle.compact ? root.sharedTitle.compact.body : ({ x: 0, y: 0, height: 22 })
    readonly property var expandedBody: root.sharedTitle && root.sharedTitle.expanded ? root.sharedTitle.expanded.body : compactBody
    readonly property real cornerRadius: Math.max(0, 4 + 8 * progress)
    x: compactBody.x + 6 + (expandedBody.x + 16 - compactBody.x - 6) * progress - root.rect.x
    y: compactBody.y + (compactBody.height - 16) / 2
      + (expandedBody.y + 14 - compactBody.y - (compactBody.height - 16) / 2) * progress - root.rect.y
      + (root.sharedTitle && root.sharedTitle.offsetY ? root.sharedTitle.offsetY : 0)
    width: Math.max(0, 16 + 36 * progress)
    height: width
    visible: root.contentSafe && root.sharedArtworkOwned && !root.chooserOwnsHeader
    opacity: 1
    clip: true
    z: 3

    Rectangle { anchors.fill: parent; radius: parent.cornerRadius; color: Color.muted }
    Rectangle { id: sharedArtMask; anchors.fill: parent; radius: parent.cornerRadius; visible: false; layer.enabled: true }
    Image {
      id: sharedArtImage
      anchors.fill: parent
      source: root.sharedTitle ? root.sharedTitle.artUrl || "" : ""
      sourceSize.width: 104
      sourceSize.height: 104
      fillMode: Image.PreserveAspectCrop
      asynchronous: true
      opacity: root.sharedTitleTransition ? 1 - root.sharedTitleMix : 1
      visible: status === Image.Ready
      z: 1
      layer.enabled: true
      layer.effect: MultiEffect { maskEnabled: true; maskSource: sharedArtMask }
    }
    Image {
      id: incomingSharedArtImage
      anchors.fill: parent
      source: root.sharedTitleTransition ? root.sharedTitleTransition.incoming.artUrl || "" : ""
      sourceSize.width: 104
      sourceSize.height: 104
      fillMode: Image.PreserveAspectCrop
      asynchronous: true
      opacity: root.sharedTitleTransition ? root.sharedTitleMix : 0
      visible: status === Image.Ready && !!root.sharedTitleTransition
      z: 1
      layer.enabled: true
      layer.effect: MultiEffect { maskEnabled: true; maskSource: sharedArtMask }
    }
    Text {
      id: sharedArtFallback
      anchors.centerIn: parent
      text: "♪"
      font.family: Style.font.family
      font.pixelSize: Math.max(10, sharedArtwork.width * 0.6)
      color: Color.bar.background
      opacity: root.sharedTitleTransition ? 1 - root.sharedTitleMix : 1
      visible: sharedArtImage.status !== Image.Ready
      z: 1
    }
    Text {
      id: incomingSharedArtFallback
      anchors.centerIn: parent
      text: "♪"
      font.family: Style.font.family
      font.pixelSize: Math.max(10, sharedArtwork.width * 0.6)
      color: Color.bar.background
      opacity: root.sharedTitleTransition ? root.sharedTitleMix : 0
      visible: !!root.sharedTitleTransition && incomingSharedArtImage.status !== Image.Ready
      z: 1
    }
  }

  FontMetrics {
    id: compactTitleMetrics
    font.family: Style.font.family
    font.pixelSize: 11
    font.weight: Font.DemiBold
  }

  Text {
    id: compactTitleProbe
    visible: false
    text: "Hg"
    font.family: Style.font.family
    font.pixelSize: 11
    font.weight: Font.DemiBold
  }

  FontMetrics {
    id: expandedTitleMetrics
    font.family: Style.font.family
    font.pixelSize: 14
    font.weight: Font.DemiBold
  }

  Text {
    id: sharedMediaTitle
    x: root.sharedTitleSample.x - root.rect.x
    y: root.sharedTitleBaseline - root.rect.y - root.sharedTitleAscent * root.sharedTitleScale
      + (root.sharedTitle && root.sharedTitle.offsetY ? root.sharedTitle.offsetY : 0)
    width: root.sharedTitleScale > 0 ? root.sharedTitleSample.visualWidth / root.sharedTitleScale : 0
    text: root.sharedTitle ? root.sharedTitle.text : ""
    textFormat: Text.PlainText
    color: Color.bar.text
    font.family: Style.font.family
    font.pixelSize: root.sharedTitleBackingSize
    font.weight: Font.DemiBold
    renderType: Text.QtRendering
    elide: Text.ElideRight
    transformOrigin: Item.TopLeft
    scale: root.sharedTitleScale
    opacity: root.sharedTitleTransition ? 1 - root.sharedTitleMix : 1
    visible: root.contentSafe && !root.chooserOwnsHeader && root.sharedTitleVisible && root.sharedTitleSample.visualWidth > 0
    z: 3
  }

  Text {
    id: incomingSharedMediaTitle
    x: sharedMediaTitle.x
    y: sharedMediaTitle.y
    width: sharedMediaTitle.width
    text: root.sharedTitleTransition ? root.sharedTitleTransition.incoming.text : ""
    textFormat: Text.PlainText
    color: Color.bar.text
    font.family: Style.font.family
    font.pixelSize: root.sharedTitleBackingSize
    font.weight: Font.DemiBold
    renderType: Text.QtRendering
    elide: Text.ElideRight
    transformOrigin: Item.TopLeft
    scale: root.sharedTitleScale
    opacity: root.sharedTitleTransition ? root.sharedTitleMix : 0
    visible: root.contentSafe && !root.chooserOwnsHeader && root.sharedTitleVisible && !!root.sharedTitleTransition
      && root.sharedTitleSample.visualWidth > 0
    z: 3
  }

  Text {
    id: sharedMediaSubtitle
    x: root.sharedTitleSample.x - root.rect.x
    y: sharedMediaTitle.y + sharedMediaTitle.implicitHeight * root.sharedTitleScale + 4
    width: root.sharedTitleSample.visualWidth
    text: root.sharedSubtitle(root.sharedTitle)
    textFormat: Text.PlainText
    color: Color.muted
    font.family: Style.font.family
    font.pixelSize: 11
    elide: Text.ElideRight
    opacity: root.sharedTitleTransition ? 1 - root.sharedTitleMix : 1
    visible: root.contentSafe && !root.chooserOwnsHeader && root.sharedSubtitleVisible && text !== ""
    z: 3
  }

  Text {
    id: incomingSharedMediaSubtitle
    x: sharedMediaSubtitle.x
    y: sharedMediaSubtitle.y
    width: sharedMediaSubtitle.width
    text: root.sharedTitleTransition ? root.sharedSubtitle(root.sharedTitleTransition.incoming) : ""
    textFormat: Text.PlainText
    color: Color.muted
    font.family: Style.font.family
    font.pixelSize: 11
    elide: Text.ElideRight
    opacity: root.sharedTitleTransition ? root.sharedTitleMix : 0
    visible: root.contentSafe && !root.chooserOwnsHeader && root.sharedSubtitleVisible && !!root.sharedTitleTransition && text !== ""
    z: 3
  }

  Rectangle {
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    height: 2
    radius: 1
    color: Color.accent
    visible: root.visual && root.visual.alertOpacity > 0
    opacity: visible ? root.visual.alertOpacity : 0
  }
  }

  MouseArea {
    anchors.fill: parent
    z: -1
    enabled: root.interactive && root.contentSafe
    cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
    onClicked: root.clicked(root.visual ? root.visual.key : "")
  }
}
