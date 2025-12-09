import paper from "paper";

// Marquee selection state
let isMarqueeSelecting = false;
let marqueeStartPoint = null;
let marqueeRect = null;

export const startMarquee = (viewPoint) => {
  isMarqueeSelecting = true;
  marqueeStartPoint = viewPoint;
};

export const updateMarquee = (currentPoint) => {
  if (!isMarqueeSelecting || !marqueeStartPoint) return;

  // Remove old marquee rectangle
  if (marqueeRect) {
    marqueeRect.remove();
  }

  // Draw new marquee rectangle
  marqueeRect = new paper.Path.Rectangle({
    from: marqueeStartPoint,
    to: currentPoint,
    strokeColor: "#6366f1",
    strokeWidth: 1,
    dashArray: [4, 4],
    fillColor: new paper.Color(99 / 255, 102 / 255, 241 / 255, 0.1),
  });
  marqueeRect.data = { type: "selectionUI" };
};

export const endMarquee = (endPoint, setHasSelection, updateSelectionBox) => {
  if (!isMarqueeSelecting) return [];

  let selectedItems = [];

  if (marqueeRect && marqueeStartPoint) {
    // Create selection bounds
    const selectionBounds = new paper.Rectangle(marqueeStartPoint, endPoint);

    // Find all selectable items within bounds
    const selectableItems = paper.project.getItems({
      match: (item) =>
        (item.data?.type === "shape" ||
          item.data?.type === "connector" ||
          item.data?.type === "drawing") &&
        selectionBounds.intersects(item.bounds),
    });

    // Add found items to selection
    selectableItems.forEach((item) => {
      item.selected = true;
    });

    // Count total selected items
    const allSelected = paper.project.getItems({
      selected: true,
      match: (item) =>
        item.data?.type === "shape" ||
        item.data?.type === "connector" ||
        item.data?.type === "drawing",
    });

    if (allSelected.length > 0) {
      setHasSelection(true);
      // Show selection box only for single item
      if (allSelected.length === 1) {
        updateSelectionBox(allSelected[0]);
      }
    }

    selectedItems = allSelected;

    // Remove marquee rectangle
    marqueeRect.remove();
    marqueeRect = null;
  }

  isMarqueeSelecting = false;
  marqueeStartPoint = null;

  return selectedItems;
};

export const isMarqueeActive = () => isMarqueeSelecting;

export const cancelMarquee = () => {
  if (marqueeRect) {
    marqueeRect.remove();
    marqueeRect = null;
  }
  isMarqueeSelecting = false;
  marqueeStartPoint = null;
};
