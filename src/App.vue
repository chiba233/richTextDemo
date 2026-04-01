<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  autocompletion,
  closeCompletion,
  snippetCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import { EditorState, Prec, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, keymap, ViewPlugin } from "@codemirror/view";
import { basicSetup } from "codemirror";
import {
  buildPositionTracker,
  createParser,
  createPipeHandlers,
  createSimpleInlineHandlers,
  createSyntax,
  declareMultilineTags,
} from "yume-dsl-rich-text";
import { createTokenizerFromParser } from "yume-dsl-shiki-highlight";
import { enclosingNode, nodeAtOffset, parseSlice } from "yume-dsl-token-walker";

const languages = [
  { key: "zh", label: "中文" },
  { key: "en", label: "EN" },
  { key: "ja", label: "日本語" },
];

const translations = {
  zh: {
    heroKicker: "Vue 3 + yume-dsl-rich-text",
    heroTitle: "左边输入 DSL，右边看渲染结果",
    heroCopy:
      "这个 demo 演示的是主 API：<code>createParser</code> + 事先声明好的 handlers。右侧会先展示 <code>parseStructural + nodeAtOffset/enclosingNode + parseSlice</code> 的局部重解析，再展示“旧结果 + 局部更新”拼出来的最终效果图。更进一步的增量解析只是继续覆盖一部分更重的编辑场景。",
    registryEyebrow: "Registry",
    registryTitle: "用户自己声明 handler",
    sourceEyebrow: "Source",
    sourceTitle: "用户输入",
    previewEyebrow: "Preview",
    previewTitle: "结果",
    deepSample: "100 层嵌套",
    deepSampleHint: "生成超深嵌套，观察默认深度限制下的降级行为。",
    declared: "已声明",
    caret: "光标 offset",
    hit: "命中",
    range: "范围",
    noSlice: "未命中可切片节点",
    parseSliceLabel: "parseSlice",
    structuralLabel: "Structural",
    composeLabel: "Compose",
    reusedLabel: "复用片段",
    sliceTitle: "主 API 局部重解析",
    sliceCopy: "用光标 offset 命中节点，再通过 <code>parseSlice(...)</code> 只解析这段源码。",
    sliceEmpty: "当前光标没有命中可切片的带位置节点，暂时只显示最终效果图。",
    composedTitle: "最终效果图",
    composedCopy: "这里不是重新整篇 full parse，而是基于上一次结果，叠加当前局部重解析后的片段。",
    registryDescriptions: {
      bold: "简单 inline handler，渲染成 strong。",
      italic: "简单 inline handler，渲染成 em。",
      link: "pipe 参数 handler，支持 =link<url | text>=。",
      ruby: "pipe 参数 handler，支持 =ruby<汉字 | 注音>=。",
      warn: "同时声明 inline + block，支持 =warn<title | meta1 | meta2>=。",
      code: "raw handler，支持 =code<lang | title>% ... %。",
    },
    sampleSource: `欢迎来到 =bold<yume-dsl-rich-text>= demo。

这个 demo 使用了自定义语法：= 代替 $$，<> 代替 ()，>= 代替 )$$，~ 代替 \\。

这里我们事先声明了 =bold<bold>=、=italic<italic>=、=link<https://github.com/chiba233/yumeDSL | link>=、=ruby<漢字 | かんじ>=、=warn<warn | beta | ui>=。

如果你把左侧的某个声明关掉，再回来看看这里的渲染会怎么退化。

参数里的转义只对语法符号生效，比如 =italic<字面 ~<尖括号~> ~| 分隔符>=。

嵌套 inline 也可以工作，比如 =bold<外层里还有 =italic<italic>= 和 =ruby<漢字 | かんじ>=>=。

=warn<注意 | beta | ui>*
这不是”自动识别全部标签”。
只有页面初始化时声明过的 handler，才会被渲染成对应效果。
*
=warn<可嵌套标题 | beta | ui>*
块级内容里也可以继续放 =bold<inline>=、=italic<嵌套>= 和 =link<https://github.com/chiba233/yumeDSL | link>=。
*
=code<js | raw demo>%
const message = “raw tag works”;
console.log(message);
%`,
  },
  en: {
    heroKicker: "Vue 3 + yume-dsl-rich-text",
    heroTitle: "Type DSL on the left, see the result on the right",
    heroCopy:
      "This demo uses the main API: <code>createParser</code> plus predeclared handlers. On the right, it first shows local reparsing with <code>parseStructural + nodeAtOffset/enclosingNode + parseSlice</code>, then the final composed preview built from the previous result plus the updated local slice. More advanced incremental parsing only extends coverage for heavier editing scenarios.",
    registryEyebrow: "Registry",
    registryTitle: "User-declared handlers",
    sourceEyebrow: "Source",
    sourceTitle: "Input",
    previewEyebrow: "Preview",
    previewTitle: "Result",
    deepSample: "100-level Nest",
    deepSampleHint: "Generate very deep nesting to observe fallback under the default depth limit.",
    declared: "Declared",
    caret: "Caret offset",
    hit: "Hit",
    range: "Range",
    noSlice: "No sliceable node at the current caret position",
    parseSliceLabel: "parseSlice",
    structuralLabel: "Structural",
    composeLabel: "Compose",
    reusedLabel: "Reused segments",
    sliceTitle: "Main API local reparse",
    sliceCopy:
      "Locate the current node by caret offset, then reparse only that source span with <code>parseSlice(...)</code>.",
    sliceEmpty:
      "The current caret position does not hit a sliceable node with positions, so only the composed preview is shown.",
    composedTitle: "Final composed preview",
    composedCopy:
      "This is not a fresh full parse. It reuses the previous result and overlays the newly reparsed local slice.",
    registryDescriptions: {
      bold: "Simple inline handler rendered as strong.",
      italic: "Simple inline handler rendered as em.",
      link: "Pipe-arg handler for =link<url | text>=.",
      ruby: "Pipe-arg handler for =ruby<base | ruby-text>=.",
      warn: "Declares both inline and block forms, with =warn<title | meta1 | meta2>=.",
      code: "Raw handler for =code<lang | title>% ... %.",
    },
    sampleSource: `Welcome to the =bold<yume-dsl-rich-text>= demo.

This demo uses a custom syntax: = instead of $$, <> instead of (), >= instead of )$$, ~ instead of \\.

We predeclare =bold<bold>=, =italic<italic>=, =link<https://github.com/chiba233/yumeDSL | link>=, =ruby<漢字 | kanji>=, and =warn<warn | beta | ui>=.

Disable one of the declarations on the left and watch how the rendering degrades.

Escapes only apply to syntax tokens, for example =italic<literal ~<angle~> ~| divider>=.

Nested inline tags also work, for example =bold<outer with =italic<italic>= and =ruby<漢字 | kanji>= inside>=.

=warn<Notice | beta | ui>*
This does not auto-detect every tag.
Only handlers declared up front are rendered into custom output.
*
=warn<Nested title | beta | ui>*
Block content can still contain =bold<inline>=, =italic<nested>=, and =link<https://github.com/chiba233/yumeDSL | link>=.
*
=code<js | raw demo>%
const message = "raw tag works";
console.log(message);
%`,
  },
  ja: {
    heroKicker: "Vue 3 + yume-dsl-rich-text",
    heroTitle: "左で DSL を入力し、右で結果を確認",
    heroCopy:
      "このデモはメイン API、つまり <code>createParser</code> と事前宣言した handlers を使っています。右側ではまず <code>parseStructural + nodeAtOffset/enclosingNode + parseSlice</code> による部分再解析を示し、その後に「前回の結果 + 今回の局所更新」で組み立てた最終プレビューを表示します。さらに進んだ増量解析は、より重い編集シナリオの一部を追加でカバーするものです。",
    registryEyebrow: "Registry",
    registryTitle: "ユーザーが宣言する handler",
    sourceEyebrow: "Source",
    sourceTitle: "入力",
    previewEyebrow: "Preview",
    previewTitle: "結果",
    deepSample: "100層ネスト",
    deepSampleHint: "超深いネストを生成して、デフォルト深度制限での降格動作を確認します。",
    declared: "宣言済み",
    caret: "キャレット offset",
    hit: "ヒット",
    range: "範囲",
    noSlice: "現在のカーソル位置では slice 可能なノードに当たっていません",
    parseSliceLabel: "parseSlice",
    structuralLabel: "Structural",
    composeLabel: "Compose",
    reusedLabel: "再利用片段",
    sliceTitle: "メイン API の部分再解析",
    sliceCopy:
      "カーソル offset でノードを特定し、その範囲だけ <code>parseSlice(...)</code> で再解析します。",
    sliceEmpty:
      "現在のカーソル位置では位置情報付きの slice 対象ノードに当たっていないため、合成結果のみ表示します。",
    composedTitle: "最終プレビュー",
    composedCopy:
      "これは毎回 full parse し直した結果ではなく、前回の結果に今回の局所更新を重ねた表示です。",
    registryDescriptions: {
      bold: "strong に変換するシンプルな inline handler。",
      italic: "em に変換するシンプルな inline handler。",
      link: "=link<url | text>= 用の pipe 引数 handler。",
      ruby: "=ruby<漢字 | ふりがな>= 用の pipe 引数 handler。",
      warn: "inline と block の両方を宣言し、=warn<title | meta1 | meta2>= に対応。",
      code: "=code<lang | title>% ... % 用の raw handler。",
    },
    sampleSource: `=bold<yume-dsl-rich-text>= デモへようこそ。

このデモではカスタム構文を使用しています：$$ の代わりに =、() の代わりに <>、)$$ の代わりに >=、\\ の代わりに ~ を使います。

ここでは =bold<bold>=、=italic<italic>=、=link<https://github.com/chiba233/yumeDSL | link>=、=ruby<漢字 | かんじ>=、=warn<warn | beta | ui>= を事前に宣言しています。

左側の宣言をひとつ外して、表示がどう変化するか試してみてください。

エスケープは構文トークンにだけ効きます。たとえば =italic<文字どおりの ~<山括弧~> ~| 区切り>= のように書けます。

inline の入れ子も可能で、たとえば =bold<外側の中に =italic<italic>= と =ruby<漢字 | かんじ>= を入れられます>=。

=warn<注意 | beta | ui>*
これは「すべてのタグを自動認識」する仕組みではありません。
事前に宣言した handler だけが対応する表示へ変換されます。
*
=warn<入れ子タイトル | beta | ui>*
block 内容の中でも =bold<inline>=、=italic<入れ子>=、=link<https://github.com/chiba233/yumeDSL | link>= を使えます。
*
=code<js | raw demo>%
const message = "raw tag works";
console.log(message);
%`,
  },
};

