import { defineComponent, h, type VNode } from "vue";

// Renders text containing backtick-delimited code: `code` → <code>code</code>
export default defineComponent({
  name: "FormattedText",
  props: {
    text: { type: String, required: true },
  },
  setup(props) {
    return () => {
      const parts = props.text.split(/(`[^`]+`)/g);
      const nodes: (VNode | string)[] = [];
      for (const part of parts) {
        if (part.startsWith("`") && part.endsWith("`")) {
          nodes.push(h("code", {}, part.slice(1, -1)));
        } else if (part) {
          nodes.push(part);
        }
      }
      return nodes;
    };
  },
});
