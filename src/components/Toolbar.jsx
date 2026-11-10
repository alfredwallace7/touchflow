import { useState, useEffect, useRef } from "preact/hooks";
import { useStore } from "../store";
import { MAX_DIAGRAM_SIZE } from "../diagram.js";
import { diagramFileName } from "./canvasHelpers/eventHandlers.js";
import HelpSplash from "./HelpSplash";
import ConfirmDialog from "./ConfirmDialog";

const Toolbar = () => {
  const {
    undo,
    redo,
    toggleTheme,
    theme,
    setTheme,
    history,
    historyIndex,
    resolvedTheme,
    clearAll,
    strokeWidth,
    setStrokeWidth,
    connectorStyle,
    toggleConnectorStyle,
  } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const menuButton = useRef(null);
  const menuPanel = useRef(null);

  useEffect(() => {
    if (menuOpen) menuPanel.current?.focus();
  }, [menuOpen]);

  // Capture PWA install prompt
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
    } catch {
      alert("The installation prompt is unavailable.");
    } finally {
      setInstallPrompt(null);
      setMenuOpen(false);
    }
  };

  // Listen for selection changes from Canvas
  useEffect(() => {
    const handleSelectionChange = (e) => {
      setHasSelection(e.detail.hasSelection);
    };
    window.addEventListener("selection-changed", handleSelectionChange);
    return () =>
      window.removeEventListener("selection-changed", handleSelectionChange);
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      alert("Fullscreen is unavailable.");
    } finally {
      setMenuOpen(false);
    }
  };

  const handleExportSVG = () => {
    window.dispatchEvent(new CustomEvent("export-svg"));
    setMenuOpen(false);
  };

  const handleExportJSON = () => {
    window.dispatchEvent(new CustomEvent("export-json"));
    setMenuOpen(false);
  };

  const handleImportJSON = () => {
    // Create hidden file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > MAX_DIAGRAM_SIZE) {
        alert("This diagram exceeds the 4 MB import limit.");
        return;
      }
      try {
        const json = await file.text();
        window.dispatchEvent(new CustomEvent("import-json", { detail: { json } }));
      } catch {
        alert("The diagram file could not be read.");
      }
    };
    input.click();
    setMenuOpen(false);
  };

  const handleDelete = () => {
    window.dispatchEvent(new CustomEvent("delete-selected"));
    setHasSelection(false);
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
    setMenuOpen(false);
  };

  const confirmClear = () => {
    clearAll();
    setShowClearConfirm(false);
  };

  const cancelClear = () => {
    setShowClearConfirm(false);
  };

  const handleShare = async () => {
    try {
      let json;
      const receive = (value) => { json = value; };
      window.dispatchEvent(new CustomEvent("get-canvas-json", { detail: { receive } }));
      if (!json) throw new Error("Canvas is unavailable");
      const file = new File([json], diagramFileName("json"), { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "TouchFlow Diagram" });
      else handleExportJSON();
    } catch (err) {
      if (err.name !== "AbortError") handleExportJSON();
    }
    setMenuOpen(false);
  };

  const handleFitScreen = () => {
    window.dispatchEvent(new CustomEvent("fit-screen"));
  };

  const strokeOptions = [1, 2, 3, 4];

  return (
    <>
      {/* Main Toolbar */}
      <div className="toolbar" role="group" aria-label="Diagram tools">
        {/* Logo - fixed width container for centering */}
        <div className="toolbar-start">
          <button className="icon-btn" aria-label="Help" title="Help" onClick={() => setHelpOpen(true)}>
            <img src="icon-192.png" alt="" className="logo" />
          </button>
        </div>

        {/* Undo / Redo */}
        <button onClick={undo} className="icon-btn" title="Undo" aria-label="Undo" disabled={historyIndex <= 0}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
          </svg>
        </button>
        <button onClick={redo} className="icon-btn" title="Redo" aria-label="Redo" disabled={historyIndex >= history.length - 1}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
          </svg>
        </button>

        {/* Fit to Screen */}
        <button
          onClick={handleFitScreen}
          className="icon-btn"
          title="Fit to Screen"
          aria-label="Fit to Screen"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>

        {/* Delete Selected - muted when nothing selected, red when selection exists */}
        <button
          onClick={handleDelete}
          className={`icon-btn delete-btn ${
            hasSelection ? "has-selection" : ""
          }`}
          title="Delete Selected"
          aria-label="Delete Selected"
          disabled={!hasSelection}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>

        {/* More Menu Toggle - fixed width container for centering */}
        <div className="toolbar-end">
          <button
            ref={menuButton}
            onClick={() => setMenuOpen(!menuOpen)}
            className={`icon-btn menu-btn ${menuOpen ? "active" : ""}`}
            title="More options"
            aria-label="More options"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "diagram-options" : undefined}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="5" r="1" fill="currentColor" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <circle cx="12" cy="19" r="1" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable Menu */}
      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div
            ref={menuPanel}
            id="diagram-options"
            className="menu-popup"
            role="region"
            aria-label="Diagram options"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setMenuOpen(false);
                menuButton.current?.focus();
              }
            }}
          >
            {/* Stroke Width Selector */}
            <div className="menu-section">
              <span className="menu-label">Stroke Width</span>
              <div className="stroke-selector">
                {strokeOptions.map((w) => (
                  <button
                    key={w}
                    className={`stroke-option ${
                      strokeWidth === w ? "active" : ""
                    }`}
                    onClick={() => setStrokeWidth(w)}
                    title={`${w}px`}
                  >
                    <span
                      style={{
                        width: "20px",
                        height: `${w * 2}px`,
                        background: "currentColor",
                        borderRadius: "2px",
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-divider" />

            {/* Connector Style Toggle - shows action (what it will switch to) */}
            <button
              onClick={() => {
                toggleConnectorStyle();
              }}
              className="menu-item"
            >
              {connectorStyle === "bezier" ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="12" x2="20" y2="12" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12 C 8 4, 16 4, 20 12" />
                </svg>
              )}
              <span>
                {connectorStyle === "bezier"
                  ? "Straight Lines"
                  : "Curved Lines"}
              </span>
            </button>

            <div className="menu-divider" />

            <button onClick={handleClearAll} className="menu-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
              </svg>
              <span>Clear All</span>
            </button>

            <div className="menu-divider" />

            <button onClick={handleExportSVG} className="menu-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export SVG</span>
            </button>

            <button onClick={handleExportJSON} className="menu-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
              <span>Export JSON</span>
            </button>

            <button onClick={handleImportJSON} className="menu-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="12" x2="12" y2="18" />
                <polyline points="9 15 12 18 15 15" />
              </svg>
              <span>Import JSON</span>
            </button>

            <button onClick={handleShare} className="menu-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>Share</span>
            </button>

            <div className="menu-divider" />

            <button
              onClick={() => {
                toggleTheme();
                setMenuOpen(false);
              }}
              className="menu-item"
            >
              {resolvedTheme === "dark" ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
              <span>
                {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </button>

            {theme !== "system" && (
              <button className="menu-item" onClick={() => { setTheme("system"); setMenuOpen(false); }}>
                Use System Theme
              </button>
            )}
            {document.fullscreenEnabled && <button onClick={toggleFullscreen} className="menu-item">
              {isFullscreen ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                </svg>
              )}
              <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
            </button>}

            {installPrompt && (
              <button onClick={handleInstall} className="menu-item">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Install App</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Help Splash */}
      {helpOpen && <HelpSplash onClose={() => setHelpOpen(false)} />}

      {/* Confirm clear dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        title="Clear canvas?"
        description="This removes all shapes, connectors, labels, and drawings. You can undo this action."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onConfirm={confirmClear}
        onCancel={cancelClear}
      />
    </>
  );
};

export default Toolbar;
