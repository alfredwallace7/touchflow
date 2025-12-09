import paper from "paper";
import { useStore } from "../../store";
import { findShapeById } from "./utils";

// Get connector colors from CSS variables
const getConnectorColors = () => {
  const style = getComputedStyle(document.documentElement);
  return {
    line: style.getPropertyValue("--connector-line").trim() || "#64748b",
    arrow: style.getPropertyValue("--connector-arrow").trim() || "#6366f1",
  };
};

// Calculate best connection points between two shapes
export const getConnectionPoints = (fromShape, toShape) => {
  const fromBounds = fromShape.bounds;
  const toBounds = toShape.bounds;
  const fromCenter = fromBounds.center;
  const toCenter = toBounds.center;

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let fromPoint, toPoint, fromHandle, toHandle, direction;

  // Determine if connection is more horizontal or vertical
  if (absDx >= absDy) {
    // Horizontal connection (left/right)
    direction = "horizontal";
    if (dx >= 0) {
      fromPoint = new paper.Point(fromBounds.right, fromCenter.y);
      toPoint = new paper.Point(toBounds.left, toCenter.y);
    } else {
      fromPoint = new paper.Point(fromBounds.left, fromCenter.y);
      toPoint = new paper.Point(toBounds.right, toCenter.y);
    }

    const handleLength = Math.max(30, Math.min(absDx * 0.4, 120));
    fromHandle = new paper.Point(dx >= 0 ? handleLength : -handleLength, 0);
    toHandle = new paper.Point(dx >= 0 ? -handleLength : handleLength, 0);
  } else {
    // Vertical connection (top/bottom)
    direction = "vertical";
    if (dy >= 0) {
      fromPoint = new paper.Point(fromCenter.x, fromBounds.bottom);
      toPoint = new paper.Point(toCenter.x, toBounds.top);
    } else {
      fromPoint = new paper.Point(fromCenter.x, fromBounds.top);
      toPoint = new paper.Point(toCenter.x, toBounds.bottom);
    }

    const handleLength = Math.max(30, Math.min(absDy * 0.4, 120));
    fromHandle = new paper.Point(0, dy >= 0 ? handleLength : -handleLength);
    toHandle = new paper.Point(0, dy >= 0 ? -handleLength : handleLength);
  }

  return { fromPoint, toPoint, fromHandle, toHandle, direction, dx, dy };
};

// Create connector with smart side detection
export const createConnector = (fromShape, toShape) => {
  const fromShapeId = fromShape.data.shapeId;
  const toShapeId = toShape.data.shapeId;

  // Check if reverse connector exists (B->A when creating A->B)
  const existingReverse = paper.project.getItems({
    match: (item) =>
      item.data?.type === "connector" &&
      item.data.fromShapeId === toShapeId &&
      item.data.toShapeId === fromShapeId,
  })[0];

  if (existingReverse) {
    // Convert to bidirectional connector
    return makeBidirectional(existingReverse);
  }

  const { fromPoint, toPoint, fromHandle, toHandle, direction, dx, dy } =
    getConnectionPoints(fromShape, toShape);

  const connectorStyle = useStore.getState().connectorStyle;
  const connectorStrokeWidth = 2;
  const colors = getConnectorColors();

  const connector = new paper.Path({
    strokeColor: colors.line,
    strokeWidth: connectorStrokeWidth,
    strokeCap: "round",
    fillColor: null,
    dashArray: [8, 4],
  });

  if (connectorStyle === "bezier") {
    connector.add(new paper.Segment(fromPoint, null, fromHandle));
    connector.add(new paper.Segment(toPoint, toHandle, null));
  } else {
    connector.add(fromPoint);
    connector.add(toPoint);
  }

  // Calculate filled triangle arrowhead
  const arrowSize = 10;
  const arrowAngle = 25;
  let endDir;

  if (direction === "horizontal") {
    endDir = dx >= 0 ? new paper.Point(-1, 0) : new paper.Point(1, 0);
  } else {
    endDir = dy >= 0 ? new paper.Point(0, -1) : new paper.Point(0, 1);
  }

  const arrow1 = toPoint.add(endDir.rotate(arrowAngle).multiply(arrowSize));
  const arrow2 = toPoint.add(endDir.rotate(-arrowAngle).multiply(arrowSize));

  const arrowPath = new paper.Path({
    segments: [arrow1, toPoint, arrow2],
    closed: true,
    fillColor: colors.arrow,
    strokeColor: null,
  });

  const group = new paper.Group([connector, arrowPath]);
  group.data = {
    type: "connector",
    fromShapeId: fromShapeId,
    toShapeId: toShapeId,
    style: connectorStyle,
  };

  group.sendToBack();
  return group;
};

