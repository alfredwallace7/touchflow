import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import paper from "paper";
import { parseDiagram } from "../src/diagram.js";
import { createConnector, geometryUpdater } from "../src/components/canvasHelpers/connectors.js";
import { deleteSelection } from "../src/components/canvasHelpers/eventHandlers.js";
import { createMarquee } from "../src/components/canvasHelpers/marquee.js";
import { anchorZoom } from "../src/components/canvasHelpers/pointerGestures.js";
import { recognizeShape, resizeShape } from "../src/components/canvasHelpers/shapes.js";
import {
  diagramJSON, findItemAtPoint, getAllSelectableItems, loadDiagram,
} from "../src/components/canvasHelpers/utils.js";
import { useStore } from "../src/store.js";

beforeEach(() => {
  paper.project?.remove();
  paper.setup([400, 500]);
});

function rectangle(id, x, y) {
  return new paper.Path.Rectangle({
    rectangle: [x, y, 80, 50], strokeWidth: 2, strokeColor: "black",
    data: { type: "shape", shapeType: "rectangle", shapeId: id },
  });
}

test("recognizes closed circles, squares and triangles without snapping open strokes", () => {
  const circle = Array.from({ length: 31 }, (_, i) =>
    [Math.cos(i * Math.PI / 15) * 42, Math.sin(i * Math.PI / 15) * 40]);
  const square = [[0, 0], [40, 0], [80, 0], [80, 80], [0, 80], [0, 1]];
  const triangle = [[0, 0], [75, 42], [10, 85], [0, 0]];
  for (const [type, segments] of [["circle", circle], ["rectangle", square], ["triangle", triangle]]) {
    const stroke = new paper.Path({ segments });
    const shape = recognizeShape(stroke);
    assert.equal(shape?.data.shapeType, type);
    assert.ok(Math.abs(shape.bounds.width - stroke.bounds.width) < 4);
    assert.equal(stroke.closed, false);
  }
  assert.equal(recognizeShape(new paper.Path(square.slice(0, -1))), null);
  assert.equal(recognizeShape(new paper.Path(square.map(([x, y]) => [x / 8, y / 8])), 1), null);
  assert.equal(recognizeShape(new paper.Path(square.map(([x, y]) => [x / 8, y / 8])), 3)?.data.shapeType, "rectangle");
});

test("navigation preserves the point under the pinch centroid and resize retains its anchor", () => {
  const { view } = paper;
  const anchor = view.viewToProject(new paper.Point(100, 150));
  anchorZoom(view, 2, new paper.Point(175, 200), anchor);
  assert.ok(view.projectToView(anchor).isClose([175, 200], 1e-7));
  anchorZoom(view, 20, new paper.Point(20, 60), anchor);
  assert.equal(view.zoom, 4);
  assert.ok(view.projectToView(anchor).isClose([20, 60], 1e-7));

  const item = rectangle("a", 12, 35);
  const bounds = item.bounds.clone();
  resizeShape(item, bounds, bounds.topLeft, "bottomRight", bounds.topLeft.add([160, 100]), 2);
  assert.ok(item.bounds.topLeft.isClose(bounds.topLeft, 1e-7));
  assert.equal(item.bounds.width / item.bounds.height, 80 / 50);
});

test("straight arrows align with their path, reverse links merge once and follow moved shapes", () => {
  useStore.setState({ connectorStyle: "straight" });
  const a = rectangle("a", 20, 20);
  const b = rectangle("b", 200, 95);
  assert.equal(createConnector(a, b), true);
  assert.equal(createConnector(a, b), false);
  assert.equal(createConnector(b, a), true);
  assert.equal(createConnector(b, a), false);
  const [link] = getAllSelectableItems().filter(({ data }) => data.type === "connector");
  const [line, end, start] = link.children;
  assert.equal(link.data.bidirectional, true);
  assert.deepEqual(line.dashArray, []);
  assert.ok(end.segments[1].point.equals(line.lastSegment.point));
  assert.ok(start.segments[1].point.equals(line.firstSegment.point));
  const arrowBase = end.segments[0].point.add(end.segments[2].point).divide(2);
  const arrow = end.segments[1].point.subtract(arrowBase).normalize();
  assert.ok(arrow.isClose(line.lastSegment.point.subtract(line.firstSegment.point).normalize(), 1e-7));
  const label = new paper.PointText({ content: "Label", data: { type: "text", attachedToShapeId: "a" } });
  const move = geometryUpdater(getAllSelectableItems(), [a, b]);
  a.translate([0, 30]);
  b.translate([15, 20]);
  move();
  assert.ok(label.position.isClose(a.bounds.center, 1e-7));
  assert.ok(end.segments[1].point.equals(line.lastSegment.point));
  a.selected = true;
  assert.ok(deleteSelection());
  assert.deepEqual(getAllSelectableItems(), [b]);
});

