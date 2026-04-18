import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import fs from "node:fs";

// eslint-disable-next-line no-undef
const localRichTextSourceEntry = path.resolve(__dirname, "..", "yume-dsl-rich-text", "src", "index.ts");
 
const localTokenWalkerSourceEntry = path.resolve(
  // eslint-disable-next-line no-undef
  __dirname,
  "..",
  "yume-dsl-token-walker",
  "src",
  "index.ts",
);
 
const localShikiHighlightSourceEntry = path.resolve(
  // eslint-disable-next-line no-undef
  __dirname,
  "..",
  "yume-dsl-shiki-highlight",
  "src",
  "index.ts",
);
// eslint-disable-next-line no-undef
const useLocalRichTextSource = process.env.VITE_USE_LOCAL_RICH_TEXT === "1";
// eslint-disable-next-line no-undef
const useLocalTokenWalkerSource = process.env.VITE_USE_LOCAL_TOKEN_WALKER === "1";
// eslint-disable-next-line no-undef
const useLocalShikiHighlightSource = process.env.VITE_USE_LOCAL_SHIKI_HIGHLIGHT === "1";

const readVersion = (packageJsonPath) => {
  const content = fs.readFileSync(packageJsonPath, "utf8");
  return JSON.parse(content).version;
};

 
const resolvePackageVersionPath = (packageName, useLocal, localPackageDir) =>
  useLocal
    // eslint-disable-next-line no-undef
    ? path.resolve(__dirname, "..", localPackageDir, "package.json")
    // eslint-disable-next-line no-undef
    : path.resolve(__dirname, "node_modules", packageName, "package.json");

const demoPackageVersions = {
  "yume-dsl-rich-text": readVersion(
    resolvePackageVersionPath(
      "yume-dsl-rich-text",
      useLocalRichTextSource,
      "yume-dsl-rich-text",
    ),
  ),
  "yume-dsl-token-walker": readVersion(
    resolvePackageVersionPath(
      "yume-dsl-token-walker",
      useLocalTokenWalkerSource,
      "yume-dsl-token-walker",
    ),
  ),
  "yume-dsl-shiki-highlight": readVersion(
    resolvePackageVersionPath(
      "yume-dsl-shiki-highlight",
      useLocalShikiHighlightSource,
      "yume-dsl-shiki-highlight",
    ),
  ),
};

export default defineConfig({
  // eslint-disable-next-line no-undef
  base: process.env.VITE_BASE ?? "/",
  define: {
    __YUME_DEMO_PACKAGE_VERSIONS__: JSON.stringify(demoPackageVersions),
  },
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
      ...(useLocalRichTextSource
        ? {
            "yume-dsl-rich-text": localRichTextSourceEntry,
          }
        : {}),
      ...(useLocalTokenWalkerSource
        ? {
            "yume-dsl-token-walker": localTokenWalkerSourceEntry,
          }
        : {}),
      ...(useLocalShikiHighlightSource
        ? {
            "yume-dsl-shiki-highlight": localShikiHighlightSourceEntry,
          }
        : {}),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/yume-dsl-rich-text/")) return "yume-dsl-rich-text";
          if (id.includes("/yume-dsl-rich-text/src/")) return "yume-dsl-rich-text";
          if (id.includes("node_modules/yume-dsl-token-walker/")) return "yume-dsl-token-walker";
          if (id.includes("/yume-dsl-token-walker/src/")) return "yume-dsl-token-walker";
          if (id.includes("node_modules/yume-dsl-shiki-highlight/")) return "yume-dsl-shiki-highlight";
          if (id.includes("/yume-dsl-shiki-highlight/src/")) return "yume-dsl-shiki-highlight";
          return undefined;
        },
      },
    },
  },
});
