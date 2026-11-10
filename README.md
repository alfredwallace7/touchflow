# TouchFlow

A mobile-first, gesture-driven flowchart canvas. Sketch with your fingers, watch strokes snap into tidy shapes, and connect ideas in seconds.

**Live demo:** https://touchflow.netcraft.fr/

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

Prerequisites: Node 20.19+ or Node 22.12+ and npm.

With GNU Make, run `make install` once, then `make dev` to start the app or
`make check` to run tests and build. Run `make` for all targets. To test on a
phone on the same Wi-Fi network, run `make dev-lan` and open the **Network** URL
printed by Vite. The npm commands below also work directly.

1. Install:

```bash
npm install
```

2. Run locally:

```bash
npm run dev
```

3. Test and build:

```bash
npm test
npm run build
```

4. Preview the build:

```bash
npm run preview
```

## Android APK for local testing

Install Android Studio with **Android SDK Platform 36** and use **Node.js 22+**.
Run `make install` after pulling the Android build dependencies, then run
`make apk`. It builds the web app, creates the local `android/` project on the
first run, and packages a debug APK at
`android/app/build/outputs/apk/debug/app-debug.apk`.
The first build may download Gradle and missing Android SDK components.

The build looks for the SDK in its default location. Set `ANDROID_HOME` if
you installed it elsewhere. Use JDK 21 for Gradle. If Android Studio ships
with Java 25 or newer, set `JAVA_HOME` to a JDK 21 installation or extract a
portable JDK 21 to `.apk-tools.local/jdk-21`. The generated Android project is
kept out of Git, uses `fr.netcraft.touchflow` as its package ID, and can be
opened in Android Studio for testing.

## 💡 How to use

- Draw a closed outline to recognize a shape, or draw from one shape to another to connect them. Open strokes remain as freehand drawings.
- Tap to select. Hold and drag a shape to move it with its labels and connectors. Hold and drag on empty space to select multiple items.
- **Double-tap** a shape to edit its label, or double-tap empty space for free text.
- Toggle **Curved ↔ Straight** connectors from the menu to match your style.
- Flip **Light/Dark** themes anytime; strokes and text adapt automatically.
- Export as **SVG** when you’re ready to share.
- Use the production build over HTTPS or localhost for offline use after the first visit. On iOS, use Safari’s Share menu to add TouchFlow to the Home Screen.

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
- [Preact](https://preactjs.com/) for the lightweight UI runtime.
