import paper from "paper";
import { useStore } from "../../store";
import { saveCanvasState } from "./utils";
import { updateConnector } from "./connectors";
import { clearSelectionBox } from "./selection";

// Export SVG handler
export const createExportSVGHandler = (saveState) => () => {
  paper.project.deselectAll();
  paper.project
    .getItems({ match: (item) => item.data?.type === "selectionUI" })
    .forEach((item) => item.remove());

  const resolvedTheme = useStore.getState().resolvedTheme;
  const bgColor = resolvedTheme === "dark" ? "#0f0f0f" : "#f8fafc";
  const bounds = paper.project.activeLayer.bounds;
  const exportBounds = bounds.expand(40);

  const bgRect = new paper.Path.Rectangle({
    rectangle: exportBounds,
    fillColor: bgColor,
  });
  bgRect.sendToBack();

  const svg = paper.project.exportSVG({ asString: true });
  bgRect.remove();

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `touchflow-${new Date().toISOString().slice(0, 10)}.svg`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

// Export JSON handler
export const createExportJSONHandler = () => () => {
  paper.project.deselectAll();
  paper.project
    .getItems({ match: (item) => item.data?.type === "selectionUI" })
    .forEach((item) => item.remove());

  const json = paper.project.exportJSON();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `touchflow-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

// Import JSON handler
export const createImportJSONHandler = (saveState) => (e) => {
  const json = e.detail?.json;
  if (!json) return;
  try {
    paper.project.clear();
    paper.project.importJSON(json);
    saveCanvasState(saveState);
  } catch (err) {
    console.error("Failed to import JSON:", err);
    alert("Failed to import diagram.");
  }
};

// Delete handler
export const createDeleteHandler = (saveState, setHasSelection) => () => {
  const selected = paper.project.getItems({
    selected: true,
    match: (item) =>
      item.data?.type === "shape" ||
      item.data?.type === "text" ||
      item.data?.type === "drawing" ||
      item.data?.type === "connector",
  });

  if (selected.length === 0) return;

  selected.forEach((item) => {
    if (item.data?.type === "shape") {
      const shapeId = item.data.shapeId;
      // Remove connected connectors
      paper.project
        .getItems({
          match: (c) =>
            c.data?.type === "connector" &&
            (c.data.fromShapeId === shapeId || c.data.toShapeId === shapeId),
        })
        .forEach((c) => c.remove());
      // Remove attached text
      paper.project
        .getItems({
          match: (t) =>
            t.data?.type === "text" && t.data.attachedToShapeId === shapeId,
        })
        .forEach((t) => t.remove());
    }
  });

  selected.forEach((item) => item.remove());
  clearSelectionBox();
  setHasSelection(false);
  saveCanvasState(saveState);
};

// Clear canvas handler
export const createClearCanvasHandler = (saveState) => () => {
  paper.project.clear();
  saveCanvasState(saveState);
};

// Theme change handler
export const createThemeChangeHandler = (saveState, loadingState) => () => {
  const resolvedTheme = useStore.getState().resolvedTheme;
  const shapeStrokeColor = resolvedTheme === "dark" ? "#e2e8f0" : "#334155";
  const textColor = resolvedTheme === "dark" ? "#f1f5f9" : "#1e293b";

  paper.project
    .getItems({ match: (item) => item.data?.type === "shape" })
    .forEach((shape) => {
      shape.strokeColor = shapeStrokeColor;
    });

  paper.project
    .getItems({ match: (item) => item.data?.type === "text" })
    .forEach((text) => {
      text.fillColor = textColor;
    });

  if (!loadingState.current && paper.project.activeLayer.children.length > 0) {
    saveCanvasState(saveState);
  }
};

// Stroke width change handler
export const createStrokeWidthChangeHandler =
  (saveState, loadingState) => (e) => {
    const newWidth = e.detail?.width || useStore.getState().strokeWidth;
    const resolvedTheme = useStore.getState().resolvedTheme;
    const shapeStrokeColor = resolvedTheme === "dark" ? "#e2e8f0" : "#334155";

    paper.project
      .getItems({ match: (item) => item.data?.type === "shape" })
      .forEach((shape) => {
        shape.strokeWidth = newWidth;
        shape.strokeColor = shapeStrokeColor;
      });

    if (
      !loadingState.current &&
      paper.project.activeLayer.children.length > 0
    ) {
      saveCanvasState(saveState);
    }
  };

// Connector style change handler
export const createConnectorStyleChangeHandler =
  (saveState, loadingState) => () => {
    const newStyle = useStore.getState().connectorStyle;

    paper.project
      .getItems({ match: (item) => item.data?.type === "connector" })
      .forEach((connectorGroup) => {
        connectorGroup.data.style = newStyle;
        updateConnector(connectorGroup);
      });

    if (
      !loadingState.current &&
      paper.project.activeLayer.children.length > 0
    ) {
      saveCanvasState(saveState);
    }
  };
