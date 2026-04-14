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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/yume-dsl-rich-text/")) return "yume-dsl-rich-text";
          if (id.includes("node_modules/yume-dsl-token-walker/")) return "yume-dsl-token-walker";
          if (id.includes("node_modules/yume-dsl-shiki-highlight/")) return "yume-dsl-shiki-highlight";
          return undefined;
        },
      },
    },
  },
});
