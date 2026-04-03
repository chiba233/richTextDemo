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
    heroCopy: `这个 demo 演示的是主 API：<code>createParser</code> + 事先声明好的 handlers。右侧会先展示 <code>parseStructural + nodeAtOffset/enclosingNode + parseSlice</code> 的局部重解析，再展示\u201c旧结果 + 局部更新\u201d拼出来的最终效果图。更进一步的增量解析只是继续覆盖一部分更重的编辑场景。此 demo 为纯 AI 生成产物，仅用作展示。`,
    registryEyebrow: "Registry",
    registryTitle: "用户自己声明 handler",
    sourceEyebrow: "Source",
    sourceTitle: "用户输入",
    previewEyebrow: "Preview",
    previewTitle: "结果",
    deepSample: "10000 层嵌套",
    deepSampleHint: "生成 10000 层嵌套，观察 9950 深度限制下的降级行为。",
    largeSample: "超大文本",
    largeSampleHint: "生成含真实节点的超大文本，测试渲染性能。",
    randomInsert: "随机插入",
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
      "This demo uses the main API: <code>createParser</code> plus predeclared handlers. On the right, it first shows local reparsing with <code>parseStructural + nodeAtOffset/enclosingNode + parseSlice</code>, then the final composed preview built from the previous result plus the updated local slice. More advanced incremental parsing only extends coverage for heavier editing scenarios. This demo is fully AI-generated and is for demonstration purposes only.",
    registryEyebrow: "Registry",
    registryTitle: "User-declared handlers",
    sourceEyebrow: "Source",
    sourceTitle: "Input",
    previewEyebrow: "Preview",
    previewTitle: "Result",
    deepSample: "10000-level Nest",
    deepSampleHint:
      "Generate 10000 levels of nesting to observe fallback under a depth limit of 9950.",
    largeSample: "Large text",
    largeSampleHint: "Generate large text with real nodes to test rendering performance.",
    randomInsert: "Random insert",
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
      "このデモはメイン API、つまり <code>createParser</code> と事前宣言した handlers を使っています。右側ではまず <code>parseStructural + nodeAtOffset/enclosingNode + parseSlice</code> による部分再解析を示し、その後に「前回の結果 + 今回の局所更新」で組み立てた最終プレビューを表示します。さらに進んだ増量解析は、より重い編集シナリオの一部を追加でカバーするものです。このデモは純粋に AI が生成したもので、展示用途のみです。",
    registryEyebrow: "Registry",
    registryTitle: "ユーザーが宣言する handler",
    sourceEyebrow: "Source",
    sourceTitle: "入力",
    previewEyebrow: "Preview",
    previewTitle: "結果",
    deepSample: "10000層ネスト",
    deepSampleHint: "10000 層ネストを生成し、9950 深度制限での降格動作を確認します。",
    largeSample: "大量テキスト",
    largeSampleHint: "実ノードを含む大量テキストを生成し、レンダリング性能をテスト。",
    randomInsert: "ランダム挿入",
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
  for (let i = 10000; i >= 1; i--) {
    value = `=bold<L${i}: ${value}>=`;
  }
  return value;
};

const loadDeepNestedSample = () => {
  source.value = createDeepNestedSample(currentLang.value);
  caretOffset.value = source.value.length;
};

const createLargeSample = () => {
  const fragments = [
    "这是一段普通文本。",
    "=bold<加粗文字>=",
    "=italic<斜体文字>=",
    "=link<https://example.com | 链接>=",
    "=ruby<漢字 | かんじ>=",
    "中间穿插一些 =bold<重要>= 的内容和 =italic<强调>= 的文字。",
    "=warn<提示 | info | v1>*\n这是一个块级警告，里面可以有 =bold<加粗>= 和 =link<https://example.com | 链接>=。\n*",
    "=code<js | example>%\nconst x = Math.random();\nconsole.log(x);\n%",
    "然后再来一些 =ruby<東京 | とうきょう>= 和 =ruby<大阪 | おおさか>=。",
    "=bold<嵌套 =italic<斜体>= 结束>=",
  ];
  const lines = [];
  for (let i = 0; i < 200; i++) {
    lines.push(`段落 ${i + 1}：${fragments[i % fragments.length]}`);
    if (i % 5 === 4) lines.push("");
  }
  return lines.join("\n");
};

const loadLargeSample = () => {
  source.value = createLargeSample();
  caretOffset.value = 0;
};

const randomSnippets = [
  "=bold<随机加粗>=",
  "=italic<随机斜体>=",
  "=link<https://example.com | 随机链接>=",
  "=ruby<漢字 | かんじ>=",
  "随机纯文本片段",
  "=warn<随机提示 | tag>=",
  "=bold<=italic<加粗斜体>==>=",
];