test("curved links anchor to a triangle edge and align the arrow with the endpoint tangent", () => {
  useStore.setState({ connectorStyle: "bezier" });
  const triangle = new paper.Path({
    segments: [[0, 100], [50, 0], [100, 100]],
    closed: true, strokeWidth: 2,
    data: { type: "shape", shapeType: "triangle", shapeId: "triangle" },
  });
  const destination = rectangle("destination", 200, 90);
  createConnector(triangle, destination);
  const [line, arrow] = getAllSelectableItems().find(({ data }) => data.type === "connector").children;
  assert.ok(line.firstSegment.point.isClose([76, 50], 1e-7));
  const back = arrow.segments[0].point.add(arrow.segments[2].point).divide(2).subtract(arrow.segments[1].point);
  assert.ok(back.normalize().isClose(line.lastSegment.handleIn.normalize(), 1e-7));
});

test("overlapping shapes respect paint order, marquee includes labels and snapshots omit transient paths", () => {
  const lower = rectangle("lower", 20, 20);
  const upper = rectangle("upper", 30, 30);
  const label = new paper.PointText({ point: [60, 100], content: "Text", data: { type: "text" } });
  assert.equal(findItemAtPoint(new paper.Point(50, 50)), upper);
  const marquee = createMarquee(new paper.Point(12, 12));
  marquee.move(new paper.Point(160, 130));
  marquee.select();
  assert.ok(lower.selected && upper.selected && label.selected);
  const snapshot = diagramJSON();
  assert.doesNotMatch(snapshot, /selectionUI|"selected"/);
  assert.ok(upper.selected);
  marquee.remove();
  loadDiagram(snapshot);
  assert.equal(diagramJSON(), snapshot);
  assert.equal(paper.project.selectedItems.length, 0);
});

test("malformed imports preserve the active document and blank legacy layers restore", () => {
  rectangle("a", 20, 30);
  const snapshot = diagramJSON();
  for (const invalid of [
    "{", "{}", '[["Raster",{"source":"https://example.org"}]]',
    '[["Layer",{"data":{"__proto__":{"bad":true}}}]]',
    '[["Layer",{"children":[["Path",{"data":{"type":"shape","shapeId":"a"},"segments":[[1e999,0]]}]]}]]',
  ]) {
    assert.throws(() => loadDiagram(invalid));
    assert.equal(diagramJSON(), snapshot);
  }
  loadDiagram('[["Layer",{"applyMatrix":true}]]');
  assert.equal(getAllSelectableItems().length, 0);
});

test("history deduplicates edits, supports clearing and truncates a redone branch", () => {
  useStore.setState({ history: ["[]"], historyIndex: 0 });
  const { saveState, undo, redo } = useStore.getState();
  rectangle("a", 1, 2);
  const diagram = diagramJSON();
  saveState(diagram);
  saveState(diagram);
  assert.equal(useStore.getState().history.length, 2);
  saveState("[]");
  undo();
  assert.equal(useStore.getState().history[useStore.getState().historyIndex], diagram);
  redo();
  assert.equal(useStore.getState().historyIndex, 2);
  undo();
  rectangle("b", 20, 40);
  saveState(diagramJSON());
  redo();
  assert.equal(useStore.getState().history.length, 3);
  assert.equal(useStore.getState().historyIndex, 2);
});

test("large diagrams round-trip with their shape IDs and links", () => {
  for (let i = 0; i < 800; i++) rectangle(`shape-${i}`, (i % 25) * 120, Math.floor(i / 25) * 80);
  const items = getAllSelectableItems();
  for (let i = 0; i < 100; i++) createConnector(items[i], items[i + 1]);
  const snapshot = diagramJSON();
  assert.equal(parseDiagram(snapshot)[0][1].children.length, 900);
  loadDiagram(snapshot);
  assert.equal(diagramJSON(), snapshot);
});
