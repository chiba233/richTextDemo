import { defineComponent, h, type PropType, type VNode } from "vue";
import type { TextToken } from "yume-dsl-rich-text";

type Child = VNode | string;

// ── Style flags accumulated while walking the token tree ──

interface StyleState {
  bold: boolean;
  italic: boolean;
  linkHref: string | null;
}

const EMPTY_STYLE: StyleState = { bold: false, italic: false, linkHref: null };

const styleClass = (s: StyleState): string => {
  const parts: string[] = [];
  if (s.bold) parts.push("flat-bold");
  if (s.italic) parts.push("flat-italic");
  if (s.linkHref !== null) parts.push("demo-link");
  return parts.join(" ");
};

// Emit leaf text (with \n → <br>) wrapped in a styled <span> or <a>.
const emitText = (text: string, style: StyleState, out: Child[]): void => {
  const lines = text.split("\n");
  const cls = styleClass(style);
  const isLink = style.linkHref !== null;

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out.push(h("br"));
    if (!lines[i]) continue;
    if (!cls && !isLink) {
      out.push(lines[i]);
    } else if (isLink) {
      out.push(
        h(
          "a",
          { class: cls, href: style.linkHref ?? "#", target: "_blank", rel: "noreferrer" },
          lines[i],
        ),
      );
    } else {
      out.push(h("span", { class: cls }, lines[i]));
    }
  }
};

const trimTrailingBrs = (nodes: Child[]): Child[] => {
  while (nodes.length > 0) {
    const last = nodes[nodes.length - 1];
    if (typeof last !== "string" && typeof last === "object" && last.type === "br") {
      nodes.pop();
    } else {
      break;
    }
  }
  return nodes;
};

// ── Flat iterative renderer ──
//
// Inline containers (bold/italic/link) do NOT produce nested DOM.
// Instead we track accumulated style and emit flat <span>/<a> leaves.
// Block-level tokens (warn/code) produce shallow, self-contained sections.
//
// This keeps the VNode tree at constant depth regardless of token nesting,
// so Vue's recursive mountChildren never overflows.

interface TraversalFrame {
  tokens: readonly TextToken[];
  index: number;
  style: StyleState;
}

// Separate flat renderer for shallow sub-trees (warn title/meta).
// These are guaranteed shallow so a simple iterative walk is fine.
const renderShallowFlat = (tokens: readonly TextToken[]): Child[] => {
  const out: Child[] = [];
  const stack: TraversalFrame[] = [{ tokens, index: 0, style: EMPTY_STYLE }];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.tokens.length) {
      stack.pop();
      continue;
    }
    const token = frame.tokens[frame.index++];
    if (token.type === "text") {
      emitText(String(token.value ?? ""), frame.style, out);
      continue;
    }
    if (token.type === "bold" && Array.isArray(token.value)) {
      stack.push({
        tokens: token.value as TextToken[],
        index: 0,
        style: { ...frame.style, bold: true },
      });
      continue;
    }
    if (token.type === "italic" && Array.isArray(token.value)) {
      stack.push({
        tokens: token.value as TextToken[],
        index: 0,
        style: { ...frame.style, italic: true },
      });
      continue;
    }
    if (Array.isArray(token.value)) {
      stack.push({ tokens: token.value as TextToken[], index: 0, style: frame.style });
      continue;
    }
    emitText(String(token.value ?? ""), frame.style, out);
  }
  return out;
};

const renderTokensFlat = (tokens: readonly TextToken[]): Child[] => {
  const out: Child[] = [];
  const stack: TraversalFrame[] = [{ tokens, index: 0, style: EMPTY_STYLE }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.index >= frame.tokens.length) {
      stack.pop();
      continue;
    }

    const token = frame.tokens[frame.index++];

    if (token.type === "text") {
      emitText(String(token.value ?? ""), frame.style, out);
      continue;
    }

    if (token.type === "bold" && Array.isArray(token.value)) {
      stack.push({
        tokens: token.value as TextToken[],
        index: 0,
        style: { ...frame.style, bold: true },
      });
      continue;
    }

    if (token.type === "italic" && Array.isArray(token.value)) {
      stack.push({
        tokens: token.value as TextToken[],
        index: 0,
        style: { ...frame.style, italic: true },
      });
      continue;
    }

    if (token.type === "link" && Array.isArray(token.value)) {
      const href = typeof token.href === "string" && token.href ? token.href : "#";
      stack.push({
        tokens: token.value as TextToken[],
        index: 0,
        style: { ...frame.style, linkHref: href },
      });
      continue;
    }

    if (token.type === "ruby") {
      out.push(
        h("ruby", { class: "demo-ruby" }, [
          String(token.base ?? ""),
          h("rt", {}, String(token.rt ?? "")),
        ]),
      );
      continue;
    }

    if (token.type === "warn") {
      const titleContent =
        Array.isArray(token.titleTokens) && (token.titleTokens as TextToken[]).length > 0
          ? renderShallowFlat(token.titleTokens as TextToken[])
          : [String(token.title ?? "Notice")];
      const metaChips = Array.isArray(token.metaTokens)
        ? (token.metaTokens as TextToken[][])
            .filter((item) => Array.isArray(item) && item.length > 0)
            .map((item, i) =>
              h("span", { class: "demo-warn-meta-chip", key: i }, renderShallowFlat(item)),
            )
        : [];

      const bodyContent = Array.isArray(token.value)
        ? trimTrailingBrs(renderTokensFlat(token.value as TextToken[]))
        : [String(token.value ?? "")];

      out.push(
        h("section", { class: "demo-warn" }, [
          h("div", { class: "demo-warn-head" }, [
            h("div", { class: "demo-warn-title" }, titleContent),
            ...(metaChips.length > 0
              ? [h("div", { class: "demo-warn-meta" }, metaChips)]
              : []),
          ]),
          h("div", { class: "demo-warn-body" }, bodyContent),
        ]),
      );
      continue;
    }

    if (token.type === "code") {
      const language = String(token.language ?? "plain");
      const title = String(token.title ?? "");
      out.push(
        h("section", { class: "demo-code" }, [
          h("div", { class: "demo-code-head" }, [
            h("span", { class: "demo-code-lang" }, language),
            ...(title ? [h("span", { class: "demo-code-title" }, title)] : []),
          ]),
          h("pre", { class: "demo-code-body" }, [h("code", {}, String(token.value ?? ""))]),
        ]),
      );
      continue;
    }

    // Unknown type with array value → descend with same style
    if (Array.isArray(token.value)) {
      stack.push({ tokens: token.value as TextToken[], index: 0, style: frame.style });
      continue;
    }

    // Fallback
    emitText(String(token.value ?? ""), frame.style, out);
  }

  return out;
};

export default defineComponent({
  name: "TokenRenderer",
  props: {
    tokens: {
      type: Array as PropType<readonly TextToken[]>,
      required: true,
    },
  },
  setup(props) {
    return () => renderTokensFlat(props.tokens);
  },
});
