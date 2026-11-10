import paper from "paper";
import { useStore } from "../../store.js";
import { getAllSelectableItems } from "./utils.js";

export function getConnectionPoints(from, to) {
  const start = from.bounds.center;
  const end = to.bounds.center;
  const delta = end.subtract(start);
  const axis = Math.abs(delta.x) >= Math.abs(delta.y)
    ? new paper.Point(Math.sign(delta.x) || 1, 0)
    : new paper.Point(0, Math.sign(delta.y));
  const boundary = (shape, center, direction) => {
    const ray = new paper.Path.Line({
      from: center,
      to: center.add(direction.multiply(Math.max(shape.bounds.width, shape.bounds.height) + 1)),
      insert: false,
    });
    const intersection = shape.getIntersections(ray)
      .sort((a, b) => b.point.getDistance(center, true) - a.point.getDistance(center, true))[0];
    return (intersection?.point ?? shape.getNearestPoint(center))
      .add(direction.multiply(shape.strokeWidth / 2));
  };
  const fromPoint = boundary(from, start, axis);
  const toPoint = boundary(to, end, axis.negate());
  const gap = toPoint.subtract(fromPoint).dot(axis);
  const handle = axis.multiply(Math.min(120, Math.max(0, gap * 0.45)));
  return { fromPoint, toPoint, handle, axis, gap };
}

export const connectorColors = (theme) => theme === "dark"
  ? { line: "#94a3b8", arrow: "#818cf8" }
  : { line: "#64748b", arrow: "#4f46e5" };

export function updateConnector(group, shapes) {
  const { fromShapeId, toShapeId, style, bidirectional } = group.data;
  const from = shapes.get(fromShapeId);
  const to = shapes.get(toShapeId);
  if (!from || !to) return;
  const { fromPoint, toPoint, handle, axis, gap } = getConnectionPoints(from, to);
  const curved = style !== "straight" && gap > 0;
  const [line, end, start] = group.children;
  line.segments[0].point = fromPoint;
  line.segments[0].handleOut = curved ? handle : null;
  line.segments[1].point = toPoint;
  line.segments[1].handleIn = curved ? handle.negate() : null;
  const delta = toPoint.subtract(fromPoint);
  const direction = curved || !delta.length ? axis : delta.normalize();
  const size = Math.min(10, delta.length * (bidirectional ? 0.45 : 0.8));
  const arrow = (path, tip, back) => {
    path.segments[0].point = tip.add(back.rotate(25).multiply(size));
    path.segments[1].point = tip;
    path.segments[2].point = tip.add(back.rotate(-25).multiply(size));
  };
  arrow(end, toPoint, direction.negate());
  if (start) arrow(start, fromPoint, direction);
}

export function createConnector(from, to) {
  if (from === to) return false;
  const fromShapeId = from.data.shapeId;
  const toShapeId = to.data.shapeId;
  const { connectorStyle, resolvedTheme } = useStore.getState();
  const colors = connectorColors(resolvedTheme);
  const makeArrow = () => new paper.Path({
    segments: [[0, 0], [0, 0], [0, 0]], closed: true, fillColor: colors.arrow, insert: false,
  });
  let group = getAllSelectableItems().find(({ data }) => data.type === "connector" &&
    ((data.fromShapeId === fromShapeId && data.toShapeId === toShapeId) ||
     (data.fromShapeId === toShapeId && data.toShapeId === fromShapeId)));
  if (group) {
    if (group.data.bidirectional || group.data.fromShapeId === fromShapeId) return false;
    group.data.bidirectional = true;
    group.children[0].dashArray = [];
    group.children[0].dashOffset = 0;
    group.addChild(makeArrow());
  } else {
    const line = new paper.Path({
      segments: [[0, 0], [0, 0]], strokeColor: colors.line, strokeWidth: 2,
      strokeCap: "round", dashArray: [8, 4], insert: false,
    });
    group = new paper.Group([line, makeArrow()]);
    group.data = { type: "connector", fromShapeId, toShapeId, style: connectorStyle };
    group.sendToBack();
  }
  updateConnector(group, new Map([[fromShapeId, from], [toShapeId, to]]));
  return true;
}

// Resolve the affected labels and links once at the start of a move or resize.
export function geometryUpdater(items, movedItems) {
  const movedIds = new Set(movedItems.filter((item) => item.data.type === "shape").map((item) => item.data.shapeId));
  const shapes = new Map(items.filter((item) => item.data.type === "shape").map((item) => [item.data.shapeId, item]));
  const labels = items.filter(({ data }) => data.type === "text" && movedIds.has(data.attachedToShapeId));
  const links = items.filter(({ data }) => data.type === "connector" &&
    (movedIds.has(data.fromShapeId) || movedIds.has(data.toShapeId)));
  return () => {
    for (const label of labels) label.position = shapes.get(label.data.attachedToShapeId).bounds.center;
    for (const link of links) updateConnector(link, shapes);
  };
}