// Convert a unidirectional connector to bidirectional (add arrow at start)
const makeBidirectional = (connectorGroup) => {
  const fromShape = findShapeById(connectorGroup.data.fromShapeId);
  const toShape = findShapeById(connectorGroup.data.toShapeId);
  if (!fromShape || !toShape) return connectorGroup;

  const { fromPoint, direction, dx, dy } = getConnectionPoints(
    fromShape,
    toShape
  );

  // Remove dashes - make solid line for bidirectional
  const connector = connectorGroup.children[0];
  if (connector) {
    connector.dashArray = null;
  }

  // Add filled triangle arrow at start point
  const arrowSize = 10;
  const arrowAngle = 25;
  const colors = getConnectorColors();
  let startDir;

  if (direction === "horizontal") {
    startDir = dx >= 0 ? new paper.Point(1, 0) : new paper.Point(-1, 0);
  } else {
    startDir = dy >= 0 ? new paper.Point(0, 1) : new paper.Point(0, -1);
  }

  const arrow1 = fromPoint.add(startDir.rotate(arrowAngle).multiply(arrowSize));
  const arrow2 = fromPoint.add(
    startDir.rotate(-arrowAngle).multiply(arrowSize)
  );

  const startArrowPath = new paper.Path({
    segments: [arrow1, fromPoint, arrow2],
    closed: true,
    fillColor: colors.arrow,
    strokeColor: null,
  });

  connectorGroup.addChild(startArrowPath);
  connectorGroup.data.bidirectional = true;

  return connectorGroup;
};

// Update connector between two shapes
export const updateConnector = (connectorGroup) => {
  if (!connectorGroup?.data) return;

  const fromShape = findShapeById(connectorGroup.data.fromShapeId);
  const toShape = findShapeById(connectorGroup.data.toShapeId);

  if (!fromShape || !toShape) {
    connectorGroup.remove();
    return;
  }

  const { fromPoint, toPoint, fromHandle, toHandle, direction, dx, dy } =
    getConnectionPoints(fromShape, toShape);

  const connectorStyle = connectorGroup.data.style || "bezier";

  // Update the curve path (first child)
  const curvePath = connectorGroup.children[0];
  if (curvePath && curvePath.segments.length >= 2) {
    curvePath.segments[0].point = fromPoint;
    curvePath.segments[1].point = toPoint;

    if (connectorStyle === "bezier") {
      curvePath.segments[0].handleOut = fromHandle;
      curvePath.segments[1].handleIn = toHandle;
    } else {
      curvePath.segments[0].handleOut = null;
      curvePath.segments[1].handleIn = null;
    }
  }

  // Update end arrow (second child)
  const arrowSize = 10;
  const arrowAngle = 25;

  const arrowPath = connectorGroup.children[1];
  if (arrowPath && arrowPath.segments.length >= 3) {
    let endDir;
    if (direction === "horizontal") {
      endDir = dx >= 0 ? new paper.Point(-1, 0) : new paper.Point(1, 0);
    } else {
      endDir = dy >= 0 ? new paper.Point(0, -1) : new paper.Point(0, 1);
    }

    arrowPath.segments[0].point = toPoint.add(
      endDir.rotate(arrowAngle).multiply(arrowSize)
    );
    arrowPath.segments[1].point = toPoint;
    arrowPath.segments[2].point = toPoint.add(
      endDir.rotate(-arrowAngle).multiply(arrowSize)
    );
  }

  // Update start arrow (third child) for bidirectional connectors
  if (connectorGroup.data.bidirectional && connectorGroup.children[2]) {
    const startArrowPath = connectorGroup.children[2];
    if (startArrowPath && startArrowPath.segments.length >= 3) {
      let startDir;
      if (direction === "horizontal") {
        startDir = dx >= 0 ? new paper.Point(1, 0) : new paper.Point(-1, 0);
      } else {
        startDir = dy >= 0 ? new paper.Point(0, 1) : new paper.Point(0, -1);
      }

      startArrowPath.segments[0].point = fromPoint.add(
        startDir.rotate(arrowAngle).multiply(arrowSize)
      );
      startArrowPath.segments[1].point = fromPoint;
      startArrowPath.segments[2].point = fromPoint.add(
        startDir.rotate(-arrowAngle).multiply(arrowSize)
      );
    }
  }
};

// Update all connectors for a shape
export const updateConnectorsForShape = (shape) => {
  const shapeId = shape.data?.shapeId;
  if (!shapeId) return;

  paper.project
    .getItems({
      match: (item) =>
        item.data?.type === "connector" &&
        (item.data.fromShapeId === shapeId || item.data.toShapeId === shapeId),
    })
    .forEach(updateConnector);
};
