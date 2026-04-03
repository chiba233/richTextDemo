import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [vue()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
  resolve: {
    alias: {
      "@demo": path.resolve(__dirname, "src"),
    },
  },
});
