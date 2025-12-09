import paper from "paper";
import { useStore } from "../../store";
import { generateId } from "./utils";

// Shape Recognition - converts rough drawings to clean shapes
export const recognizeShape = (path) => {
  const bounds = path.bounds;
  const strokeWidth = useStore.getState().strokeWidth;

  // Theme-aware stroke color
  const resolvedTheme = useStore.getState().resolvedTheme;
  const shapeStrokeColor = resolvedTheme === "dark" ? "#e2e8f0" : "#334155";

  // Too small - ignore
  if (bounds.width < 20 || bounds.height < 20) return null;

  path.closed = true;
  const area = Math.abs(path.area);
  const perimeter = path.length;
  const compactness = (4 * Math.PI * area) / perimeter ** 2;
  const aspectRatio = bounds.width / bounds.height;
  const boundingArea = bounds.width * bounds.height;
  const solidity = area / boundingArea;

  const shapeId = generateId();

  // Circle detection: high compactness, aspect ratio close to 1
  if (compactness > 0.7 && aspectRatio > 0.6 && aspectRatio < 1.6) {
    const radius = Math.max(bounds.width, bounds.height) / 2;
    const circle = new paper.Path.Circle({
      center: bounds.center,
      radius: Math.max(radius, 30),
      strokeColor: shapeStrokeColor,
      strokeWidth: strokeWidth,
      fillColor: null,
      data: { type: "shape", shapeType: "circle", shapeId },
    });
    return circle;
  }

  // Triangle detection
  if (
    solidity > 0.35 &&
    solidity < 0.65 &&
    compactness > 0.4 &&
    compactness < 0.7
  ) {
    const cx = bounds.center.x;
    const cy = bounds.center.y;
    const size = Math.max(bounds.width, bounds.height, 50);
    const eqHeight = (size * Math.sqrt(3)) / 2;

    const topPoint = new paper.Point(cx, cy - eqHeight / 2);
    const bottomLeft = new paper.Point(cx - size / 2, cy + eqHeight / 2);
    const bottomRight = new paper.Point(cx + size / 2, cy + eqHeight / 2);

    const triangle = new paper.Path({
      segments: [topPoint, bottomLeft, bottomRight],
      closed: true,
      strokeColor: shapeStrokeColor,
      strokeWidth: strokeWidth,
      fillColor: null,
      data: { type: "shape", shapeType: "triangle", shapeId },
    });
    return triangle;
  }

  // Rectangle detection: high solidity
  if (solidity > 0.6 || compactness > 0.45) {
    const width = Math.max(bounds.width, 60);
    const height = Math.max(bounds.height, 40);
    const rect = new paper.Path.Rectangle({
      point: [bounds.center.x - width / 2, bounds.center.y - height / 2],
      size: [width, height],
      strokeColor: shapeStrokeColor,
      strokeWidth: strokeWidth,
      fillColor: null,
      data: { type: "shape", shapeType: "rectangle", shapeId },
    });
    return rect;
  }

  return null;
};

// Resize a shape (handles circles specially)
export const resizeShape = (
  resizeItem,
  initialBounds,
  resizeAnchor,
  resizeHandleName,
  currentPoint
) => {
  const isCornerHandle = [
    "topLeft",
    "topRight",
    "bottomLeft",
    "bottomRight",
  ].includes(resizeHandleName);
  const isCircle = resizeItem.data?.shapeType === "circle";

  let finalWidth, finalHeight, newX, newY;

  if (isCornerHandle || isCircle) {
    // Corner handles: maintain aspect ratio
    const newWidth = Math.abs(currentPoint.x - resizeAnchor.x);
    const newHeight = Math.abs(currentPoint.y - resizeAnchor.y);
    const aspectRatio = initialBounds.width / initialBounds.height;

    if (newWidth / newHeight > aspectRatio) {
      finalHeight = Math.max(newHeight, 30);
      finalWidth = finalHeight * aspectRatio;
    } else {
      finalWidth = Math.max(newWidth, 30);
      finalHeight = finalWidth / aspectRatio;
    }

    newX =
      resizeAnchor.x < currentPoint.x
        ? resizeAnchor.x
        : resizeAnchor.x - finalWidth;
    newY =
      resizeAnchor.y < currentPoint.y
        ? resizeAnchor.y
        : resizeAnchor.y - finalHeight;
  } else {
    // Edge handles: free resize (deformation)
    if (
      resizeHandleName === "topCenter" ||
      resizeHandleName === "bottomCenter"
    ) {
      finalWidth = initialBounds.width;
      finalHeight = Math.max(Math.abs(currentPoint.y - resizeAnchor.y), 30);
      newX = initialBounds.x;
      newY =
        resizeAnchor.y < currentPoint.y
          ? resizeAnchor.y
          : resizeAnchor.y - finalHeight;
    } else {
      finalWidth = Math.max(Math.abs(currentPoint.x - resizeAnchor.x), 30);
      finalHeight = initialBounds.height;
      newX =
        resizeAnchor.x < currentPoint.x
          ? resizeAnchor.x
          : resizeAnchor.x - finalWidth;
      newY = initialBounds.y;
    }
  }

  // Handle circles specially - recreate with new radius
  if (isCircle) {
    const newRadius = Math.max(finalWidth, finalHeight) / 2;
    const newCenter = new paper.Point(
      newX + finalWidth / 2,
      newY + finalHeight / 2
    );

    const strokeColor = resizeItem.strokeColor;
    const strokeWidth = resizeItem.strokeWidth;
    const data = resizeItem.data;
    const selected = resizeItem.selected;

    resizeItem.remove();
    const newCircle = new paper.Path.Circle({
      center: newCenter,
      radius: newRadius,
      strokeColor: strokeColor,
      strokeWidth: strokeWidth,
      fillColor: null,
      data: data,
    });
    newCircle.selected = selected;
    return newCircle;
  } else {
    resizeItem.bounds = new paper.Rectangle(
      newX,
      newY,
      finalWidth,
      finalHeight
    );
    return resizeItem;
  }
};
