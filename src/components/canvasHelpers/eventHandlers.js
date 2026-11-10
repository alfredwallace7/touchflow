import paper from "paper";
import { diagramJSON, getAllSelectableItems, getDiagramBounds, getSelectedItems } from "./utils.js";
import { connectorColors } from "./connectors.js";

export const diagramFileName = (extension) => `touchflow-${new Date().toISOString().slice(0, 10)}.${extension}`;

export function downloadDiagram(content, type, extension) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = diagramFileName(extension);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSVG(theme) {
  const bounds = (getDiagramBounds() ?? new paper.Rectangle(0, 0, 1, 1)).expand(40);
  const decorations = paper.project.layers.flatMap((layer) =>
    layer.children.filter(({ data, visible }) => visible && ["preview", "selectionUI"].includes(data.type)));
  const background = new paper.Path.Rectangle({
    rectangle: bounds, fillColor: theme === "dark" ? "#0f0f0f" : "#f8fafc", insert: false,
  });
  paper.project.layers[0].insertChild(0, background);
  try {
    for (const item of decorations) item.visible = false;
    const svg = paper.project.exportSVG({ bounds, matrix: new paper.Matrix(), precision: 6 });
    // Paper.js includes invisible items with a visibility attribute.
    svg.querySelectorAll('[visibility="hidden"]').forEach((element) => element.remove());
    downloadDiagram(new XMLSerializer().serializeToString(svg), "image/svg+xml", "svg");
  } finally {
    background.remove();
    for (const item of decorations) item.visible = true;
  }
}

export const exportJSON = () => downloadDiagram(diagramJSON(), "application/json", "json");

export function deleteSelection() {
  const selected = new Set(getSelectedItems());
  const shapeIds = new Set([...selected].filter((item) => item.data.type === "shape").map((item) => item.data.shapeId));
  for (const item of getAllSelectableItems()) {
    const { fromShapeId, toShapeId, attachedToShapeId } = item.data;
    if (selected.has(item) || shapeIds.has(fromShapeId) || shapeIds.has(toShapeId) || shapeIds.has(attachedToShapeId)) {
      item.remove();
    }
  }
  return selected.size > 0;
}

export function applyCanvasTheme(theme) {
  const dark = theme === "dark";
  const colors = connectorColors(theme);
  for (const item of getAllSelectableItems()) {
    switch (item.data.type) {
      case "shape":
      case "drawing":
        item.strokeColor = dark ? "#e2e8f0" : "#334155";
        break;
      case "text":
        item.fillColor = dark ? "#f1f5f9" : "#1e293b";
        break;
      case "connector":
        item.children[0].strokeColor = colors.line;
        item.children.slice(1).forEach((arrow) => { arrow.fillColor = colors.arrow; });
        break;
    }
  }
}
