import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup:      resolve(__dirname, "popup.html"),
        onboarding: resolve(__dirname, "onboarding.html"),
        background: resolve(__dirname, "src/background/service-worker.ts"),
        content:    resolve(__dirname, "src/content/content-script.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
