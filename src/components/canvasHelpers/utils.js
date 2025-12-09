import paper from "paper";

// Generate unique IDs for shapes
export const generateId = () =>
  `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper to save state without selection UI elements
export const saveCanvasState = (saveStateFn) => {
  // Temporarily hide selection UI elements
  const selectionUI = paper.project.getItems({
    match: (item) => item.data?.type === "selectionUI",
  });
  selectionUI.forEach((item) => (item.visible = false));

  saveStateFn(paper.project.exportJSON());

  // Restore selection UI visibility
  selectionUI.forEach((item) => (item.visible = true));
};

// Debounced save - reduces storage writes during rapid operations
let saveTimeout = null;
export const saveCanvasStateDebounced = (saveStateFn, delay = 300) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveCanvasState(saveStateFn);
    saveTimeout = null;
  }, delay);
};

// Find shape by custom shapeId
export const findShapeById = (shapeId) => {
  const items = paper.project.getItems({
    match: (item) => item.data && item.data.shapeId === shapeId,
  });
  return items[0] || null;
};

// Get all selectable items (shapes, text, drawings, connectors)
export const getAllSelectableItems = () => {
  return paper.project.getItems({
    match: (item) =>
      item.data &&
      (item.data.type === "shape" ||
        item.data.type === "text" ||
        item.data.type === "drawing" ||
        item.data.type === "connector"),
  });
};

// Find selectable item at point
export const findItemAtPoint = (point) => {
  const items = getAllSelectableItems();
  for (const item of items) {
    // For text items, use bounds check
    if (item.className === "PointText") {
      if (
        item.bounds.contains(point) ||
        item.bounds.expand(10).contains(point)
      ) {
        return item;
      }
    } else if (item.data?.type === "connector") {
      // For connectors (groups), check the path child
      const path = item.children?.[0];
      if (path && path.hitTest(point, { stroke: true, tolerance: 20 })) {
        return item;
      }
    } else if (item.contains && item.contains(point)) {
      return item;
    } else if (
      item.hitTest &&
      item.hitTest(point, { stroke: true, tolerance: 15 })
    ) {
      return item;
    }
  }
  return null;
};
