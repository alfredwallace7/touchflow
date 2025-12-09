const HelpSplash = ({ onClose }) => {
  return (
    <>
      <div className="splash-backdrop" onClick={onClose} />
      <div className="splash-modal">
        <button className="splash-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <img src="logo.png" alt="TouchFlow" className="splash-logo" />

        <table className="splash-table">
          <tbody>
            <tr>
              <td>Draw</td>
              <td>single finger (or mouse) → shapes auto-recognized</td>
            </tr>
            <tr>
              <td>Connect</td>
              <td>
                draw A→B (dashed); draw B→A to merge into solid double-arrow
              </td>
            </tr>
            <tr>
              <td>Select</td>
              <td>tap / click to select one</td>
            </tr>
            <tr>
              <td>Marquee</td>
              <td>long-press empty space + drag to select many</td>
            </tr>
            <tr>
              <td>Move</td>
              <td>long-press shape + drag (moves all selected)</td>
            </tr>
            <tr>
              <td>Pan</td>
              <td>two-finger drag (mobile) • Ctrl/Right-drag (desktop)</td>
            </tr>
            <tr>
              <td>Zoom</td>
              <td>pinch (mobile) • mouse wheel (desktop)</td>
            </tr>
            <tr>
              <td>Text</td>
              <td>double-tap / double-click shape or canvas</td>
            </tr>
            <tr>
              <td>Fit</td>
              <td>toolbar → fit to screen</td>
            </tr>
            <tr>
              <td>Export/Share</td>
              <td>menu → SVG / JSON / share</td>
            </tr>
            <tr>
              <td>Fullscreen</td>
              <td>menu → fullscreen / exit</td>
            </tr>
            <tr>
              <td>Install</td>
              <td>menu → Install App (when available)</td>
            </tr>
          </tbody>
        </table>

        <p className="splash-footer">Tap/Click anywhere to close</p>
      </div>
    </>
  );
};

export default HelpSplash;
