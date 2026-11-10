import paper from "paper";
import { parseDiagram } from "../../diagram.js";

export const generateId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `shape_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

export const isSelectable = (item) =>
  ["shape", "text", "drawing", "connector"].includes(item.data?.type);

export const getAllSelectableItems = () =>
  paper.project.layers.flatMap((layer) => layer.children.filter(isSelectable));

export const getSelectedItems = () => paper.project.selectedItems.filter(isSelectable);

export const findShapeById = (shapeId) =>
  getAllSelectableItems().find((item) => item.data.shapeId === shapeId);

export const getDiagramBounds = () => getAllSelectableItems().reduce(
  (bounds, item) => bounds ? bounds.unite(item.strokeBounds) : item.strokeBounds,
  null
);

export const diagramJSON = () => {
  const layers = paper.project.exportJSON({ asString: false, precision: 8 });
  const clean = ([, props]) => {
    delete props.selected;
    delete props.dashOffset;
    if (props.children) {
      props.children = props.children.filter(([, child]) =>
        !["selectionUI", "preview"].includes(child.data?.type));
      props.children.forEach(clean);
    }
  };
  layers.forEach(clean);
  return JSON.stringify(layers);
};

export const saveCanvasState = (saveState) => saveState(diagramJSON());

export function loadDiagram(json) {
  const data = parseDiagram(json);
  const project = paper.project;
  const staged = new paper.Project();
  try {
    staged.importJSON(data);
    const layers = [...staged.layers];
    project.clear();
    layers.forEach((layer) => project.addLayer(layer));
    project.activeLayer;
  } finally {
    staged.remove();
    project.activate();
  }
}

export const findItemAtPoint = (point) => {
  const tolerance = 10 / paper.view.zoom;
  const items = getAllSelectableItems();
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (!item.visible || !item.strokeBounds.expand(tolerance * 2).contains(point)) continue;
    if (item.className === "PointText") return item;
    if (item.data.type === "connector") {
      if (item.children.some((path) => path.hitTest(point, { fill: true, stroke: true, tolerance }))) return item;
    } else if (item.contains(point) || item.hitTest(point, { stroke: true, tolerance })) {
      return item;
    }
  }
  return null;
};
