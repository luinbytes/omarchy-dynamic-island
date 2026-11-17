import QtQuick
import Quickshell

// Input follows the same sampled body and concave shoulders as the painted surface.
Region {
  id: root

  required property var outline
  readonly property var body: outline ? outline.body : null

  x: body ? Math.round(body.x) : 0
  y: body ? Math.round(body.y) : 0
  width: body ? Math.round(body.width) : 0
  height: body ? Math.round(body.height) : 0
  topLeftRadius: body ? Math.round(body.topLeftRadius) : 0
  topRightRadius: body ? Math.round(body.topRightRadius) : 0
  bottomRightRadius: body ? Math.round(body.bottomRightRadius) : 0
  bottomLeftRadius: body ? Math.round(body.bottomLeftRadius) : 0

  component Shoulder: Region {
    id: shoulder
    required property var geometry
    x: geometry ? Math.round(geometry.box.x) : 0
    y: geometry ? Math.round(geometry.box.y) : 0
    width: geometry ? Math.round(geometry.box.width) : 0
    height: geometry ? Math.round(geometry.box.height) : 0
    Region {
      intersection: Intersection.Subtract
      shape: RegionShape.Ellipse
      x: shoulder.geometry ? Math.round(shoulder.geometry.cutout.x) : 0
      y: shoulder.geometry ? Math.round(shoulder.geometry.cutout.y) : 0
      width: shoulder.geometry ? Math.round(shoulder.geometry.cutout.width) : 0
      height: shoulder.geometry ? Math.round(shoulder.geometry.cutout.height) : 0
    }
  }

  Shoulder { geometry: root.outline ? root.outline.shoulders[0] : null }
  Shoulder { geometry: root.outline ? root.outline.shoulders[1] : null }
}
