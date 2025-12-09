import paper from "paper";

// Selection box state (module-level for persistence across calls)
let selectionBox = null;
let selectionHandles = [];

// Create/update selection box around an item
export const updateSelectionBox = (item, visible = true) => {
  clearSelectionBox();

  if (!item || !visible) return;

  const b = item.bounds;
  const handleSize = 8;
  const strokeColor = "#6366f1";

  // Create bounding box rectangle (dashed)
  selectionBox = new paper.Path.Rectangle({
    rectangle: b,
    strokeColor: strokeColor,
    strokeWidth: 1,
    dashArray: [4, 4],
    fillColor: null,
  });
  selectionBox.data = { type: "selectionUI" };

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
      strokeWidth: 1.5,
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

  // Also remove any orphaned selection UI items from the project
  paper.project
    .getItems({ match: (item) => item.data?.type === "selectionUI" })
    .forEach((item) => item.remove());
};

// Check if point is near a selection handle
export const getHandleAtPoint = (item, point) => {
  if (!item?.bounds) return null;
  const b = item.bounds;
  const handleSize = 25 / paper.view.zoom;

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

  for (const h of handles) {
    if (point.getDistance(h.point) < handleSize) {
      return h.name;
    }
  }
  return null;
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
