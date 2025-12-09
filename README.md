# TouchFlow

A mobile-first, gesture-driven flowchart canvas. Sketch with your fingers, watch strokes snap into tidy shapes, and connect ideas in seconds.

## ✨ Highlights

- ✍️ **Draw like on paper**: Single-finger draw or mouse draw; shapes auto-recognized and cleaned up.
- 🧠 **Shape cleanup**: Rough circles, rectangles, and triangles become polished, well-sized shapes automatically.
- 🔗 **Smart connectors**: Drag from one shape to another to drop a clean connector with arrowheads; switch between curved or straight styles.
- 📝 **Tap to label**: Double-tap or double-click shapes (or empty space) to add or edit centered text; stays readable in light or dark mode.
- ⏪ **Undo / redo**: Step back or forward through recent edits so experiments stay safe.
- 🎚️ **Stroke control**: Change stroke weight from the toolbar without leaving draw mode.
- 🌗 **Light & dark**: One-tap theme toggle, or follow the system preference automatically.
- 🗂️ **Autosave**: Work is kept locally so sessions survive refreshes.
- 📤 **Export / Import / Share**: Export SVG or JSON, import JSON, or share via Web Share (with file fallback).
- 🧭 **Navigation**: Pinch/mouse-wheel zoom, two-finger pan or Ctrl/right-drag pan, fit-to-screen button.
- 🖱️ **Selection**: Click/tap to select; long-press + drag on empty space for marquee multi-select; long-press + drag on shape to move (keeps other selected items).
- ↔️ **Connectors**: Dashed, animated flow toward arrowhead; drawing the reverse link auto-merges into a solid bidirectional connector.
- 🗑️ **Cleanup options**: Delete selected items or clear the whole canvas.
- 🖥️ **Fullscreen & Install**: Toggle fullscreen; install as a PWA when available.

## 🚀 Quick start

Prerequisites: Node 18+ and npm.

1. Install:

```bash
npm install
```

2. Run locally:

```bash
npm run dev
```

3. Build:

```bash
npm run build
```

4. Preview the build:

```bash
npm run preview
```

## 💡 How to use

- Start in **Draw** mode to sketch shapes or connectors; connecting two shapes auto-creates a tidy link.
- Switch to **Select** to move shapes—text and connectors follow along.
- **Double-tap** a shape to edit its label, or double-tap empty space for free text.
- Toggle **Curved ↔ Straight** connectors from the menu to match your style.
- Flip **Light/Dark** themes anytime; strokes and text adapt automatically.
- Export as **SVG** when you’re ready to share.

## ☕ Support

If you find TouchFlow useful, consider buying me a coffee:

[![Donate](https://img.shields.io/badge/Donate-Support%20TouchFlow-blue?style=for-the-badge)](https://buy.stripe.com/00wdR151h7Nagd04dL6Vq00)

## 📚 Citation

If TouchFlow helps your work, please cite it:

```bibtex
@software{touchflow,
  title        = {TouchFlow},
  author       = {alfredwallace7},
  year         = {2025},
  url          = {https://github.com/alfredwallace7/touchflow}
}
```

## 📄 License

TouchFlow is released under the MIT License:

```
MIT License

Copyright (c) 2025 TouchFlow Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Credits

- [Paper.js](http://paperjs.org/) for the vector canvas engine.
- [Hammer.js](https://hammerjs.github.io/) for touch and gesture handling.
- [Preact](https://preactjs.com/) for the lightweight UI runtime.
