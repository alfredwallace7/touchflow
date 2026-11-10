import { render } from 'preact'
import './index.css'
import { App } from './app.jsx'

render(<App />, document.getElementById('app'))

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const worker = new URL("sw.js", document.baseURI);
  navigator.serviceWorker.register(worker).catch((error) => {
    console.warn("TouchFlow offline setup failed:", error);
  });
}
