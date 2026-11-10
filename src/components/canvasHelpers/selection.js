import paper from "paper";

// Selection box state (module-level for persistence across calls)
let selectionBox = null;
let selectionHandles = [];

// Create/update selection box around an item
export const updateSelectionBox = (item, visible = true) => {
  clearSelectionBox();

  if (!item || !visible) return;

  const b = item.bounds;
  const handleSize = 8 / paper.view.zoom;
  const strokeColor = "#6366f1";

  // Create bounding box rectangle (dashed)
  selectionBox = new paper.Path.Rectangle({
    rectangle: b,
    strokeColor: strokeColor,
    strokeWidth: 1 / paper.view.zoom,
    dashArray: [4 / paper.view.zoom, 4 / paper.view.zoom],
    fillColor: null,
  });
  selectionBox.data = { type: "selectionUI" };
  if (Math.min(b.width, b.height) * paper.view.zoom < 24) return;

  // Handle positions: corners and edge centers
  const handlePositions = [
    { name: "topLeft", point: b.topLeft },
    { name: "topRight", point: b.topRight },
    { name: "bottomLeft", point: b.bottomLeft },
    { name: "bottomRight", point: b.bottomRight },
    { name: "topCenter", point: b.topCenter },
    { name: "rightCenter", point: b.rightCenter },
    { name: "bottomCenter", point: b.bottomCenter },
    { name: "leftCenter", point: b.leftCenter },
  ];

  handlePositions.forEach((h) => {
    const handle = new paper.Path.Rectangle({
      point: [h.point.x - handleSize / 2, h.point.y - handleSize / 2],
      size: [handleSize, handleSize],
      fillColor: "white",
      strokeColor: strokeColor,
      strokeWidth: 1.5 / paper.view.zoom,
    });
    handle.data = { type: "selectionUI", handleName: h.name };
    selectionHandles.push(handle);
  });
};

// Clear selection box
export const clearSelectionBox = () => {
  // Remove tracked items
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }
  selectionHandles.forEach((h) => h.remove());
  selectionHandles = [];

};

// Check if point is near a selection handle
export const getHandleAtPoint = (item, point, pointerType) => {
  if (!item?.bounds) return null;
  const b = item.bounds;
  if (Math.min(b.width, b.height) * paper.view.zoom < 24) return null;
  const radius = Math.min((pointerType === "mouse" ? 8 : 16) / paper.view.zoom, Math.min(b.width, b.height) * 0.4);

  const handles = [
    { name: "topLeft", point: b.topLeft },
    { name: "topRight", point: b.topRight },
    { name: "bottomLeft", point: b.bottomLeft },
    { name: "bottomRight", point: b.bottomRight },
    { name: "topCenter", point: b.topCenter },
    { name: "rightCenter", point: b.rightCenter },
    { name: "bottomCenter", point: b.bottomCenter },
    { name: "leftCenter", point: b.leftCenter },
  ];

  let nearest = null;
  let best = radius;
  for (const handle of handles) {
    const distance = point.getDistance(handle.point);
    if (distance < best) {
      best = distance;
      nearest = handle.name;
    }
  }
  return nearest;
};

// Get the anchor point opposite to the handle
export const getAnchorForHandle = (bounds, handleName) => {
  switch (handleName) {
    case "topLeft":
      return bounds.bottomRight;
    case "topRight":
      return bounds.bottomLeft;
    case "bottomLeft":
      return bounds.topRight;
    case "bottomRight":
      return bounds.topLeft;
    case "topCenter":
      return bounds.bottomCenter;
    case "bottomCenter":
      return bounds.topCenter;
    case "leftCenter":
      return bounds.rightCenter;
    case "rightCenter":
      return bounds.leftCenter;
    default:
      return bounds.center;
  }
};