const insertRandomText = () => {
  const snippet = randomSnippets[Math.floor(Math.random() * randomSnippets.length)];
  if (editorView) {
    const docLen = editorView.state.doc.length;
    const pos = Math.floor(Math.random() * (docLen + 1));
    editorView.dispatch({
      changes: { from: pos, insert: snippet },
      selection: { anchor: pos + snippet.length },
    });
    editorView.focus();
  } else {
    const pos = Math.floor(Math.random() * (source.value.length + 1));
    source.value = source.value.slice(0, pos) + snippet + source.value.slice(pos);
    caretOffset.value = pos + snippet.length;
  }
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

const renderTokens = (tokens) => {
  const html = [];
  const stack = [];

  const pushTokens = (items) => {
    for (let i = items.length - 1; i >= 0; i--) {
      stack.push({ kind: "token", token: items[i] });
    }
  };

  const pushWrappedTokens = (items, open, close) => {
    stack.push({ kind: "html", value: close });
    pushTokens(items);
    stack.push({ kind: "html", value: open });
  };

  pushTokens(tokens);

  while (stack.length > 0) {
    const frame = stack.pop();

    if (frame.kind === "html") {
      html.push(frame.value);
      continue;
    }

    const { token } = frame;

    if (token.type === "text") {
      html.push(renderText(token.value));
      continue;
    }

    if (token.type === "bold") {
      pushWrappedTokens(token.value, "<strong>", "</strong>");
      continue;
    }

    if (token.type === "italic") {
      pushWrappedTokens(token.value, "<em>", "</em>");
      continue;
    }

    if (token.type === "link") {
      const href = typeof token.href === "string" && token.href ? token.href : "#";
      pushWrappedTokens(
        token.value,
        `<a class="demo-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">`,
        "</a>",
      );
      continue;
    }

    if (token.type === "ruby") {
      html.push(
        `<ruby class="demo-ruby">${escapeHtml(String(token.base ?? ""))}<rt>${escapeHtml(
          String(token.rt ?? ""),
        )}</rt></ruby>`,
      );
      continue;
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
      html.push(
        [
          `<section class="demo-warn">`,
          `<div class="demo-warn-head">`,
          `<div class="demo-warn-title">${title}</div>`,
          meta ? `<div class="demo-warn-meta">${meta}</div>` : "",
          `</div>`,
          `<div class="demo-warn-body">${body}</div>`,
          `</section>`,
        ].join(""),
      );
      continue;
    }

    if (token.type === "code") {
      const language = escapeHtml(String(token.language ?? "plain"));
      const title = escapeHtml(String(token.title ?? ""));
      html.push(
        [
          `<section class="demo-code">`,
          `<div class="demo-code-head">`,
          `<span class="demo-code-lang">${language}</span>`,
          title ? `<span class="demo-code-title">${title}</span>` : "",
          `</div>`,
          `<pre class="demo-code-body"><code>${escapeHtml(String(token.value ?? ""))}</code></pre>`,
          `</section>`,
        ].join(""),
      );
      continue;
    }

    if (Array.isArray(token.value)) {
      pushTokens(token.value);
      continue;
    }

    html.push(`<span>${escapeHtml(String(token.value ?? ""))}</span>`);
  }

  return html.join("");
};

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
  depthLimit: 9950,
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

    const tracker = getTracker(source.value);
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
        const { from: vpFrom, to: vpTo } = view.viewport;
        // Expand viewport range to line boundaries for correct tokenization
        const lineFrom = view.state.doc.lineAt(vpFrom).from;
        const lineTo = view.state.doc.lineAt(vpTo).to;
        const slice = view.state.sliceDoc(lineFrom, lineTo);
        const tokens = tokenize(slice);
        const builder = new RangeSetBuilder();
        let offset = lineFrom;

        for (const token of tokens) {
          const length = token.content.length;
          const end = offset + length;
          if (end > lineTo) break;
          if (length > 0 && token.color) {
            builder.add(
              offset,
              end,
              Decoration.mark({ attributes: { style: `color: ${token.color}` } }),
            );
          }
          offset = end;
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
let cachedTracker = null;
let cachedTrackerText = "";
const getTracker = (text) => {
  if (text !== cachedTrackerText) {
    cachedTracker = buildPositionTracker(text);
    cachedTrackerText = text;
  }
  return cachedTracker;
};
const composedState = ref({
  html: "",
  segments: [],
  composeMs: 0,
  reusedCount: 0,
});
const hiddenSegments = ref(new Set());

const BLOCK_NODE = new Set(["raw", "block"]);

const getDiffRange = (previousText, nextText) => {
  if (previousText === nextText) {
    return { changed: false, start: 0, oldEnd: 0, newEnd: 0 };
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
  return { changed: true, start, oldEnd, newEnd };
};

// Build chunks from a slice of the structural tree.
// Each chunk: { key, html, srcFrom, srcTo }
const buildChunks = (tree, from, to, text, tracker, cache) => {
  const chunks = [];
  let inlineBuf = "";
  let inlineSrcFrom = -1;
  let inlineSrcTo = -1;
  let reused = 0;

  const flushInline = () => {
    if (!inlineBuf) return;
    chunks.push({
      key: `i-${inlineSrcFrom}-${inlineSrcTo}`,
      html: inlineBuf,
      srcFrom: inlineSrcFrom,
      srcTo: inlineSrcTo,
    });
    inlineBuf = "";
    inlineSrcFrom = -1;
  };

  for (let idx = from; idx < to; idx++) {
    const node = tree[idx];
    const position = node.position;
    if (!position) continue;

    if (node.type === "text" && idx > 0 && BLOCK_NODE.has(tree[idx - 1].type)) {
      const trimmed = node.value.replace(/^\r?\n/, "");
      if (trimmed === "") continue;
      const segHtml = renderTokens([{ ...node, value: trimmed }]);
      cache.set(`text::${trimmed}`, segHtml);
      if (inlineSrcFrom < 0) inlineSrcFrom = position.start.offset;
      inlineSrcTo = position.end.offset;
      inlineBuf += segHtml;
      continue;
    }

    const slice = text.slice(position.start.offset, position.end.offset);
    const cacheKey = `${node.type}:${node.tag ?? ""}:${slice}`;

    let segHtml = cache.get(cacheKey);
    if (segHtml != null) {
      reused++;
    } else {
      const tokens = parseSlice(text, position, parser.value, tracker);
      segHtml = renderTokens(tokens);
      cache.set(cacheKey, segHtml);
    }

    if (BLOCK_NODE.has(node.type)) {
      flushInline();
      chunks.push({
        key: `b-${position.start.offset}-${position.end.offset}`,
        html: segHtml,
        srcFrom: position.start.offset,
        srcTo: position.end.offset,
      });
    } else {
      if (inlineSrcFrom < 0) inlineSrcFrom = position.start.offset;
      inlineSrcTo = position.end.offset;
      inlineBuf += segHtml;
    }
  }
  flushInline();
  return { chunks, reused };
};

watch(
  [source, enabledTags],
  () => {
    const registrySignature = enabledTags.value.join("|");
    const registryChanged = registrySignature !== previousRegistrySignature.value;
    if (registryChanged) {
      previousSegmentCache.value = new Map();
      previousSource.value = "";
      previousRegistrySignature.value = registrySignature;
    }

    const started = performance.now();
    const text = source.value;
    const tree = structuralState.value.tree;
    const prevChunks = composedState.value.segments;

    // ── Full rebuild (first run / registry change) ──
    if (registryChanged || prevChunks.length === 0) {
      const tracker = getTracker(text);
      const cache = new Map();
      const { chunks, reused } = buildChunks(tree, 0, tree.length, text, tracker, cache);
      composedState.value = {
        html: "",
        segments: chunks,
        composeMs: performance.now() - started,
        reusedCount: reused,
      };
      hiddenSegments.value = new Set();
      previousSegmentCache.value = cache;
      previousSource.value = text;
      return;
    }

    // ── Incremental update ──
    const diff = getDiffRange(previousSource.value, text);
    if (!diff.changed) return;

    const delta = text.length - previousSource.value.length;

    // Split previous chunks into before / affected / after
    let firstAffected = prevChunks.length;
    let lastAffected = -1;
    for (let i = 0; i < prevChunks.length; i++) {
      const c = prevChunks[i];
      if (c.srcTo > diff.start && c.srcFrom < diff.oldEnd) {
        if (firstAffected > i) firstAffected = i;
        lastAffected = i;
      }
    }
    // If diff falls in a gap between chunks, widen to the surrounding chunks
    if (lastAffected < 0) {
      for (let i = 0; i < prevChunks.length; i++) {
        if (prevChunks[i].srcFrom >= diff.start) {
          firstAffected = Math.max(0, i - 1);
          lastAffected = i;
          break;
        }
      }
      if (lastAffected < 0) {
        firstAffected = Math.max(0, prevChunks.length - 1);
        lastAffected = prevChunks.length - 1;
      }
    }

    // Find tree node range that covers the affected source region
    const rebuildFrom = firstAffected > 0 ? prevChunks[firstAffected - 1].srcTo : 0;
    const afterFirstIdx = lastAffected + 1;
    const rebuildTo =
      afterFirstIdx < prevChunks.length ? prevChunks[afterFirstIdx].srcFrom + delta : text.length;

    let treeFrom = 0;
    let treeTo = tree.length;
    for (let i = 0; i < tree.length; i++) {
      const pos = tree[i].position;
      if (pos && pos.end.offset > rebuildFrom) {
        treeFrom = i;
        break;
      }
    }
    for (let i = tree.length - 1; i >= treeFrom; i--) {
      const pos = tree[i].position;
      if (pos && pos.start.offset < rebuildTo) {
        treeTo = i + 1;
        break;
      }
    }

    // Rebuild only the affected slice; reuse the segment cache
    const tracker = getTracker(text);
    const cache = previousSegmentCache.value;
    const { chunks: middle, reused } = buildChunks(tree, treeFrom, treeTo, text, tracker, cache);

    // Build new array: before (as-is) + middle (rebuilt) + after (shifted)
    const before = prevChunks.slice(0, firstAffected);
    const after =
      delta === 0
        ? prevChunks.slice(afterFirstIdx)
        : prevChunks.slice(afterFirstIdx).map((c) => ({
            key: c.key.replace(/-\d+-\d+$/, `-${c.srcFrom + delta}-${c.srcTo + delta}`),
            html: c.html,
            srcFrom: c.srcFrom + delta,
            srcTo: c.srcTo + delta,
          }));

    const chunks = before.concat(middle, after);
    composedState.value = {
      html: "",
      segments: chunks,
      composeMs: performance.now() - started,
      reusedCount: reused + before.length + after.length,
    };
    hiddenSegments.value = new Set();
    previousSegmentCache.value = cache;
    previousSource.value = text;
  },
  { immediate: true, deep: true },
);

const updatePanelHeight = () => {
  panelHeight.value = Math.min(1140, Math.max(920, window.innerHeight - 140));
};

const handleWindowResize = () => {
  updatePanelHeight();
};

const lazyRoot = ref(null);
const segmentHeights = ref(new Map());
let lazyObserver = null;

const setupLazyObserver = () => {
  if (lazyObserver) lazyObserver.disconnect();
  if (!lazyRoot.value) return;
  hiddenSegments.value = new Set();
  segmentHeights.value = new Map();
  lazyObserver = new IntersectionObserver(
    (entries) => {
      const next = new Set(hiddenSegments.value);
      const heights = new Map(segmentHeights.value);
      for (const entry of entries) {
        const idx = Number(entry.target.dataset.segIdx);
        if (entry.isIntersecting) {
          next.delete(idx);
        } else {
          heights.set(idx, entry.target.getBoundingClientRect().height);
          next.add(idx);
        }
      }
      segmentHeights.value = heights;
      hiddenSegments.value = next;
    },
    { root: lazyRoot.value, rootMargin: "200px 0px" },
  );
  const items = lazyRoot.value.querySelectorAll("[data-seg-idx]");
  for (const item of items) lazyObserver.observe(item);
};

watch(
  () => composedState.value.segments,
  async () => {
    await nextTick();
    setupLazyObserver();
  },
);

onMounted(async () => {
  await nextTick();
  mountEditor();
  updatePanelHeight();
  setupLazyObserver();
  window.addEventListener("resize", handleWindowResize);
});

onBeforeUnmount(() => {
  editorView?.destroy();
  editorView = null;
  if (lazyObserver) lazyObserver.disconnect();
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
        <a href="https://www.npmjs.com/package/yume-dsl-rich-text" target="_blank" rel="noreferrer"
          >npm</a
        >
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
          <div class="tag-list">
            <span v-for="tag in enabledTags" :key="tag" class="tag-chip">
              {{ copy.declared }}: {{ tag }}
            </span>
          </div>
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
              <button
                type="button"
                class="mini-action"
                @click="loadDeepNestedSample"
                :title="copy.deepSampleHint"
              >
                {{ copy.deepSample }}
              </button>
              <button
                type="button"
                class="mini-action"
                @click="loadLargeSample"
                :title="copy.largeSampleHint"
              >
                {{ copy.largeSample }}
              </button>
              <button type="button" class="mini-action" @click="insertRandomText">
                {{ copy.randomInsert }}
              </button>
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
            <div ref="lazyRoot" class="preview lazy-preview">
              <div
                v-for="(seg, idx) in composedState.segments"
                :key="seg.key"
                :data-seg-idx="idx"
                class="lazy-segment"
                :style="
                  hiddenSegments.has(idx)
                    ? { minHeight: (segmentHeights.get(idx) || 0) + 'px' }
                    : undefined
                "
                v-html="hiddenSegments.has(idx) ? '' : seg.html"
              />
            </div>
          </section>
        </div>
      </article>
    </section>
  </main>
</template>
