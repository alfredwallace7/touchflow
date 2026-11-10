import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

function offlineShell() {
  return {
    name: "touchflow-offline-shell",
    apply: "build",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const publicFiles = ["manifest.webmanifest", "icon-192.png", "icon-512.png"];
        const files = [...new Set(["index.html", ...Object.keys(bundle), ...publicFiles])].sort();
        const hash = createHash("sha256");
        for (const file of files) {
          const output = bundle[file];
          hash.update(output ? output.code ?? output.source : readFileSync(new URL(
            file === "index.html" ? file : `public/${file}`, import.meta.url
          )));
        }
        const source = readFileSync(new URL("src/service-worker.js", import.meta.url), "utf8");
        const version = hash.update(source).digest("hex").slice(0, 16);
        this.emitFile({
          type: "asset", fileName: "sw.js",
          source: `const shell = ${JSON.stringify({ version, files })};\n${source}`,
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [preact(), offlineShell()],
  base: "./",
});
