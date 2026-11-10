import { useSyncExternalStore } from "preact/compat";
import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
import { MAX_DIAGRAM_SIZE, parseDiagram } from "./diagram.js";

const systemTheme = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
const resolveTheme = (theme) => theme === "system"
  ? (systemTheme?.matches ? "dark" : "light")
  : theme;
const applyTheme = (theme) => globalThis.document?.documentElement.setAttribute("data-theme", theme);
const emit = (name, detail) => globalThis.window?.dispatchEvent(new CustomEvent(name, { detail }));

const identity = (state) => state;
function bindStore(store) {
  return Object.assign((select = identity) =>
    useSyncExternalStore(store.subscribe, () => select(store.getState())), store);
}

export const useSaveStatus = bindStore(createStore(() => ({ message: "" })));
const report = (message) => useSaveStatus.setState({ message });
let lastSaved;
const storage = {
  getItem(name) {
    const raw = localStorage.getItem(name);
    lastSaved = raw ? JSON.parse(raw) : null;
    return lastSaved;
  },
  setItem(name, value) {
    const { history, historyIndex, theme, strokeWidth, connectorStyle } = value.state;
    const current = history[historyIndex];
    const previous = lastSaved?.state;
    if (previous?.history?.[previous.historyIndex] === current &&
        previous.theme === theme && previous.strokeWidth === strokeWidth &&
        previous.connectorStyle === connectorStyle) return;
    try {
      if (current.length > MAX_DIAGRAM_SIZE) throw new Error("Diagram exceeds storage limit");
      let saved = value;
      try {
        localStorage.setItem(name, JSON.stringify(saved));
      } catch {
        saved = { ...value, state: { ...value.state, history: [current], historyIndex: 0 } };
        localStorage.setItem(name, JSON.stringify(saved));
      }
      lastSaved = saved;
      report(saved === value ? "" : "Diagram saved. Older undo steps are available until reload.");
    } catch {
      report("Local save failed. Export your diagram to keep your changes.");
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

export const useStore = bindStore(createStore(persist((set, get) => ({
  theme: "system",
  resolvedTheme: resolveTheme("system"),
  setTheme: (theme) => {
    const resolvedTheme = resolveTheme(theme);
    applyTheme(resolvedTheme);
    set({ theme, resolvedTheme });
    emit("theme-changed");
  },
  toggleTheme: () => get().setTheme(get().resolvedTheme === "dark" ? "light" : "dark"),
  history: ["[]"],
  historyIndex: 0,
  saveState: (json) => {
    const { history, historyIndex } = get();
    if (history[historyIndex] === json) return;
    const next = [...history.slice(0, historyIndex + 1), json].slice(-10);
    set({ history: next, historyIndex: next.length - 1 });
  },
  undo: () => {
    const { historyIndex } = get();
    if (historyIndex > 0) set({ historyIndex: historyIndex - 1 });
  },
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) set({ historyIndex: historyIndex + 1 });
  },
  clearAll: () => emit("clear-canvas"),
  strokeWidth: 3,
  setStrokeWidth: (width) => {
    if (width === get().strokeWidth) return;
    set({ strokeWidth: width });
    emit("stroke-width-changed", { width });
  },
  connectorStyle: "bezier",
  toggleConnectorStyle: () => {
    set({ connectorStyle: get().connectorStyle === "bezier" ? "straight" : "bezier" });
    emit("connector-style-changed");
  },
}), {
  name: "touchflow-storage",
  storage,
  partialize: ({ history, historyIndex, theme, strokeWidth, connectorStyle }) =>
    ({ history, historyIndex, theme, strokeWidth, connectorStyle }),
  merge: (saved, state) => {
    if (!saved) return state;
    const theme = ["light", "dark", "system"].includes(saved.theme) ? saved.theme : "system";
    const strokeWidth = [1, 2, 3, 4].includes(saved.strokeWidth) ? saved.strokeWidth : 3;
    const connectorStyle = saved.connectorStyle === "straight" ? "straight" : "bezier";
    const savedHistory = Array.isArray(saved.history) ? saved.history : [];
    const entries = savedHistory.slice(-10);
    const currentIndex = Number.isInteger(saved.historyIndex)
      ? saved.historyIndex - (savedHistory.length - entries.length)
      : entries.length - 1;
    const valid = entries.flatMap((json, index) => {
      try {
        parseDiagram(json);
        return [{ json, index }];
      } catch {
        return [];
      }
    });
    if (valid.length !== entries.length || (entries.length && !valid.some(({ index }) => index === currentIndex))) {
      report("Some saved diagram data could not be restored.");
    }
    return {
      ...state, theme, resolvedTheme: resolveTheme(theme), strokeWidth, connectorStyle,
      history: valid.length ? valid.map(({ json }) => json) : state.history,
      historyIndex: Math.max(0, valid.map(({ index }) => index <= currentIndex).lastIndexOf(true)),
    };
  },
  onRehydrateStorage: () => (state, error) => {
    applyTheme(state?.resolvedTheme ?? resolveTheme("system"));
    if (error) report("Local storage could not be read. Export your diagram to keep your changes.");
  },
})));

systemTheme?.addEventListener("change", () => {
  if (useStore.getState().theme === "system") {
    const resolvedTheme = resolveTheme("system");
    applyTheme(resolvedTheme);
    useStore.setState({ resolvedTheme });
    emit("theme-changed");
  }
});