const registryBase = [
  { key: "bold", label: "bold" },
  { key: "italic", label: "italic" },
  { key: "link", label: "link" },
  { key: "ruby", label: "ruby" },
  { key: "warn", label: "warn" },
  { key: "code", label: "code" },
];

const currentLang = ref("zh");
const copy = computed(() => translations[currentLang.value]);
const enabledTags = ref(["bold", "italic", "link", "ruby", "warn", "code"]);
const caretOffset = ref(0);
const source = ref(translations.zh.sampleSource);

watch(currentLang, (lang) => {
  source.value = translations[lang].sampleSource;
  caretOffset.value = 0;
});

const createDeepNestedSample = (lang) => {
  const leafByLang = {
    zh: "depth-limit demo",
    en: "depth-limit demo",
    ja: "depth-limit demo",
  };
  let value = leafByLang[lang] ?? leafByLang.en;
  for (let i = 100; i >= 1; i--) {
    value = `=bold<L${i}: ${value}>=`;
  }
  return value;
};

const loadDeepNestedSample = () => {
  source.value = createDeepNestedSample(currentLang.value);
  caretOffset.value = source.value.length;
};

const registryOptions = computed(() =>
  registryBase.map((item) => ({
    ...item,
    description: copy.value.registryDescriptions[item.key],
  })),
);

