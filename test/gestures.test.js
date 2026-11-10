import assert from "node:assert/strict";
import { test } from "node:test";
import { bindPointerGestures } from "../src/components/canvasHelpers/pointerGestures.js";

function setup(t) {
  globalThis.window = new EventTarget();
  const frames = new Map();
  let nextFrame = 0;
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const canvas = new EventTarget();
  canvas.setPointerCapture = () => {};
  const calls = [];
  const record = (name, result) => (...args) => {
    calls.push([name, ...args]);
    return result;
  };
  const router = bindPointerGestures(canvas, {
    isEditing: () => false,
    start: record("start", "draw"),
    press: record("press", "move"),
    move: record("move"),
    end: record("end"),
    tap: record("tap"),
    doubleTap: record("doubleTap"),
    cancel: record("cancel"),
    startNavigation: record("startNavigation"),
    navigate: record("navigate"),
    endNavigation: record("endNavigation"),
  });
  t.after(() => router.remove());
  return {
    calls,
    flush() { for (const callback of [...frames.values()]) callback(); },
    send(type, pointerId, x, y, timeStamp = 0, extra = {}) {
      const event = new Event(type);
      Object.defineProperty(event, "timeStamp", { value: timeStamp });
      Object.assign(event, { pointerId, pointerType: "touch", button: 0, clientX: x, clientY: y, ...extra });
      canvas.dispatchEvent(event);
    },
  };
}

test("a second finger cancels a stroke and the remaining finger cannot resume it", (t) => {
  const { calls, send, flush } = setup(t);
  send("pointerdown", 1, 50, 80);
  send("pointermove", 1, 70, 90);
  send("pointerdown", 2, 150, 90);
  send("pointermove", 2, 180, 130);
  flush();
  send("pointerup", 1, 70, 90);
  send("pointermove", 2, 240, 130);
  send("pointerup", 2, 240, 130);
  assert.deepEqual(calls.map(([name]) => name),
    ["start", "cancel", "startNavigation", "navigate", "navigate", "endNavigation"]);
  assert.deepEqual(calls[3][1].center, { x: 125, y: 110 });
  assert.ok(calls[3][1].distance > calls[2][1].distance);
});

test("coalesced strokes flush their final sample before committing", (t) => {
  const { calls, send } = setup(t);
  send("pointerdown", 1, 10, 10);
  send("pointermove", 1, 30, 30, 10, {
    getCoalescedEvents: () => [{ clientX: 22, clientY: 23 }],
  });
  send("pointerup", 1, 40, 40, 20);
  assert.deepEqual(calls[1], ["move", "draw", [{ x: 22, y: 23 }, { x: 30, y: 30 }, { x: 40, y: 40 }]]);
  assert.deepEqual(calls[2], ["end", "draw", { x: 40, y: 40 }, true]);
});

test("long press owns a drag and lost pointer capture cancels it", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, send, flush } = setup(t);
  send("pointerdown", 1, 30, 45);
  send("pointermove", 1, 34, 48);
  t.mock.timers.tick(400);
  send("pointermove", 1, 52, 67);
  flush();
  send("lostpointercapture", 1, 52, 67);
  assert.deepEqual(calls.map(([name]) => name), ["start", "press", "move", "cancel"]);
  assert.equal(calls[2][1], "move");
  send("pointerdown", 2, 60, 70, 450);
  send("pointerup", 2, 60, 70, 470);
  assert.equal(calls.at(-1)[0], "tap");
});

test("a nearby double tap opens editing without a drawing commit", (t) => {
  const { calls, send } = setup(t);
  send("pointerdown", 1, 30, 40, 30);
  send("pointerup", 1, 30, 40, 60);
  send("pointerdown", 2, 33, 37, 200);
  send("pointerup", 2, 33, 37, 230);
  assert.deepEqual(calls.map(([name]) => name), ["start", "tap", "start", "doubleTap"]);
});
