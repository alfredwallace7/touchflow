import { useEffect, useRef, useState } from "preact/hooks";
import paper from "paper";
import Hammer from "hammerjs";
import { useStore } from "../store";
import {
  generateId,
  saveCanvasState,
  saveCanvasStateDebounced,
  findShapeById,
  findItemAtPoint,
  createConnector,
  updateConnectorsForShape,
  updateSelectionBox,
  clearSelectionBox,
  getHandleAtPoint,
  getAnchorForHandle,
  recognizeShape,
  resizeShape,
  createExportSVGHandler,
  createExportJSONHandler,
  createImportJSONHandler,
  createDeleteHandler,
  createClearCanvasHandler,
  createThemeChangeHandler,
  createStrokeWidthChangeHandler,
  createConnectorStyleChangeHandler,
  startMarquee,
  updateMarquee,
  endMarquee,
  isMarqueeActive,
  cancelMarquee,
} from "./canvasHelpers";

const Canvas = () => {
  const canvasRef = useRef(null);
  const { saveState, history, historyIndex } = useStore();
  const loadingState = useRef(false);
  const editingRef = useRef(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [editing, setEditing] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("selection-changed", { detail: { hasSelection } })
    );
  }, [hasSelection]);

  // Initial Setup
  useEffect(() => {
    if (!canvasRef.current) return;
    paper.setup(canvasRef.current);
    paper.settings.handleSize = 8; // Show Paper.js selection handles

    const currentJSON = history[historyIndex];
    if (currentJSON) {
      paper.project.importJSON(currentJSON);
    } else {
      saveCanvasState(saveState);
    }

    // Create event handlers
    const handleExport = createExportSVGHandler(saveState);
    const handleExportJSON = createExportJSONHandler();
    const handleImportJSON = createImportJSONHandler(saveState);
    const handleDelete = createDeleteHandler(saveState, setHasSelection);
    const handleClearCanvas = createClearCanvasHandler(saveState);
    const handleThemeChange = createThemeChangeHandler(saveState, loadingState);
    const handleStrokeWidthChange = createStrokeWidthChangeHandler(
      saveState,
      loadingState
    );
    const handleConnectorStyleChange = createConnectorStyleChangeHandler(
      saveState,
      loadingState
    );

    // Handler to return canvas JSON for sharing
    const handleGetCanvasJSON = () => {
      paper.project.deselectAll();
      paper.project
        .getItems({ match: (item) => item.data?.type === "selectionUI" })
        .forEach((item) => item.remove());
      const json = paper.project.exportJSON();
      window.dispatchEvent(
        new CustomEvent("canvas-json-response", { detail: { json } })
      );
    };

    window.addEventListener("export-svg", handleExport);
    window.addEventListener("get-canvas-json", handleGetCanvasJSON);
    window.addEventListener("export-json", handleExportJSON);
    window.addEventListener("import-json", handleImportJSON);
    window.addEventListener("delete-selected", handleDelete);
    window.addEventListener("clear-canvas", handleClearCanvas);
    window.addEventListener("stroke-width-changed", handleStrokeWidthChange);
    window.addEventListener("theme-changed", handleThemeChange);
    window.addEventListener(
      "connector-style-changed",
      handleConnectorStyleChange
    );

    return () => {
      window.removeEventListener("export-svg", handleExport);
      window.removeEventListener("get-canvas-json", handleGetCanvasJSON);
      window.removeEventListener("export-json", handleExportJSON);
      window.removeEventListener("import-json", handleImportJSON);
      window.removeEventListener("delete-selected", handleDelete);
      window.removeEventListener("clear-canvas", handleClearCanvas);
      window.removeEventListener(
        "stroke-width-changed",
        handleStrokeWidthChange
      );
      window.removeEventListener("theme-changed", handleThemeChange);
      window.removeEventListener(
        "connector-style-changed",
        handleConnectorStyleChange
      );
      paper.project.clear();
    };
  }, []);

  // History Sync
  useEffect(() => {
    if (loadingState.current) return;
    const currentJSON = history[historyIndex];
    if (currentJSON && paper.project) {
      loadingState.current = true;
      paper.project.clear();
      paper.project.importJSON(currentJSON);
      loadingState.current = false;
    }
  }, [historyIndex]);

  // Animate connector dashes - flow towards arrowhead (optimized)
  useEffect(() => {
    let cachedConnectors = [];
    let lastCacheTime = 0;
    const CACHE_INTERVAL = 500; // Refresh connector cache every 500ms

    const onFrame = (event) => {
      // Refresh connector cache periodically (not every frame)
      if (event.time - lastCacheTime > CACHE_INTERVAL / 1000) {
        cachedConnectors = paper.project.getItems({
          match: (item) =>
            item.data?.type === "connector" && !item.data?.bidirectional,
        });
        lastCacheTime = event.time;
      }

      // Early bail if no connectors to animate
      if (cachedConnectors.length === 0) return;

      // Animate each connector's dash offset
      const offset = -(event.time * 25) % 12;
      cachedConnectors.forEach((group) => {
        const connector = group.children?.[0];
        if (connector?.dashArray) {
          connector.dashOffset = offset;
        }
      });
    };

    paper.view.onFrame = onFrame;
    return () => {
      paper.view.onFrame = null;
    };
  }, []);

  // Interaction Setup
  useEffect(() => {
    if (!canvasRef.current) return;

    const hammer = new Hammer.Manager(canvasRef.current);
    hammer.add(new Hammer.Pinch({ enable: true }));
    hammer.add(
      new Hammer.Pan({
        event: "multipan",
        direction: Hammer.DIRECTION_ALL,
        pointers: 2,
        threshold: 10,
      })
    );
    hammer.add(
      new Hammer.Pan({
        event: "singletouchpan",
        direction: Hammer.DIRECTION_ALL,
        pointers: 1,
        threshold: 0,
      })
    );
    hammer.add(
      new Hammer.Tap({ event: "doubletap", taps: 2, posThreshold: 50 })
    );
    hammer.add(new Hammer.Press({ time: 400 }));
    hammer.get("pinch").recognizeWith("multipan");

    const paperTool = new paper.Tool();
    paperTool.activate(); // Ensure tool is active

    // State - declare before handlers that need them
    let currentPath = null;
    let isDragging = false;
    let dragItem = null;
    let hasDragged = false;
    let drawStartPoint = null;
    let gestureInProgress = false;
    let longPressActive = false;
    let initialZoom = 1;
    let initialCenter = null;
    let isPinching = false;
    let isResizing = false;
    let resizeItem = null;
    let resizeAnchor = null;
    let initialBounds = null;
    let resizeHandleName = null;

    // Handler to fit all content on screen
    const handleFitScreen = () => {
      // Clear selection and UI before changing view to prevent artifacts
      paper.project.deselectAll();
      clearSelectionBox();
      setHasSelection(false);

      // Get bounds excluding selection UI
      const contentItems = paper.project.getItems({
        match: (item) => item.data?.type && item.data.type !== "selectionUI",
      });
      if (contentItems.length === 0) return; // No content

      // Calculate bounds manually from content items
      let bounds = null;
      contentItems.forEach((item) => {
        if (bounds) {
          bounds = bounds.unite(item.bounds);
        } else {
          bounds = item.bounds.clone();
        }
      });
      if (!bounds || bounds.isEmpty()) return;

      const view = paper.view;
      const canvas = canvasRef.current;
      const canvasRect = canvas.getBoundingClientRect();

      // Account for toolbar (bottom: 40px + ~50px height + padding)
      const toolbarHeight = 100;
      const paddingX = 40;
      const paddingTop = 40;
      const paddingBottom = toolbarHeight + 20;

      // Available space in view coordinates
      const availableWidth = canvasRect.width - paddingX * 2;
      const availableHeight = canvasRect.height - paddingTop - paddingBottom;

      // Calculate scale to fit content
      const scaleX = availableWidth / bounds.width;
      const scaleY = availableHeight / bounds.height;
      const scale = Math.min(scaleX, scaleY, 2); // Cap at 2x zoom

      // Apply zoom
      view.zoom = scale;

      // Center content, offset slightly up to account for toolbar
      const offsetY = (paddingBottom - paddingTop) / 2 / scale;
      view.center = bounds.center.subtract(new paper.Point(0, offsetY));

      // Force view update and re-activate tool
      view.update();
      paperTool.activate();

      // Reset any stuck gesture state
      gestureInProgress = false;
      isDragging = false;
      dragItem = null;
      isResizing = false;
      resizeItem = null;
      longPressActive = false;
    };

    window.addEventListener("fit-screen", handleFitScreen);

    paperTool.onMouseDown = (event) => {
      if (editingRef.current || gestureInProgress) return;
      if (isDragging && dragItem) return;
      if (isResizing && resizeItem) return;

      // Check for resize handle on selected shapes
      const selectedShapes = paper.project.getItems({
        selected: true,
        match: (item) => item.data?.type === "shape",
      });

      for (const shape of selectedShapes) {
        const handleName = getHandleAtPoint(shape, event.point);
        if (handleName) {
          isResizing = true;
          resizeItem = shape;
          initialBounds = shape.bounds.clone();
          resizeAnchor = getAnchorForHandle(shape.bounds, handleName);
          resizeHandleName = handleName;
          clearSelectionBox();
          return;
        }
      }

      // Desktop click selection: find item at click point
      const clickedItem = findItemAtPoint(event.point);

      if (clickedItem) {
        let targetItem = clickedItem;
        // If clicked on text attached to shape, target the shape
        if (
          clickedItem.data?.type === "text" &&
          clickedItem.data?.attachedToShapeId
        ) {
          const parentShape = findShapeById(clickedItem.data.attachedToShapeId);
          if (parentShape) targetItem = parentShape;
        }

        // If item is already selected, keep existing selection (for multi-select move)
        // Otherwise, select only this item
        if (!targetItem.selected) {
          paper.project.deselectAll();
          targetItem.selected = true;
        }
        clearSelectionBox();
        setHasSelection(true);

        // Start drawing path (allows connector creation if dragged to another shape)
        drawStartPoint = event.point;
        currentPath = new paper.Path({
          segments: [event.point],
          strokeColor: "#94a3b8",
          strokeWidth: 2,
          strokeCap: "round",
          dashArray: [4, 4],
        });
        return;
      }

      // Clicked on empty space

      // Normal click on empty space - deselect and start drawing
      paper.project.deselectAll();
      clearSelectionBox();
      setHasSelection(false);
      drawStartPoint = event.point;
      currentPath = new paper.Path({
        segments: [event.point],
        strokeColor: "#94a3b8",
        strokeWidth: 2,
        strokeCap: "round",
        dashArray: [4, 4],
      });
    };

    paperTool.onMouseDrag = (event) => {
      if (editingRef.current) return;
      if (gestureInProgress && !isDragging && !isResizing) return;

      if (isResizing && resizeItem && resizeAnchor && initialBounds) {
        resizeItem = resizeShape(
          resizeItem,
          initialBounds,
          resizeAnchor,
          resizeHandleName,
          event.point
        );
        if (resizeItem.data?.shapeId) {
          updateConnectorsForShape(resizeItem);
          paper.project
            .getItems({
              match: (item) =>
                item.data?.type === "text" &&
                item.data?.attachedToShapeId === resizeItem.data.shapeId,
            })
            .forEach((textItem) => {
              textItem.position = resizeItem.bounds.center;
            });
        }
        return;
      }

      if (isDragging && dragItem) {
        hasDragged = true; // Mark that actual movement occurred
        const selectedItems = paper.project.getItems({
          selected: true,
          match: (item) =>
            item.data?.type === "shape" ||
            item.data?.type === "connector" ||
            item.data?.type === "text" ||
            item.data?.type === "drawing",
        });

        const movedShapeIds = new Set();
        selectedItems.forEach((item) => {
          item.position = item.position.add(event.delta);
          if (item.data?.shapeId) {
            movedShapeIds.add(item.data.shapeId);
            updateConnectorsForShape(item);
          }
        });

        movedShapeIds.forEach((shapeId) => {
          paper.project
            .getItems({
              match: (item) =>
                item.data?.type === "text" &&
                item.data?.attachedToShapeId === shapeId &&
                !item.selected,
            })
            .forEach((textItem) => {
              const shape = findShapeById(shapeId);
              if (shape) textItem.position = shape.bounds.center;
            });
        });
        return;
      }

      if (currentPath) {
        currentPath.add(event.point);
      }
    };

    paperTool.onMouseUp = (event) => {
      if (editingRef.current) return;

      if (gestureInProgress && !isDragging && !longPressActive) {
        if (currentPath) {
          currentPath.remove();
          currentPath = null;
        }
        drawStartPoint = null;
        gestureInProgress = false;
        return;
      }

      gestureInProgress = false;

      if (isResizing) {
        if (!loadingState.current) saveCanvasStateDebounced(saveState);
        if (resizeItem) updateSelectionBox(resizeItem);
        isResizing = false;
        resizeItem = null;
        resizeAnchor = null;
        initialBounds = null;
        resizeHandleName = null;
        return;
      }

      if (isDragging) {
        // Show selection box, only save state if actual movement occurred
        const didMove = hasDragged;
        isDragging = false;
        dragItem = null;
        hasDragged = false;

        // Show selection box for single selected item
        const selectedItems = paper.project.getItems({
          selected: true,
          match: (item) =>
            item.data?.type === "shape" ||
            item.data?.type === "connector" ||
            item.data?.type === "drawing",
        });
        if (selectedItems.length === 1) {
          updateSelectionBox(selectedItems[0]);
        }

        if (didMove && !loadingState.current)
          saveCanvasStateDebounced(saveState);
        return;
      }

      if (longPressActive) {
        longPressActive = false;
        return;
      }

      if (currentPath) {
        const endPoint = event.point;
        const startPoint = drawStartPoint;
        const fromItem = findItemAtPoint(startPoint);
        const toItem = findItemAtPoint(endPoint);
        const fromShape = fromItem?.data?.type === "shape" ? fromItem : null;
        const toShape = toItem?.data?.type === "shape" ? toItem : null;

        if (fromShape && toShape && fromShape !== toShape) {
          currentPath.remove();
          createConnector(fromShape, toShape);
          if (!loadingState.current) saveCanvasState(saveState);
          currentPath = null;
          drawStartPoint = null;
          return;
        }

        currentPath.simplify(10);
        currentPath.dashArray = [];
        currentPath.strokeColor = "#334155";

        const newShape = recognizeShape(currentPath);
        currentPath.remove();

        if (!loadingState.current) saveCanvasState(saveState);
        currentPath = null;
        drawStartPoint = null;
      }
    };

    // Double-tap for text
    hammer.on("doubletap", (ev) => {
      gestureInProgress = true;
      if (currentPath) {
        currentPath.remove();
        currentPath = null;
      }
      drawStartPoint = null;

      const rect = canvasRef.current.getBoundingClientRect();
      // Convert screen coordinates to Paper.js view coordinates
      const point = paper.view.viewToProject(
        new paper.Point(ev.center.x - rect.left, ev.center.y - rect.top)
      );
      const hit = paper.project.hitTest(point, {
        fill: true,
        stroke: true,
        tolerance: 10,
      });
      let initialText = "";
      let targetParams = {
        x: point.x,
        y: point.y,
        itemId: null,
        shapeId: null,
        textId: null,
      };

      if (hit?.item?.className === "PointText") {
        const textItem = hit.item;
        initialText = textItem.content;
        targetParams.itemId = textItem.id;
        targetParams.x = textItem.point.x;
        targetParams.y = textItem.point.y;
        targetParams.shapeId = textItem.data?.attachedToShapeId || null;
        targetParams.textId = textItem.data?.textId || generateId();
        textItem.visible = false;
      } else {
        const shape = findItemAtPoint(point);
        if (shape && shape.data?.type === "shape") {
          const shapeId = shape.data.shapeId;
          const existingText = paper.project.getItems({
            match: (item) =>
              item.data?.type === "text" &&
              item.data?.attachedToShapeId === shapeId,
          })[0];

          if (existingText) {
            initialText = existingText.content;
            targetParams.itemId = existingText.id;
            targetParams.textId = existingText.data?.textId || generateId();
            existingText.visible = false;
          } else {
            targetParams.textId = generateId();
          }

          targetParams.x = shape.bounds.center.x;
          targetParams.y = shape.bounds.center.y;
          targetParams.shapeId = shapeId;
        } else {
          targetParams.textId = generateId();
        }
      }

      setEditing({ ...targetParams, text: initialText });
      setTimeout(() => inputRef.current?.focus(), 10);
    });

    // Long press for selection/drag or marquee selection on empty space
    hammer.on("press", (ev) => {
      gestureInProgress = true;
      if (currentPath) {
        currentPath.remove();
        currentPath = null;
      }
      drawStartPoint = null;

      const rect = canvasRef.current.getBoundingClientRect();
      // Convert screen coordinates to Paper.js view coordinates
      const viewPoint = paper.view.viewToProject(
        new paper.Point(ev.center.x - rect.left, ev.center.y - rect.top)
      );
      const item = findItemAtPoint(viewPoint);

      if (item) {
        // Long press on item - select and prepare to drag
        let targetItem = item;
        if (item.data?.type === "text" && item.data?.attachedToShapeId) {
          const parentShape = findShapeById(item.data.attachedToShapeId);
          if (parentShape) targetItem = parentShape;
        }

        // If item is already selected, keep existing selection (move all selected)
        // Otherwise, select only this item
        if (!targetItem.selected) {
          paper.project.deselectAll();
          targetItem.selected = true;
        }
        clearSelectionBox();
        setHasSelection(true);

        if (targetItem.data?.type !== "connector") {
          isDragging = true;
          dragItem = targetItem;
        } else {
          updateSelectionBox(targetItem);
          longPressActive = true;
        }
      } else {
        // Long press on empty space - start marquee selection
        startMarquee(viewPoint);
        longPressActive = true;
        // Keep existing selection (add to it with marquee)
        clearSelectionBox();
      }
    });

    // Pinch to zoom
    hammer.on("pinchstart", () => {
      isPinching = true;
      gestureInProgress = true;
      if (currentPath) {
        currentPath.remove();
        currentPath = null;
      }
      drawStartPoint = null;
      // Clear selection UI before view changes to prevent artifacts
      paper.project.deselectAll();
      clearSelectionBox();
      setHasSelection(false);
      initialZoom = paper.view.zoom;
      initialCenter = paper.view.center.clone();
    });

    hammer.on("pinchmove", (ev) => {
      if (!isPinching) return;
      paper.view.zoom = Math.max(0.25, Math.min(4, initialZoom * ev.scale));
    });

    hammer.on("pinchend pinchcancel", () => {
      isPinching = false;
      gestureInProgress = false;
    });

    // Two-finger pan
    hammer.on("multipanstart", (ev) => {
      if (ev.pointers.length < 2) return;
      gestureInProgress = true;
      if (currentPath) {
        currentPath.remove();
        currentPath = null;
      }
      drawStartPoint = null;
      // Clear selection UI before view changes to prevent artifacts
      paper.project.deselectAll();
      clearSelectionBox();
      setHasSelection(false);
      initialCenter = paper.view.center.clone();
    });

    hammer.on("multipanmove", (ev) => {
      if (ev.pointers.length >= 2) {
        if (!initialCenter) return;
        const delta = new paper.Point(-ev.deltaX, -ev.deltaY).divide(
          paper.view.zoom
        );
        paper.view.center = initialCenter.add(delta);
        return;
      }
    });

    hammer.on("multipanend multipancancel", (ev) => {
      if (ev.pointers.length >= 2) {
        initialCenter = null;
        gestureInProgress = false;
        return;
      }
    });

    hammer.on("singletouchpanmove", (ev) => {
      if (!longPressActive || !isMarqueeActive()) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currentPoint = paper.view.viewToProject(
        new paper.Point(ev.center.x - rect.left, ev.center.y - rect.top)
      );
      updateMarquee(currentPoint);
    });

    hammer.on("singletouchpanend singletouchpancancel", (ev) => {
      if (longPressActive && isMarqueeActive()) {
        const rect = canvasRef.current.getBoundingClientRect();
        const endPoint = paper.view.viewToProject(
          new paper.Point(ev.center.x - rect.left, ev.center.y - rect.top)
        );
        endMarquee(endPoint, setHasSelection, updateSelectionBox);
        longPressActive = false;
      }
    });

    // Desktop: Mouse wheel zoom
    const handleWheel = (e) => {
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const mousePoint = new paper.Point(
        e.clientX - rect.left,
        e.clientY - rect.top
      );
      const viewPoint = paper.view.viewToProject(mousePoint);

      // Zoom factor based on wheel delta
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.25, Math.min(4, paper.view.zoom * zoomFactor));

      // Zoom toward mouse position
      const oldZoom = paper.view.zoom;
      paper.view.zoom = newZoom;
      const newMousePoint = paper.view.viewToProject(mousePoint);
      const shift = newMousePoint.subtract(viewPoint);
      paper.view.center = paper.view.center.subtract(shift);

      // Clear selection to prevent artifacts
      if (Math.abs(newZoom - oldZoom) > 0.01) {
        paper.project.deselectAll();
        clearSelectionBox();
        setHasSelection(false);
      }
    };
    canvasRef.current.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    // Desktop: Ctrl+drag or right-click drag to pan
    let isDesktopPanning = false;
    let desktopPanStart = null;
    let desktopPanButton = null;

    const handleMouseDown = (e) => {
      // Right-click or Ctrl+left-click starts panning
      if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
        e.preventDefault();
        isDesktopPanning = true;
        desktopPanButton = e.button;
        desktopPanStart = paper.view.center.clone();
        // Clear selection when starting pan
        paper.project.deselectAll();
        clearSelectionBox();
        setHasSelection(false);
        return;
      }
    };

    const handleMouseMove = (e) => {
      // Handle panning
      if (isDesktopPanning && desktopPanStart) {
        const delta = new paper.Point(-e.movementX, -e.movementY).divide(
          paper.view.zoom
        );
        paper.view.center = paper.view.center.add(delta);
        return;
      }

      // Handle marquee selection (started by long-press)
      if (isMarqueeActive()) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentPoint = paper.view.viewToProject(
          new paper.Point(e.clientX - rect.left, e.clientY - rect.top)
        );
        updateMarquee(currentPoint);
      }
    };

    const handleMouseUp = (e) => {
      // Handle panning end
      if (
        isDesktopPanning &&
        (e.button === desktopPanButton || e.button === 2)
      ) {
        isDesktopPanning = false;
        desktopPanStart = null;
        desktopPanButton = null;
        return;
      }

      // Handle marquee selection end (started by long-press)
      if (isMarqueeActive()) {
        const rect = canvasRef.current.getBoundingClientRect();
        const endPoint = paper.view.viewToProject(
          new paper.Point(e.clientX - rect.left, e.clientY - rect.top)
        );
        endMarquee(endPoint, setHasSelection, updateSelectionBox);
        longPressActive = false;
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault(); // Prevent context menu on right-click
    };

    canvasRef.current.addEventListener("mousedown", handleMouseDown);
    canvasRef.current.addEventListener("mousemove", handleMouseMove);
    canvasRef.current.addEventListener("mouseup", handleMouseUp);
    canvasRef.current.addEventListener("mouseleave", handleMouseUp);
    canvasRef.current.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("fit-screen", handleFitScreen);
      canvasRef.current?.removeEventListener("wheel", handleWheel);
      canvasRef.current?.removeEventListener("mousedown", handleMouseDown);
      canvasRef.current?.removeEventListener("mousemove", handleMouseMove);
      canvasRef.current?.removeEventListener("mouseup", handleMouseUp);
      canvasRef.current?.removeEventListener("mouseleave", handleMouseUp);
      canvasRef.current?.removeEventListener("contextmenu", handleContextMenu);
      paperTool.remove();
      hammer.destroy();
    };
  }, []);

  const handleTextComplete = () => {
    if (!editing) return;
    const { x, y, itemId, shapeId, textId, text } = editing;

    if (itemId) {
      const item = paper.project.getItem({ id: itemId });
      if (item) item.remove();
    }

    if (shapeId) {
      paper.project
        .getItems({
          match: (item) =>
            item.data?.type === "text" &&
            item.data?.attachedToShapeId === shapeId,
        })
        .forEach((t) => t.remove());
    }

    if (text.trim()) {
      const resolvedTheme = useStore.getState().resolvedTheme;
      const textColor = resolvedTheme === "dark" ? "#f1f5f9" : "#1e293b";
      let finalPoint = [x, y];

      if (shapeId) {
        const shape = findShapeById(shapeId);
        if (shape) finalPoint = shape.bounds.center;
      }

      new paper.PointText({
        point: finalPoint,
        content: text,
        fillColor: textColor,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
        fontWeight: 500,
        justification: "center",
        data: {
          type: "text",
          attachedToShapeId: shapeId,
          textId: textId || generateId(),
        },
      });

      saveCanvasState(saveState);
    }

    setEditing(null);
  };

  // Handle click outside textarea to complete text editing
  const handleCanvasContainerClick = (e) => {
    if (editing && inputRef.current && !inputRef.current.contains(e.target)) {
      handleTextComplete();
    }
  };

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative" }}
      onMouseDown={handleCanvasContainerClick}
      onTouchStart={handleCanvasContainerClick}
    >
      <canvas
        ref={canvasRef}
        resize="true"
        id="main-canvas"
        style={{
          width: "100%",
          height: "100%",
          background: "#f8fafc",
          touchAction: "none",
        }}
      />
      {editing &&
        (() => {
          const isDark = useStore.getState().resolvedTheme === "dark";
          // Convert project coordinates to screen coordinates
          const screenPoint = paper.view.projectToView(
            new paper.Point(editing.x, editing.y)
          );
          return (
            <textarea
              ref={inputRef}
              value={editing.text}
              onInput={(e) => setEditing({ ...editing, text: e.target.value })}
              onBlur={handleTextComplete}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextComplete();
                }
                if (e.key === "Escape") setEditing(null);
              }}
              style={{
                position: "absolute",
                left: screenPoint.x,
                top: screenPoint.y,
                transform: "translate(-50%, -50%)",
                minWidth: "100px",
                padding: "6px 10px",
                background: isDark ? "#1e1e1e" : "white",
                color: isDark ? "#f1f5f9" : "#1e293b",
                border: "2px solid #6366f1",
                borderRadius: "6px",
                outline: "none",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "14px",
                textAlign: "center",
                resize: "none",
                zIndex: 100,
                boxShadow: isDark
                  ? "0 4px 12px rgba(99, 102, 241, 0.4)"
                  : "0 4px 12px rgba(99, 102, 241, 0.25)",
              }}
            />
          );
        })()}
    </div>
  );
};

export default Canvas;
