import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import paper from "paper";
import { useStore, useSaveStatus } from "../store.js";
import {
  generateId, saveCanvasState, diagramJSON, loadDiagram, findShapeById,
  findItemAtPoint, getAllSelectableItems, getSelectedItems, getDiagramBounds,
  createConnector, geometryUpdater, updateSelectionBox, clearSelectionBox,
  getHandleAtPoint, getAnchorForHandle, recognizeShape, resizeShape, createMarquee,
  exportSVG, exportJSON, deleteSelection, applyCanvasTheme,
} from "./canvasHelpers";
import { anchorZoom, bindPointerGestures, clampZoom } from "./canvasHelpers/pointerGestures.js";

export default function Canvas() {
  const canvasRef = useRef(null);
  const editorRef = useRef(null);
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const saveMessage = useSaveStatus((state) => state.message);

  useLayoutEffect(() => {
    if (editing) inputRef.current?.focus({ preventScroll: true });
  }, [editing]);

  const closeEditor = (commit) => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = inputRef.current?.value.trim();
    editorRef.current = null;
    setEditing(null);
    if (!commit || text === editor.item?.content || (!text && !editor.item)) return;
    if (!text) editor.item.remove();
    else if (editor.item) {
      editor.item.content = text;
      if (editor.shape) editor.item.position = editor.shape.bounds.center;
    } else {
      const label = new paper.PointText({
        point: editor.point, content: text,
        fillColor: useStore.getState().resolvedTheme === "dark" ? "#f1f5f9" : "#1e293b",
        fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 500,
        justification: "center",
        data: { type: "text", attachedToShapeId: editor.shape?.data.shapeId, textId: generateId() },
      });
      if (editor.shape) label.position = editor.shape.bounds.center;
    }
    saveCanvasState(useStore.getState().saveState);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    paper.setup(canvas);
    const { project, view } = paper;
    const resize = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width > 0 && height > 0) view.viewSize = new paper.Size(width, height);
    });
    resize.observe(canvas);
    const commit = () => saveCanvasState(useStore.getState().saveState);
    const theme = () => useStore.getState().resolvedTheme;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let animated = [];
    let offset = 0;
    let active = false;
    let rect;
    let gesture;
    let navigation;

    const refreshAnimation = () => {
      const items = getAllSelectableItems();
      animated = items.length <= 250
        ? items.filter(({ data }) => data.type === "connector" && !data.bidirectional)
        : [];
      view.onFrame = !motion.matches && animated.length ? ({ delta }) => {
        if (active || document.hidden) return;
        offset = (offset - Math.min(delta, 0.05) * 25) % 12;
        const visible = view.bounds;
        for (const group of animated) {
          if (group.bounds.intersects(visible)) group.children[0].dashOffset = offset;
        }
      } : null;
      if (motion.matches) animated.forEach((group) => { group.children[0].dashOffset = 0; });
    };
    motion.addEventListener("change", refreshAnimation);

    const selection = () => {
      const selected = getSelectedItems();
      updateSelectionBox(selected.length === 1 && selected[0].data.type === "shape" ? selected[0] : null);
      window.dispatchEvent(new CustomEvent("selection-changed", { detail: { hasSelection: selected.length > 0 } }));
    };
    const clearSelection = () => {
      project.deselectAll();
      selection();
    };
    const selectItem = (item, additive = false) => {
      if (additive && item) item.selected = !item.selected;
      else if (!item?.selected) {
        project.deselectAll();
        if (item) item.selected = true;
      }
      selection();
    };
    const screen = ({ x, y }) => new paper.Point(x - rect.left, y - rect.top);
    const world = (point) => view.viewToProject(screen(point));
    const target = (item) => item?.data.attachedToShapeId
      ? findShapeById(item.data.attachedToShapeId) ?? item
      : item;

    const openEditor = (location, hit) => {
      const item = hit?.data.type === "text" ? hit : null;
      const parent = target(hit);
      const shape = parent?.data.type === "shape" ? parent : null;
      const label = item ?? (shape && getAllSelectableItems().find(({ data }) =>
        data.attachedToShapeId === shape.data.shapeId));
      const editor = { item: label, shape, point: shape?.bounds.center ?? label?.position ?? location };
      editorRef.current = editor;
      const position = view.projectToView(editor.point);
      setEditing({
        x: Math.max(0, Math.min(100, 100 * position.x / view.viewSize.width)),
        y: position.y,
        text: label?.content ?? "",
      });
    };

    const router = bindPointerGestures(canvas, {
      isEditing: () => !!editorRef.current,
      start(point, event) {
        active = true;
        canvas.focus({ preventScroll: true });
        rect = canvas.getBoundingClientRect();
        const start = world(point);
        gesture = { start };
        if (event.button === 1 || event.button === 2 || event.ctrlKey) {
          gesture.center = view.center.clone();
          gesture.screenStart = screen(point);
          return "pan";
        }
        const [item, other] = getSelectedItems();
        const handle = !event.shiftKey && !other && item?.data.type === "shape"
          ? getHandleAtPoint(item, start, event.pointerType) : null;
        if (handle) {
          const bounds = item.bounds.clone();
          const anchor = getAnchorForHandle(bounds, handle);
          const handleOffset = bounds.center.multiply(2).subtract(anchor).subtract(start);
          const update = geometryUpdater(getAllSelectableItems(), [item]);
          Object.assign(gesture, {
            item, bounds, anchor, handle, handleOffset, update,
            rollback: () => { item.bounds = bounds; update(); },
          });
          return "resize";
        }
        gesture.from = target(findItemAtPoint(start));
        return "draw";
      },
      press() {
        const { from, start } = gesture;
        if (!from) {
          clearSelectionBox();
          gesture.marquee = createMarquee(start);
          return "marquee";
        }
        selectItem(from);
        if (from.data.type === "connector") return "hold";
        const items = getSelectedItems().filter(({ data }) => data.type !== "connector" && !data.attachedToShapeId);
        const origins = items.map((item) => item.position.clone());
        const update = geometryUpdater(getAllSelectableItems(), items);
        gesture.translate = (delta) => {
          items.forEach((item, index) => { item.position = origins[index].add(delta); });
          update();
        };
        gesture.rollback = () => gesture.translate(new paper.Point(0, 0));
        clearSelectionBox();
        return "move";
      },
      move(mode, samples) {
        const last = samples.at(-1);
        const point = world(last);
        switch (mode) {
          case "draw": {
            if (!gesture.path) {
              gesture.path = new paper.Path({
                segments: [gesture.start], strokeColor: theme() === "dark" ? "#cbd5e1" : "#64748b",
                strokeWidth: useStore.getState().strokeWidth,
                strokeCap: "round", strokeJoin: "round", data: { type: "preview" },
              });
            }
            for (const sample of samples) {
              const next = world(sample);
              if (gesture.path.segments.length >= 8192) {
                // Keep bounded memory for very long strokes while retaining their endpoint.
                gesture.path.lastSegment.point = next;
              } else if (gesture.path.lastSegment.point.getDistance(next) * view.zoom >= 1.5) {
                gesture.path.add(next);
              }
            }
            break;
          }
          case "resize":
            clearSelectionBox();
            resizeShape(gesture.item, gesture.bounds, gesture.anchor, gesture.handle, point.add(gesture.handleOffset), view.zoom);
            gesture.update();
            break;
          case "move":
            gesture.translate(point.subtract(gesture.start));
            break;
          case "marquee":
            gesture.marquee.move(point);
            break;
          case "pan":
            view.center = gesture.center.subtract(screen(last).subtract(gesture.screenStart).divide(view.zoom));
            break;
        }
      },
      tap(point, event) {
        active = false;
        gesture = null;
        selectItem(target(findItemAtPoint(world(point))), event.shiftKey);
      },
      doubleTap(point) {
        active = false;
        gesture = null;
        const location = world(point);
        openEditor(location, findItemAtPoint(location));
      },
      end(mode, point, moved) {
        active = false;
        if (mode === "marquee" && moved) gesture.marquee.select();
        gesture.marquee?.remove();
        if (mode === "draw" && gesture.path) {
          const path = gesture.path;
          const to = target(findItemAtPoint(world(point)));
          const from = gesture.from;
          if (from?.data.type === "shape" && to?.data.type === "shape" && from !== to) {
            path.remove();
            if (createConnector(from, to)) commit();
          } else if (recognizeShape(path, view.zoom)) {
            path.remove();
            commit();
          } else if (path.segments.length > 1) {
            path.simplify(1.2 / view.zoom);
            path.data.type = "drawing";
            path.strokeColor = theme() === "dark" ? "#e2e8f0" : "#334155";
            commit();
          } else path.remove();
        }
        if (moved && (mode === "move" || mode === "resize")) commit();
        gesture = null;
        selection();
      },
      cancel() {
        gesture?.rollback?.();
        gesture?.path?.remove();
        gesture?.marquee?.remove();
        gesture = null;
        navigation = null;
        active = false;
        selection();
      },
      startNavigation({ center, distance }) {
        active = true;
        clearSelectionBox();
        navigation = { anchor: world(center), distance, zoom: view.zoom };
      },
      navigate({ center, distance }) {
        anchorZoom(view, navigation.zoom * distance / navigation.distance, screen(center), navigation.anchor);
      },
      endNavigation() {
        active = false;
        navigation = null;
        selection();
      },
    });

    const load = (json) => {
      loadDiagram(json);
      applyCanvasTheme(theme());
      clearSelection();
      refreshAnimation();
    };
    const { history, historyIndex } = useStore.getState();
    try {
      load(history[historyIndex]);
    } catch {
      useSaveStatus.setState({ message: "The saved diagram could not be restored." });
    }
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.history !== previous.history) refreshAnimation();
      else if (state.historyIndex !== previous.historyIndex) {
        router.cancel();
        closeEditor(false);
        load(state.history[state.historyIndex]);
      }
    });

    const handleWheel = (event) => {
      event.preventDefault();
      if (gesture || navigation || editorRef.current || !event.deltaY) return;
      rect = canvas.getBoundingClientRect();
      const cursor = screen({ x: event.clientX, y: event.clientY });
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.viewSize.height : 1);
      anchorZoom(view, view.zoom * Math.exp(-pixels * 0.002), cursor, view.viewToProject(cursor));
      selection();
    };
    const beforeChange = () => {
      closeEditor(true);
      router.cancel();
    };
    const listeners = {
      "fit-screen": () => {
        beforeChange();
        const bounds = getDiagramBounds();
        if (!bounds) return;
        const toolbar = document.querySelector(".toolbar")?.getBoundingClientRect();
        const canvasBounds = canvas.getBoundingClientRect();
        const width = view.viewSize.width;
        const height = Math.max(1, (toolbar?.top ?? canvasBounds.bottom) - canvasBounds.top);
        view.zoom = clampZoom(Math.min(2, width * 0.88 / Math.max(1, bounds.width), height * 0.88 / Math.max(1, bounds.height)));
        view.center = bounds.center.add([0, (view.viewSize.height - height) / (2 * view.zoom)]);
        selection();
      },
      "export-svg": () => { beforeChange(); exportSVG(theme()); },
      "export-json": () => { beforeChange(); exportJSON(); },
      "get-canvas-json": (event) => { beforeChange(); event.detail.receive(diagramJSON()); },
      "import-json": (event) => {
        beforeChange();
        try {
          load(event.detail.json);
          commit();
        } catch {
          alert("This file is not a valid TouchFlow diagram.");
        }
      },
      "delete-selected": () => {
        beforeChange();
        if (deleteSelection()) {
          clearSelection();
          commit();
        }
      },
      "clear-canvas": () => {
        beforeChange();
        if (!getAllSelectableItems().length) return;
        load("[]");
        commit();
      },
      "theme-changed": () => applyCanvasTheme(theme()),
      "stroke-width-changed": (event) => {
        beforeChange();
        const items = getAllSelectableItems();
        const shapes = items.filter(({ data }) => data.type === "shape");
        for (const shape of shapes) shape.strokeWidth = event.detail.width;
        geometryUpdater(items, shapes)();
        if (shapes.length) commit();
      },
      "connector-style-changed": () => {
        beforeChange();
        const items = getAllSelectableItems();
        const links = items.filter(({ data }) => data.type === "connector");
        for (const link of links) link.data.style = useStore.getState().connectorStyle;
        geometryUpdater(items, items)();
        if (links.length) commit();
      },
      keydown: (event) => {
        if (event.defaultPrevented || editorRef.current || event.target.closest?.("input, textarea, [contenteditable], [role=dialog]")) return;
        const key = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
          event.preventDefault();
          if (event.shiftKey || key === "y") useStore.getState().redo();
          else useStore.getState().undo();
          return;
        }
        if (event.target !== canvas) return;
        const pan = { arrowleft: [-60, 0], arrowright: [60, 0], arrowup: [0, -60], arrowdown: [0, 60] };
        if (key === "delete") listeners["delete-selected"]();
        else if (key === "escape") { router.cancel(); clearSelection(); }
        else if (key === "+" || key === "-") {
          router.cancel();
          view.zoom = clampZoom(view.zoom * (key === "+" ? 1.2 : 1 / 1.2));
          selection();
        } else if (pan[key]) {
          router.cancel();
          view.center = view.center.add(new paper.Point(pan[key]).divide(view.zoom));
        } else if (key === "[" || key === "]") {
          router.cancel();
          const items = getAllSelectableItems();
          if (!items.length) return;
          const index = items.indexOf(getSelectedItems()[0]);
          const next = index < 0 ? (key === "]" ? 0 : items.length - 1) :
            (index + (key === "]" ? 1 : items.length - 1)) % items.length;
          const item = items[next];
          selectItem(item);
          if (!view.bounds.contains(item.position)) view.center = item.position;
        } else if (key === "enter") {
          const item = getSelectedItems()[0];
          if (!item || !["shape", "text"].includes(item.data.type)) return;
          openEditor(item.position, item);
        } else return;
        event.preventDefault();
      },
    };
    for (const [event, listener] of Object.entries(listeners)) window.addEventListener(event, listener);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      for (const [event, listener] of Object.entries(listeners)) window.removeEventListener(event, listener);
      canvas.removeEventListener("wheel", handleWheel);
      motion.removeEventListener("change", refreshAnimation);
      resize.disconnect();
      unsubscribe();
      router.remove();
      clearSelectionBox();
      project.remove();
    };
  }, []);

  return (
    <div className="canvas-container">
      <canvas ref={canvasRef} id="main-canvas" tabIndex={0} aria-label="TouchFlow diagram canvas"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown [ ] Enter Delete Escape" />
      {saveMessage && <p className="save-status" role="status">{saveMessage}</p>}
      {editing && (
        <div className="label-editor" style={{ left: `clamp(90px, ${editing.x}%, 100% - 90px)`, top: `clamp(28px, ${editing.y}px, 100% - 90px)` }}>
          <textarea
            ref={inputRef}
            aria-label="Diagram label"
            defaultValue={editing.text}
            onBlur={() => closeEditor(true)}
            onKeyDown={(event) => {
              if (event.isComposing) return;
              if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey)) {
                event.preventDefault();
                closeEditor(event.key === "Enter");
                canvasRef.current.focus({ preventScroll: true });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
