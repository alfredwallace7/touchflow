import assert from "node:assert/strict";
import { test } from "node:test";

test("restores legacy snapshots, preserves the last save after quota errors and reports failures", async () => {
  const blank = '[["Layer",{"applyMatrix":true}]]';
  const diagram = '[["Layer",{"children":[["Path",{"data":{"type":"shape","shapeId":"a"},"segments":[[0,0],[40,0],[40,40],[0,40]],"closed":true}]]}]]';
  let value = JSON.stringify({ version: 0, state: { history: [blank, diagram, "invalid"], historyIndex: 2, theme: "dark" } });
  let limit = Infinity;
  globalThis.localStorage = {
    getItem: () => value,
    setItem(_name, next) {
      if (JSON.parse(next).state.history.length > limit) throw new Error("Quota exceeded");
      value = next;
    },
  };
  const { useStore, useSaveStatus } = await import("../src/store.js");
  const get = useStore.getState;
  assert.equal(get().history[get().historyIndex], diagram);
  assert.match(useSaveStatus.getState().message, /could not be restored/);
  limit = 1;
  get().saveState(diagram.replace('"a"', '"b"'));
  const saved = value;
  assert.equal(JSON.parse(saved).state.history.length, 1);
  assert.match(useSaveStatus.getState().message, /until reload/);
  limit = 0;
  get().saveState("[]");
  assert.equal(value, saved);
  assert.match(useSaveStatus.getState().message, /Local save failed/);
  assert.equal(get().history.length, 4);
});
