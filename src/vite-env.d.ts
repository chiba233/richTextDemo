/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module "*.css" {
  const css: string;
  export default css;
}

declare const __YUME_DEMO_PACKAGE_VERSIONS__: Readonly<{
  "yume-dsl-rich-text": string;
  "yume-dsl-token-walker": string;
  "yume-dsl-shiki-highlight": string;
}>;
