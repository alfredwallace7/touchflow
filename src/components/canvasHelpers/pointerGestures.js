const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const position = (event) => ({ x: event.clientX, y: event.clientY });

export function bindPointerGestures(canvas, handlers) {
  const pointers = new Map();
  let mode = null;
  let start, lastTap, pressTimer, frame;
  let samples = [];
  let moved = false;

  const pair = () => {
    const [a, b] = pointers.values();
    return {
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      distance: Math.max(1, distance(a, b)),
    };
  };

  const flush = () => {
    if (frame != null) cancelAnimationFrame(frame);
    frame = null;
    if (mode === "navigate" && pointers.size >= 2) handlers.navigate(pair());
    if (samples.length) handlers.move(mode, samples);
    samples = [];
  };

  const cancel = () => {
    clearTimeout(pressTimer);
    if (frame != null) cancelAnimationFrame(frame);
    frame = null;
    samples = [];
    if (mode && mode !== "blocked") handlers.cancel(mode);
    mode = pointers.size ? "blocked" : null;
    lastTap = null;
  };

  const down = (event) => {
    if (event.button > 2 || handlers.isEditing()) return;
    if (pointers.size && event.pointerType !== "touch") return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = position(event);
    pointers.set(event.pointerId, point);
    if (pointers.size >= 2) {
      if (pointers.size === 2) {
        cancel();
        mode = "navigate";
        handlers.startNavigation(pair());
      }
      return;
    }
    start = point;
    moved = false;
    mode = handlers.start(point, event);
    if (mode === "draw") {
      pressTimer = setTimeout(() => {
        lastTap = null;
        mode = handlers.press(start);
      }, 400);
    }
  };

  const move = (event, schedule = true) => {
    if (!pointers.has(event.pointerId)) return;
    const point = position(event);
    pointers.set(event.pointerId, point);
    if (mode === "blocked") return;
    if (mode !== "navigate") {
      const threshold = event.pointerType === "mouse" ? 4 : 8;
      if (!moved && distance(start, point) < threshold) return;
      moved = true;
      clearTimeout(pressTimer);
      if (mode === "draw") {
        for (const sample of event.getCoalescedEvents?.() || []) {
          samples.push(position(sample));
        }
      } else {
        samples = [];
      }
      samples.push(point);
    }
    if (schedule && frame == null) frame = requestAnimationFrame(flush);
  };

  const finish = (event) => {
    if (!pointers.has(event.pointerId)) return;
    clearTimeout(pressTimer);
    if (event.type === "pointerup") {
      move(event, false);
      flush();
    } else {
      cancel();
    }
    pointers.delete(event.pointerId);
    if (mode === "navigate") {
      if (pointers.size >= 2) handlers.startNavigation(pair());
      else {
        handlers.endNavigation();
        mode = "blocked";
      }
    }
    if (pointers.size) return;
    const point = position(event);
    if (mode === "draw" && !moved) {
      const now = event.timeStamp;
      if (lastTap && lastTap.type === event.pointerType &&
          now - lastTap.time < 320 && distance(lastTap.point, point) < 24) {
        lastTap = null;
        handlers.doubleTap(point);
      } else {
        lastTap = { point, time: now, type: event.pointerType };
        handlers.tap(point, event);
      }
    } else if (mode !== "blocked") {
      lastTap = null;
      handlers.end(mode, point, moved);
    }
    mode = null;
  };

  const listeners = {
    pointerdown: down,
    pointermove: move,
    pointerup: finish,
    pointercancel: finish,
    lostpointercapture: finish,
    contextmenu: (event) => event.preventDefault(),
  };
  for (const [name, listener] of Object.entries(listeners)) {
    canvas.addEventListener(name, listener);
  }
  const reset = () => {
    cancel();
    const ids = [...pointers.keys()];
    pointers.clear();
    mode = null;
    for (const id of ids) {
      if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    }
  };
  window.addEventListener("blur", reset);
  return {
    cancel,
    remove() {
      reset();
      window.removeEventListener("blur", reset);
      for (const [name, listener] of Object.entries(listeners)) {
        canvas.removeEventListener(name, listener);
      }
    },
  };
}

export const clampZoom = (zoom) => Math.max(0.05, Math.min(4, zoom));

export function anchorZoom(view, zoom, screenPoint, anchor) {
  view.zoom = clampZoom(zoom);
  view.center = view.center.add(anchor.subtract(view.viewToProject(screenPoint)));
}
