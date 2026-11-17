import QtQuick
import Quickshell

// Input follows the same sampled body and concave shoulders as the painted surface.
Region {
  id: root

  // Region uses integer coordinates. Round endpoints together so mirrored
  // shoulders stop exactly at the bottom or right edge of the strip.
  function regionWidth(rect) {
    return Math.round(rect.x + rect.width) - Math.round(rect.x)
  }

  function regionHeight(rect) {
    return Math.round(rect.y + rect.height) - Math.round(rect.y)
  }

  required property var outline
  readonly property var body: outline ? outline.body : null

  x: body ? Math.round(body.x) : 0
  y: body ? Math.round(body.y) : 0
  width: body ? root.regionWidth(body) : 0
  height: body ? root.regionHeight(body) : 0
  topLeftRadius: body ? Math.round(body.topLeftRadius) : 0
  topRightRadius: body ? Math.round(body.topRightRadius) : 0
  bottomRightRadius: body ? Math.round(body.bottomRightRadius) : 0
  bottomLeftRadius: body ? Math.round(body.bottomLeftRadius) : 0

  component Shoulder: Region {
    id: shoulder
    required property var geometry
    x: geometry ? Math.round(geometry.box.x) : 0
    y: geometry ? Math.round(geometry.box.y) : 0
    width: geometry ? root.regionWidth(geometry.box) : 0
    height: geometry ? root.regionHeight(geometry.box) : 0
    Region {
      intersection: Intersection.Subtract
      shape: RegionShape.Ellipse
      x: shoulder.geometry ? Math.round(shoulder.geometry.cutout.x) : 0
      y: shoulder.geometry ? Math.round(shoulder.geometry.cutout.y) : 0
      width: shoulder.geometry ? root.regionWidth(shoulder.geometry.cutout) : 0
      height: shoulder.geometry ? root.regionHeight(shoulder.geometry.cutout) : 0
    }
  }

  Shoulder { geometry: root.outline ? root.outline.shoulders[0] : null }
  Shoulder { geometry: root.outline ? root.outline.shoulders[1] : null }
}
