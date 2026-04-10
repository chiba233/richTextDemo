import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  // eslint-disable-next-line no-undef
  base: process.env.VITE_BASE ?? "/",
  plugins: [vue()],
  server: {
    fs: {
      // eslint-disable-next-line no-undef
      allow: [path.resolve(__dirname, "..")],
    },
  },
  resolve: {
    alias: {
      // eslint-disable-next-line no-undef
      "@demo": path.resolve(__dirname, "src"),
    },
  },
});
