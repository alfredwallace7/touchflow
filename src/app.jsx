import Canvas from "./components/Canvas";
import Toolbar from "./components/Toolbar";

export function App() {
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
