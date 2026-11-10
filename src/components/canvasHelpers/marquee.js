import paper from "paper";
import { getAllSelectableItems } from "./utils.js";

export function createMarquee(start) {
  const zoom = paper.view.zoom;
  const outline = new paper.Path.Rectangle({
    from: start,
    to: start.add([1 / zoom, 1 / zoom]),
    strokeColor: "#6366f1",
    strokeWidth: 1 / zoom,
    dashArray: [4 / zoom, 4 / zoom],
    fillColor: new paper.Color(99 / 255, 102 / 255, 241 / 255, 0.1),
    data: { type: "selectionUI" },
  });
  return {
    move(point) {
      const bounds = new paper.Rectangle(start, point);
      bounds.width = Math.max(bounds.width, 1 / zoom);
      bounds.height = Math.max(bounds.height, 1 / zoom);
      outline.bounds = bounds;
    },
    select() {
      for (const item of getAllSelectableItems()) {
        if (outline.bounds.intersects(item.strokeBounds)) item.selected = true;
      }
    },
    remove: () => outline.remove(),
  };
}
