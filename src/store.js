import { create } from "zustand";
import { persist } from "zustand/middleware";

// Detect system theme preference
const getSystemTheme = () => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
};

export const useStore = create(
  persist(
    (set, get) => ({
      // Theme: 'light', 'dark', or 'system'
      theme: "system",
      resolvedTheme: getSystemTheme(), // Actual theme being used
      setTheme: (theme) => {
        const resolved = theme === "system" ? getSystemTheme() : theme;
        set({ theme, resolvedTheme: resolved });
        // Apply to document
        document.documentElement.setAttribute("data-theme", resolved);
      },
      toggleTheme: () => {
        const { resolvedTheme } = get();
        const newTheme = resolvedTheme === "dark" ? "light" : "dark";
        set({ theme: newTheme, resolvedTheme: newTheme });
        document.documentElement.setAttribute("data-theme", newTheme);
        // Notify canvas to update shape/text colors
        window.dispatchEvent(new CustomEvent("theme-changed"));
      },

      history: [],
      historyIndex: -1,

      saveState: (json) => {
        const { history, historyIndex } = get();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(json);
        if (newHistory.length > 10) newHistory.shift();
        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      undo: () => {
        const { historyIndex } = get();
        if (historyIndex > 0) {
          set({ historyIndex: historyIndex - 1 });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          set({ historyIndex: historyIndex + 1 });
        }
      },

      // Clear all - reset canvas
      clearAll: () => {
        set({ history: [], historyIndex: -1 });
        window.dispatchEvent(new CustomEvent("clear-canvas"));
      },

      // Stroke width (default: 3 = third option)
      strokeWidth: 3,
      setStrokeWidth: (width) => {
        set({ strokeWidth: width });
        // Notify canvas to update all shapes
        window.dispatchEvent(
          new CustomEvent("stroke-width-changed", { detail: { width } })
        );
      },

      // Connector style: 'bezier' or 'straight'
      connectorStyle: "bezier",
      toggleConnectorStyle: () => {
        const { connectorStyle } = get();
        const newStyle = connectorStyle === "bezier" ? "straight" : "bezier";
        set({ connectorStyle: newStyle });
        // Notify canvas to update all connectors
        window.dispatchEvent(new CustomEvent("connector-style-changed"));
      },
    }),
    {
      name: "touchflow-storage",
      partialize: (state) => ({
        history: state.history,
        historyIndex: state.historyIndex,
        theme: state.theme,
      }),
      onRehydrate: () => (state) => {
        // Apply theme on load
        if (state) {
          const resolved =
            state.theme === "system" ? getSystemTheme() : state.theme;
          state.resolvedTheme = resolved;
          document.documentElement.setAttribute("data-theme", resolved);
        }
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== "undefined" && window.matchMedia) {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      const store = useStore.getState();
      if (store.theme === "system") {
        const newTheme = e.matches ? "dark" : "light";
        useStore.setState({ resolvedTheme: newTheme });
        document.documentElement.setAttribute("data-theme", newTheme);
      }
    });
}