const completionTemplates = {
  bold: [
    {
      label: "bold",
      detail: "inline",
      template: "=bold<${text}>=",
      insertText: "=bold<>=",
      cursorOffset: "=bold<".length,
      info: "Insert a simple inline bold tag.",
    },
  ],
  italic: [
    {
      label: "italic",
      detail: "inline",
      template: "=italic<${text}>=",
      insertText: "=italic<>=",
      cursorOffset: "=italic<".length,
      info: "Insert a simple inline italic tag.",
    },
  ],
  link: [
    {
      label: "link",
      detail: "inline",
      template: "=link<${https://example.com} | ${label}>=",
      insertText: "=link<https://example.com | label>=",
      cursorOffset: "=link<".length,
      info: "Insert a link tag with URL and label.",
    },
  ],
  ruby: [
    {
      label: "ruby",
      detail: "inline",
      template: "=ruby<${漢字} | ${かんじ}>=",
      insertText: "=ruby<漢字 | かんじ>=",
      cursorOffset: "=ruby<".length,
      info: "Insert ruby base text and reading.",
    },
  ],
  warn: [
    {
      label: "warn",
      detail: "inline",
      template: "=warn<${title} | ${meta1} | ${meta2}>=",
      insertText: "=warn<title | meta1 | meta2>=",
      cursorOffset: "=warn<".length,
      info: "Insert an inline warn tag with extra metadata slots.",
    },
    {
      label: "warn block",
      detail: "block",
      template: "=warn<${title} | ${meta1} | ${meta2}>*\n${content}\n*",
      insertText: "=warn<title | meta1 | meta2>*\ncontent\n*",
      cursorOffset: "=warn<".length,
      info: "Insert a block warn tag.",
    },
  ],
  code: [
    {
      label: "code",
      detail: "raw",
      template: "=code<${lang} | ${title}>%\n${content}\n%",
      insertText: "=code<lang | title>%\ncontent\n%",
      cursorOffset: "=code<".length,
      info: "Insert a raw code block tag.",
    },
  ],
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderText = (value) => escapeHtml(String(value)).replaceAll("\n", "<br />");
const trimTrailingBreak = (html) => html.replace(/(?:<br \/>)+$/, "");

const renderTokens = (tokens) =>
  tokens
    .map((token) => {
      if (token.type === "text") return renderText(token.value);
      if (token.type === "bold") return `<strong>${renderTokens(token.value)}</strong>`;
      if (token.type === "italic") return `<em>${renderTokens(token.value)}</em>`;

      if (token.type === "link") {
        const href = typeof token.href === "string" && token.href ? token.href : "#";
        return `<a class="demo-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${renderTokens(token.value)}</a>`;
      }

      if (token.type === "ruby") {
        return `<ruby class="demo-ruby">${escapeHtml(String(token.base ?? ""))}<rt>${escapeHtml(String(token.rt ?? ""))}</rt></ruby>`;
      }

      if (token.type === "warn") {
        const title =
          Array.isArray(token.titleTokens) && token.titleTokens.length > 0
            ? renderTokens(token.titleTokens)
            : escapeHtml(String(token.title ?? "Notice"));
        const meta = Array.isArray(token.metaTokens)
          ? token.metaTokens
              .filter((item) => Array.isArray(item) && item.length > 0)
              .map((item) => `<span class="demo-warn-meta-chip">${renderTokens(item)}</span>`)
              .join("")
          : "";
        const body = trimTrailingBreak(renderTokens(token.value));
        return [
          `<section class="demo-warn">`,
          `<div class="demo-warn-head">`,
          `<div class="demo-warn-title">${title}</div>`,
          meta ? `<div class="demo-warn-meta">${meta}</div>` : "",
          `</div>`,
          `<div class="demo-warn-body">${body}</div>`,
          `</section>`,
        ].join("");
      }

      if (token.type === "code") {
        const language = escapeHtml(String(token.language ?? "plain"));
        const title = escapeHtml(String(token.title ?? ""));
        return [
          `<section class="demo-code">`,
          `<div class="demo-code-head">`,
          `<span class="demo-code-lang">${language}</span>`,
          title ? `<span class="demo-code-title">${title}</span>` : "",
          `</div>`,
          `<pre class="demo-code-body"><code>${escapeHtml(String(token.value ?? ""))}</code></pre>`,
          `</section>`,
        ].join("");
      }

      if (Array.isArray(token.value)) return renderTokens(token.value);
      return `<span>${escapeHtml(String(token.value ?? ""))}</span>`;
    })
    .join("");

const activeHandlers = computed(() => {
  const enabled = new Set(enabledTags.value);
  const handlers = {};

  if (enabled.has("bold") || enabled.has("italic")) {
    Object.assign(
      handlers,
      createSimpleInlineHandlers(["bold", "italic"].filter((name) => enabled.has(name))),
    );
  }

  const pipeDefinitions = {};

  if (enabled.has("link")) {
    pipeDefinitions.link = {
      inline: (args) => ({
        type: "link",
        href: args.text(0) || "#",
        value: args.materializedTailTokens(1),
      }),
    };
  }

  if (enabled.has("ruby")) {
    pipeDefinitions.ruby = {
      inline: (args) => ({
        type: "ruby",
        base: args.text(0),
        rt: args.text(1),
        value: args.materializedTokens(0),
      }),
    };
  }

  if (enabled.has("warn")) {
    pipeDefinitions.warn = {
      inline: (args) => ({
        type: "warn",
        title: args.text(0) || "Notice",
        titleTokens: args.materializedTokens(0),
        metaTokens: [args.materializedTokens(1), args.materializedTokens(2)].filter(
          (item) => item.length > 0,
        ),
        value: args.materializedTailTokens(3),
      }),
      block: (args, content) => ({
        type: "warn",
        title: args.text(0) || "Notice",
        titleTokens: args.materializedTokens(0),
        metaTokens: [args.materializedTokens(1), args.materializedTokens(2)].filter(
          (item) => item.length > 0,
        ),
        value: content,
      }),
    };
  }

  if (enabled.has("code")) {
    pipeDefinitions.code = {
      raw: (args, content) => ({
        type: "code",
        language: args.text(0) || "plain",
        title: args.text(1) || "",
        value: content,
      }),
    };
  }

  if (Object.keys(pipeDefinitions).length > 0) {
    Object.assign(handlers, createPipeHandlers(pipeDefinitions));
  }

  return handlers;
});

const activeBlockTags = computed(() => {
  const tags = [];
  if (enabledTags.value.includes("warn")) tags.push("warn");
  if (enabledTags.value.includes("code")) tags.push({ tag: "code", forms: ["raw"] });
  return declareMultilineTags(tags);
});

const demoSyntax = createSyntax({
  tagPrefix: "=",
  tagOpen: "<",
  tagClose: ">",
  tagDivider: "|",
  endTag: ">=",
  rawOpen: ">%",
  blockOpen: ">*",
  rawClose: "%",
  blockClose: "*",
  escapeChar: "~",
});

const parserOptions = computed(() => ({
  handlers: activeHandlers.value,
  blockTags: activeBlockTags.value,
  syntax: demoSyntax,
}));

const parser = computed(() => createParser(parserOptions.value));
const tokenizer = computed(() =>
  createTokenizerFromParser(parserOptions.value, {
    punct: "#ffd166",
    tagName: "#ff6b6b",
    bracket: "#f4a261",
    operator: "#e9c46a",
    separator: "#4cc9f0",
    end: "#80ed99",
    escape: "#c77dff",
    argText: "#fff1db",
    contentText: "#f8f9fa",
  }),
);

const completionOptions = computed(() =>
  enabledTags.value.flatMap((tag) =>
    (completionTemplates[tag] ?? []).map((entry) =>
      snippetCompletion(entry.template, {
        label: entry.label,
        detail: entry.detail,
        info: entry.info,
      }),
    ),
  ),
);

const plainCompletionEntries = computed(() =>
  enabledTags.value.flatMap((tag) =>
    (completionTemplates[tag] ?? []).map((entry) => ({
      ...entry,
      tag,
    })),
  ),
);

const structuralState = computed(() => {
  const started = performance.now();
  const tree = parser.value.structural(source.value, { trackPositions: true });
  return { tree, ms: performance.now() - started };
});

const sliceState = computed(() => {
  try {
    const safeOffset = Math.max(0, Math.min(caretOffset.value, source.value.length));
    const tree = structuralState.value.tree;
    const deepNode = nodeAtOffset(tree, safeOffset);
    const tagNode = enclosingNode(tree, safeOffset);
    const targetNode = tagNode ?? deepNode;

    if (!targetNode?.position) {
      return {
        error: "",
        html: "",
        sliceMs: 0,
        targetLabel: copy.value.noSlice,
        rangeLabel: "n/a",
        node: null,
      };
    }

    const tracker = buildPositionTracker(source.value);
    const started = performance.now();
    const tokens = parseSlice(source.value, targetNode.position, parser.value, tracker);
    return {
      error: "",
      html: renderTokens(tokens),
      sliceMs: performance.now() - started,
      targetLabel: `${targetNode.type}${targetNode.tag ? `:${targetNode.tag}` : ""}`,
      rangeLabel: `${targetNode.position.start.offset}-${targetNode.position.end.offset}`,
      node: targetNode,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      html: "",
      sliceMs: 0,
      targetLabel: "error",
      rangeLabel: "n/a",
      node: null,
    };
  }
});

const editorRoot = ref(null);
const completionPanel = ref(null);
const panelHeight = ref(860);
const selectedCompletionIndex = ref(0);
const completionPanelStyle = ref({});
const showCompletionPanel = ref(false);
let completionDismissedAt = -1;
let editorView = null;

const currentDslCompletion = computed(() => {
  const head = caretOffset.value;
  const before = source.value.slice(Math.max(0, head - 64), head);
  const match = before.match(/(?<![>~])=([A-Za-z-]*)$/);
  if (!match) return null;

  const typed = match[1] ?? "";
  const options = plainCompletionEntries.value.filter((entry) => entry.label.startsWith(typed));
  if (options.length === 0) return null;

  return {
    from: head - match[0].length,
    to: head,
    typed,
    options,
  };
});

const applyCompletionTemplate = (entry) => {
  if (!editorView || !currentDslCompletion.value) return;
  const { from, to } = currentDslCompletion.value;
  editorView.dispatch({
    changes: { from, to, insert: entry.insertText },
    selection: { anchor: from + entry.cursorOffset },
  });
  showCompletionPanel.value = false;
  editorView.focus();
};

const syncCompletionScroll = () => {
  queueMicrotask(() => {
    const active = completionPanel.value?.querySelector(".editor-completion-item-active");
    active?.scrollIntoView({ block: "nearest" });
  });
};

const moveCompletionSelection = (delta) => {
  if (!currentDslCompletion.value) return false;
  const { options } = currentDslCompletion.value;
  selectedCompletionIndex.value =
    (selectedCompletionIndex.value + delta + options.length) % options.length;
  syncCompletionScroll();
  return true;
};

const applySelectedCompletion = () => {
  if (!currentDslCompletion.value) return false;
  const option = currentDslCompletion.value.options[selectedCompletionIndex.value];
  if (!option) return false;
  applyCompletionTemplate(option);
  return true;
};

const updateCompletionPanelPosition = () => {
  if (
    !editorView ||
    !editorRoot.value ||
    !currentDslCompletion.value ||
    !showCompletionPanel.value
  ) {
    completionPanelStyle.value = {};
    return;
  }

  const caret = editorView.coordsAtPos(editorView.state.selection.main.head);
  const rootRect = editorRoot.value.getBoundingClientRect();
  if (!caret) {
    completionPanelStyle.value = {};
    return;
  }

  const panelWidth = Math.min(320, Math.max(220, rootRect.width - 24));
  const left = Math.min(
    Math.max(12, caret.left - rootRect.left),
    Math.max(12, rootRect.width - panelWidth - 12),
  );
  const top = Math.min(
    Math.max(12, caret.bottom - rootRect.top + 8),
    Math.max(12, rootRect.height - 192),
  );

  completionPanelStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${panelWidth}px`,
  };
};

const buildHighlightPlugin = (tokenize) =>
  ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.build(view);
      }

      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      build(view) {
        const tokens = tokenize(view.state.doc.toString());
        const builder = new RangeSetBuilder();
        let offset = 0;

        for (const token of tokens) {
          const length = token.content.length;
          if (length > 0 && token.color) {
            builder.add(
              offset,
              offset + length,
              Decoration.mark({ attributes: { style: `color: ${token.color}` } }),
            );
          }
          offset += length;
        }

        return builder.finish();
      }
    },
    { decorations: (value) => value.decorations },
  );

const completeDslTag = (context) => {
  const before = context.matchBefore(/(?<![>~])=[A-Za-z-]*/);
  if (!before) return null;
  if (!context.explicit && before.from === before.to) return null;

  const typed = before.text.slice(1);
  const options = completionOptions.value.filter((option) => option.label.startsWith(typed));
  if (options.length === 0) return null;

  return {
    from: before.from,
    options,
    validFor: /^(?<![>~])=[A-Za-z-]*$/,
  };
};

const shouldTriggerDslCompletion = (view) => {
  const head = view.state.selection.main.head;
  const before = view.state.sliceDoc(Math.max(0, head - 64), head);
  const match = before.match(/(?<![>~])=([A-Za-z-]*)$/);
  if (!match) return false;
  return true;
};

const queueCompletion = (view) => {
  queueMicrotask(() => {
    if (!view.hasFocus) return;
    if (completionDismissedAt >= 0) {
      completionDismissedAt = -1;
      return;
    }
    if (shouldTriggerDslCompletion(view)) {
      selectedCompletionIndex.value = 0;
      showCompletionPanel.value = true;
      startCompletion(view);
      updateCompletionPanelPosition();
    } else {
      showCompletionPanel.value = false;
      closeCompletion(view);
      completionPanelStyle.value = {};
    }
  });
};

const createEditorExtensions = () => [
  basicSetup,
  EditorView.lineWrapping,
  autocompletion({
    override: [completeDslTag],
    activateOnTyping: true,
    defaultKeymap: true,
  }),
  buildHighlightPlugin((text) => tokenizer.value.tokenize(text)),
  Prec.highest(
    keymap.of([
      {
        key: "ArrowDown",
        run: () => moveCompletionSelection(1),
      },
      {
        key: "ArrowUp",
        run: () => moveCompletionSelection(-1),
      },
      {
        key: "Enter",
        run: () => applySelectedCompletion(),
      },
      {
        key: "Tab",
        run: () => applySelectedCompletion(),
      },
      {
        key: "Escape",
        run: () => {
          if (!editorView) return false;
          showCompletionPanel.value = false;
          completionDismissedAt = editorView.state.selection.main.head;
          closeCompletion(editorView);
          completionPanelStyle.value = {};
          return true;
        },
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        key: String(index + 1),
        run: () => {
          if (!currentDslCompletion.value) return false;
          selectedCompletionIndex.value = Math.min(
            index,
            currentDslCompletion.value.options.length - 1,
          );
          syncCompletionScroll();
          return applySelectedCompletion();
        },
      })),
    ]),
  ),
  EditorView.domEventHandlers({
    keydown: (_eventView, event) => {
      if (!currentDslCompletion.value) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        return moveCompletionSelection(1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        return moveCompletionSelection(-1);
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        return applySelectedCompletion();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeCompletion(editorView);
        return true;
      }
      return false;
    },
  }),
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const nextSource = update.state.doc.toString();
      if (nextSource !== source.value) source.value = nextSource;
      queueCompletion(update.view);
    }

    if (update.docChanged || update.selectionSet) {
      caretOffset.value = update.state.selection.main.head;
      updateCompletionPanelPosition();
    }

    if (!update.docChanged && update.selectionSet) {
      showCompletionPanel.value = false;
      closeCompletion(update.view);
      completionPanelStyle.value = {};
    }

    if (update.viewportChanged) {
      updateCompletionPanelPosition();
    }
  }),
  EditorView.theme({
    "&": {
      height: "100%",
      backgroundColor: "#171311",
      color: "#f7f1e8",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: '"SFMono-Regular", "JetBrains Mono", "Menlo", monospace',
      lineHeight: "1.65",
      scrollbarGutter: "stable",
    },
    ".cm-content, .cm-gutter": {
      minHeight: "100%",
    },
    ".cm-content": {
      padding: "18px 0",
      caretColor: "#fff4de",
      fontKerning: "none",
      fontVariantLigatures: "none",
      fontFeatureSettings: '"liga" 0, "calt" 0',
    },
    ".cm-line": {
      padding: "0 18px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#fff4de",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(255, 214, 102, 0.22) !important",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255,255,255,0.02)",
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-focused": {
      outline: "none",
    },
  }),
];

const mountEditor = () => {
  if (!editorRoot.value) return;
  editorView?.destroy();
  editorView = new EditorView({
    state: EditorState.create({
      doc: source.value,
      extensions: createEditorExtensions(),
    }),
    parent: editorRoot.value,
  });
  caretOffset.value = editorView.state.selection.main.head;
  updateCompletionPanelPosition();
};

const previousSource = ref(source.value);
const previousRegistrySignature = ref(enabledTags.value.join("|"));
const previousSegmentCache = ref(new Map());
const composedState = ref({
  html: "",
  composeMs: 0,
  reusedCount: 0,
});

const getDiffRange = (previousText, nextText) => {
  if (previousText === nextText) {
    return { changed: false, start: 0, newEnd: 0 };
  }

  let start = 0;
  const minLength = Math.min(previousText.length, nextText.length);
  while (start < minLength && previousText[start] === nextText[start]) start++;

  let oldEnd = previousText.length;
  let newEnd = nextText.length;
  while (oldEnd > start && newEnd > start && previousText[oldEnd - 1] === nextText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  return { changed: true, start, newEnd };
};

watch(
  [source, enabledTags],
  () => {
    const registrySignature = enabledTags.value.join("|");
    if (registrySignature !== previousRegistrySignature.value) {
      previousSegmentCache.value = new Map();
      previousSource.value = "";
      previousRegistrySignature.value = registrySignature;
    }

    const started = performance.now();
    const tracker = buildPositionTracker(source.value);
    const diff = getDiffRange(previousSource.value, source.value);
    const nextCache = new Map();
    let reusedCount = 0;

    const BLOCK_NODE = new Set(["raw", "block"]);
    const tree = structuralState.value.tree;

    const html = tree
      .map((node, idx) => {
        const position = node.position;
        if (!position) return "";

        // Workaround: parseSlice cannot consume the trailing \n after
        // a block/raw closer because it only sees its own slice.
        // Strip one leading \n from text nodes that follow a block/raw node.
        if (node.type === "text" && idx > 0 && BLOCK_NODE.has(tree[idx - 1].type)) {
          const trimmed = node.value.replace(/^\r?\n/, "");
          if (trimmed === "") return "";
          const segHtml = renderTokens([{ ...node, value: trimmed }]);
          nextCache.set(`text::${trimmed}`, segHtml);
          return segHtml;
        }

        const slice = source.value.slice(position.start.offset, position.end.offset);
        const cacheKey = `${node.type}:${node.tag ?? ""}:${slice}`;
        const overlapsDiff =
          diff.changed && position.end.offset > diff.start && position.start.offset < diff.newEnd;
        const matchesTarget =
          sliceState.value.node?.position &&
          position.start.offset === sliceState.value.node.position.start.offset &&
          position.end.offset === sliceState.value.node.position.end.offset;

        if (!overlapsDiff && !matchesTarget && previousSegmentCache.value.has(cacheKey)) {
          reusedCount++;
          const reused = previousSegmentCache.value.get(cacheKey);
          nextCache.set(cacheKey, reused);
          return reused;
        }

        const segmentTokens = parseSlice(source.value, position, parser.value, tracker);
        const segmentHtml = renderTokens(segmentTokens);
        nextCache.set(cacheKey, segmentHtml);
        return segmentHtml;
      })
      .join("");

    composedState.value = {
      html,
      composeMs: performance.now() - started,
      reusedCount,
    };
    previousSegmentCache.value = nextCache;
    previousSource.value = source.value;
  },
  { immediate: true, deep: true },
);

const updatePanelHeight = () => {
  panelHeight.value = Math.min(1140, Math.max(920, window.innerHeight - 140));
};

const handleWindowResize = () => {
  updatePanelHeight();
};

onMounted(async () => {
  await nextTick();
  mountEditor();
  updatePanelHeight();
  window.addEventListener("resize", handleWindowResize);
});

onBeforeUnmount(() => {
  editorView?.destroy();
  editorView = null;
  window.removeEventListener("resize", handleWindowResize);
});

watch(
  enabledTags,
  async () => {
    await nextTick();
    if (!editorView) return;
    const selection = editorView.state.selection;
    mountEditor();
    if (!editorView) return;
    editorView.dispatch({ selection });
  },
  { deep: true },
);

watch(source, (nextSource) => {
  if (!editorView) return;
  const currentDoc = editorView.state.doc.toString();
  if (currentDoc === nextSource) return;
  editorView.dispatch({
    changes: { from: 0, to: currentDoc.length, insert: nextSource },
    selection: { anchor: Math.min(caretOffset.value, nextSource.length) },
  });
});

watch([currentLang, source, enabledTags], async () => {
  await nextTick();
  updatePanelHeight();
});
</script>

<template>
  <main class="page-shell">
    <section class="hero">
      <div class="hero-topline">
        <p class="hero-kicker">{{ copy.heroKicker }}</p>
        <div class="language-switch">
          <button
            v-for="item in languages"
            :key="item.key"
            type="button"
            class="lang-button"
            :class="{ active: currentLang === item.key }"
            @click="currentLang = item.key"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
      <h1>{{ copy.heroTitle }}</h1>
      <p class="hero-copy" v-html="copy.heroCopy" />
      <div class="hero-links">
        <a href="https://github.com/chiba233/yumeDSL" target="_blank" rel="noreferrer">GitHub</a>
        <a href="https://github.com/chiba233/yumeDSL/wiki" target="_blank" rel="noreferrer">Wiki</a>
        <a href="https://www.npmjs.com/package/yume-dsl-rich-text" target="_blank" rel="noreferrer">npm</a>
      </div>
    </section>

    <section class="workspace">
      <article class="panel source-panel">
        <header class="panel-head">
          <p class="eyebrow">{{ copy.registryEyebrow }}</p>
          <h2>{{ copy.registryTitle }}</h2>
        </header>
        <div class="panel-body registry-grid">
          <label v-for="option in registryOptions" :key="option.key" class="registry-item">
            <input v-model="enabledTags" type="checkbox" :value="option.key" />
            <div>
              <div class="registry-title">
                <code>{{ option.label }}</code>
              </div>
              <div class="registry-copy">{{ option.description }}</div>
            </div>
          </label>
        </div>
      </article>

      <article
        class="panel source-panel"
        :style="{ height: `${panelHeight}px`, maxHeight: `${panelHeight}px` }"
      >
        <header class="panel-head">
          <p class="eyebrow">{{ copy.sourceEyebrow }}</p>
          <h2>{{ copy.sourceTitle }}</h2>
        </header>
        <div class="panel-body source-body">
          <div class="source-meta">
            <div class="source-tools">
              <button type="button" class="mini-action" @click="loadDeepNestedSample">
                {{ copy.deepSample }}
              </button>
              <span class="mini-hint">{{ copy.deepSampleHint }}</span>
            </div>
            <div class="tag-list">
              <span v-for="tag in enabledTags" :key="tag" class="tag-chip">
                {{ copy.declared }}: {{ tag }}
              </span>
            </div>
            <div class="slice-meta">
              <span class="meta-chip">{{ copy.caret }}: {{ caretOffset }}</span>
              <span class="meta-chip">{{ copy.hit }}: {{ sliceState.targetLabel }}</span>
              <span class="meta-chip">{{ copy.range }}: {{ sliceState.rangeLabel }}</span>
            </div>
          </div>
          <div class="editor-stack">
            <div
              v-if="showCompletionPanel && currentDslCompletion"
              ref="completionPanel"
              class="editor-completion-panel"
              :style="completionPanelStyle"
            >
              <button
                v-for="option in currentDslCompletion.options"
                :key="`${option.label}:${option.detail}`"
                type="button"
                class="editor-completion-item"
                tabindex="-1"
                :class="{
                  'editor-completion-item-active':
                    currentDslCompletion.options[selectedCompletionIndex] === option,
                }"
                @mousedown.prevent="applyCompletionTemplate(option)"
              >
                <span class="editor-completion-label">{{ option.label }}</span>
                <span class="editor-completion-detail">{{ option.detail }}</span>
              </button>
            </div>
            <div ref="editorRoot" class="editor-root" />
          </div>
        </div>
      </article>

      <article
        class="panel preview-panel"
        :style="{ height: `${panelHeight}px`, maxHeight: `${panelHeight}px` }"
      >
        <header class="panel-head">
          <p class="eyebrow">{{ copy.previewEyebrow }}</p>
          <h2>{{ copy.previewTitle }}</h2>
        </header>
        <div class="panel-body preview-body">
          <div class="compare-grid">
            <div class="compare-card">
              <div class="compare-label">{{ copy.parseSliceLabel }}</div>
              <div class="compare-value">{{ sliceState.sliceMs.toFixed(3) }} ms</div>
            </div>
            <div class="compare-card">
              <div class="compare-label">{{ copy.structuralLabel }}</div>
              <div class="compare-value">{{ structuralState.ms.toFixed(3) }} ms</div>
            </div>
            <div class="compare-card">
              <div class="compare-label">{{ copy.composeLabel }}</div>
              <div class="compare-value">{{ composedState.composeMs.toFixed(3) }} ms</div>
            </div>
            <div class="compare-card compare-card-wide">
              <div class="compare-label">{{ copy.reusedLabel }}</div>
              <div class="compare-value">{{ composedState.reusedCount }}</div>
            </div>
          </div>

          <div v-if="sliceState.error" class="error-box">{{ sliceState.error }}</div>
          <section v-else class="slice-preview-block preview-section preview-section-small">
            <div class="slice-preview-head">
              <h3>{{ copy.sliceTitle }}</h3>
              <p v-html="copy.sliceCopy" />
            </div>
            <div v-if="sliceState.html" class="preview slice-preview" v-html="sliceState.html" />
            <div v-else class="empty-state">
              {{ copy.sliceEmpty }}
            </div>
          </section>

          <section class="slice-preview-block preview-section preview-section-large">
            <div class="slice-preview-head">
              <h3>{{ copy.composedTitle }}</h3>
              <p>{{ copy.composedCopy }}</p>
            </div>
            <div class="preview" v-html="composedState.html" />
          </section>
        </div>
      </article>
    </section>
  </main>
</template>
