import { useEffect } from "preact/hooks";
import Canvas from "./components/Canvas";
import Toolbar from "./components/Toolbar";
import { useStore } from "./store";
import "./app.css";

export function App() {
  const { resolvedTheme, theme } = useStore();

  // Apply theme on mount
  useEffect(() => {
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  return (
    <div
      id="touchflow-app"
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <Canvas />

      {/* UI Layer */}
      <div
        id="ui-layer"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <Toolbar />
      </div>
    </div>
  );
}
