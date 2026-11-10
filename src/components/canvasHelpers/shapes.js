import paper from "paper";
import { useStore } from "../../store.js";
import { generateId } from "./utils.js";

// Split the closed outline before simplifying so its endpoints cannot collapse.
function corners(points, tolerance) {
  const first = points[0];
  let split = 1;
  for (let i = 2; i < points.length; i++) {
    if (points[i].getDistance(first, true) > points[split].getDistance(first, true)) split = i;
  }
  const simplify = (start, end, result) => {
    const chord = new paper.Line(points[start], points[end]);
    let farthest = -1;
    let error = tolerance;
    for (let i = start + 1; i < end; i++) {
      const distance = chord.getDistance(points[i]);
      if (distance > error) {
        error = distance;
        farthest = i;
      }
    }
    if (farthest === -1) result.push(points[start]);
    else {
      simplify(start, farthest, result);
      simplify(farthest, end, result);
    }
  };
  const result = [];
  simplify(0, split, result);
  simplify(split, points.length - 1, result);
  // A sketch may start in the middle of an edge.
  return result.filter((point, index) => {
    if (result.length <= 2) return true;
    const before = result.at(index - 1);
    const after = result[(index + 1) % result.length];
    return new paper.Line(before, after).getDistance(point) > tolerance * 0.65;
  });
}

export const recognizeShape = (path, zoom = 1) => {
  const bounds = path.bounds;
  if (path.segments.length < 4 || Math.min(bounds.width, bounds.height) * zoom < 16) return null;
  const size = Math.min(bounds.width, bounds.height);
  const gap = path.firstSegment.point.getDistance(path.lastSegment.point);
  if (gap > size * 0.27 + 3 / zoom) return null;

  path.closed = true;
  const area = Math.abs(path.area);
  const compactness = (4 * Math.PI * area) / path.length ** 2;
  const solidity = area / (bounds.width * bounds.height);
  const step = Math.max(1, Math.ceil(path.segments.length / 512));
  const points = [];
  for (let i = 0; i < path.segments.length; i += step) points.push(path.segments[i].point);
  if (points.at(-1) !== path.lastSegment.point) points.push(path.lastSegment.point);
  points.push(points[0]);
  const vertices = corners(points, size * 0.085);
  const { resolvedTheme, strokeWidth } = useStore.getState();
  const options = {
    strokeColor: resolvedTheme === "dark" ? "#e2e8f0" : "#334155",
    strokeWidth,
    data: { type: "shape", shapeId: generateId() },
  };
  let shape;
  if (vertices.length === 3 && solidity > 0.30 && compactness > 0.27) {
    options.data.shapeType = "triangle";
    shape = new paper.Path({ ...options, segments: vertices, closed: true });
  } else if (solidity > 0.83 || (vertices.length === 4 && solidity > 0.42 &&
      vertices.every((vertex, i) => {
        const a = vertices.at(i - 1).subtract(vertex).normalize();
        const b = vertices[(i + 1) % 4].subtract(vertex).normalize();
        return Math.abs(a.dot(b)) < 0.28;
      }))) {
    options.data.shapeType = "rectangle";
    if (vertices.length === 4 && solidity <= 0.83) {
      const axis = vertices[1].subtract(vertices[0]).normalize();
      const normal = axis.rotate(90);
      const xs = points.map((point) => point.dot(axis));
      const ys = points.map((point) => point.dot(normal));
      const [left, right] = [Math.min(...xs), Math.max(...xs)];
      const [top, bottom] = [Math.min(...ys), Math.max(...ys)];
      const segments = [[left, top], [right, top], [right, bottom], [left, bottom]]
        .map(([x, y]) => axis.multiply(x).add(normal.multiply(y)));
      shape = new paper.Path({ ...options, segments, closed: true });
    } else {
      shape = new paper.Path.Rectangle({ ...options, rectangle: bounds });
    }
  } else if (compactness > 0.80 && solidity > 0.62 &&
      Math.max(bounds.width, bounds.height) / size < 1.5) {
    options.data.shapeType = "circle";
    shape = new paper.Path.Circle({ ...options, center: bounds.center, radius: (bounds.width + bounds.height) / 4 });
  }
  path.closed = false;
  return shape ?? null;
};

export function resizeShape(item, initialBounds, anchor, handle, point, zoom = 1) {
  const horizontal = /Left|Right|left|right/.test(handle);
  const vertical = /Top|Bottom|top|bottom/.test(handle);
  const dx = (point.x - anchor.x) * (/left/i.test(handle) ? -1 : 1);
  const dy = (point.y - anchor.y) * (/top/i.test(handle) ? -1 : 1);
  const minSize = 12 / zoom;
  let width = horizontal ? Math.max(dx, minSize) : initialBounds.width;
  let height = vertical ? Math.max(dy, minSize) : initialBounds.height;
  if ((horizontal && vertical) || item.data.shapeType === "circle") {
    const scale = horizontal && vertical
      ? (dx * initialBounds.width + dy * initialBounds.height) /
        (initialBounds.width ** 2 + initialBounds.height ** 2)
      : horizontal ? width / initialBounds.width : height / initialBounds.height;
    const bounded = Math.max(scale, minSize / Math.min(initialBounds.width, initialBounds.height));
    width = initialBounds.width * bounded;
    height = initialBounds.height * bounded;
  }
  item.bounds = new paper.Rectangle(
    horizontal ? anchor.x - (/left/i.test(handle) ? width : 0) : anchor.x - width / 2,
    vertical ? anchor.y - (/top/i.test(handle) ? height : 0) : anchor.y - height / 2,
    width, height,
  );
}
