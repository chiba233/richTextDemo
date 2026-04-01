<script setup>
import { computed, ref, watch } from "vue";
import {
  buildPositionTracker,
  createParser,
  createPipeHandlers,
  createSimpleInlineHandlers,
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
      link: "pipe 参数 handler，支持 $$link(url | text)$$。",
      ruby: "pipe 参数 handler，支持 $$ruby(汉字 | 注音)$$。",
      warn: "同时声明 inline + block，两种写法都能渲染。",
      code: "raw handler，支持 $$code(lang | title)% ... %end$$。",
    },
    sampleSource: `欢迎来到 $$bold(yume-dsl-rich-text)$$ demo。

这里我们事先声明了 $$bold(bold)$$、$$italic(italic)$$、$$link(https://github.com/chiba233/yumeDSL | link)$$、$$ruby(漢字 | かんじ)$$、$$warn(warn)$$。

如果你把左侧的某个声明关掉，再回来看看这里的渲染会怎么退化。

$$warn(注意)*
这不是“自动识别全部标签”。
只有页面初始化时声明过的 handler，才会被渲染成对应效果。
*end$$

$$code(js | raw demo)%
const message = "raw tag works";
console.log(message);
%end$$`,
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
      link: "Pipe-arg handler for $$link(url | text)$$.",
      ruby: "Pipe-arg handler for $$ruby(base | ruby-text)$$.",
      warn: "Declares both inline and block forms.",
      code: "Raw handler for $$code(lang | title)% ... %end$$.",
    },
    sampleSource: `Welcome to the $$bold(yume-dsl-rich-text)$$ demo.

We predeclare $$bold(bold)$$, $$italic(italic)$$, $$link(https://github.com/chiba233/yumeDSL | link)$$, $$ruby(漢字 | kanji)$$, and $$warn(warn)$$.

Disable one of the declarations on the left and watch how the rendering degrades.

$$warn(Notice)*
This does not auto-detect every tag.
Only handlers declared up front are rendered into custom output.
*end$$

$$code(js | raw demo)%
const message = "raw tag works";
console.log(message);
%end$$`,
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
      link: "$$link(url | text)$$ 用の pipe 引数 handler。",
      ruby: "$$ruby(漢字 | ふりがな)$$ 用の pipe 引数 handler。",
      warn: "inline と block の両方を宣言。",
      code: "$$code(lang | title)% ... %end$$ 用の raw handler。",
    },
    sampleSource: `$$bold(yume-dsl-rich-text)$$ デモへようこそ。

ここでは $$bold(bold)$$、$$italic(italic)$$、$$link(https://github.com/chiba233/yumeDSL | link)$$、$$ruby(漢字 | かんじ)$$、$$warn(warn)$$ を事前に宣言しています。

左側の宣言をひとつ外して、表示がどう変化するか試してみてください。

$$warn(注意)*
これは「すべてのタグを自動認識」する仕組みではありません。
事前に宣言した handler だけが対応する表示へ変換されます。
*end$$

$$code(js | raw demo)%
const message = "raw tag works";
console.log(message);
%end$$`,
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

const registryOptions = computed(() =>
  registryBase.map((item) => ({
    ...item,
    description: copy.value.registryDescriptions[item.key],
  })),
);

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderTokens = (tokens) =>
  tokens
    .map((token) => {
      if (token.type === "text") return escapeHtml(String(token.value));
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
        return [
          `<section class="demo-warn">`,
          `<div class="demo-warn-title">${escapeHtml(String(token.title ?? "Notice"))}</div>`,
          `<div class="demo-warn-body">${renderTokens(token.value)}</div>`,
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

const renderHighlightTokens = (tokens) =>
  tokens
    .map((token) => {
      const styles = [];
      if (token.color) styles.push(`color:${token.color}`);
      if (token.fontStyle) styles.push(`font-style:${token.fontStyle}`);
      return `<span${styles.length > 0 ? ` style="${styles.join(";")}"` : ""}>${escapeHtml(token.content)}</span>`;
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
        value: args.materializedTailTokens(1),
      }),
      block: (args, content) => ({
        type: "warn",
        title: args.text(0) || "Notice",
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

const parserOptions = computed(() => ({
  handlers: activeHandlers.value,
  blockTags: activeBlockTags.value,
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

const highlightedSource = computed(() =>
  renderHighlightTokens(tokenizer.value.tokenize(source.value)),
);

const syncCaretOffset = (event) => {
  caretOffset.value = event.target.selectionStart ?? 0;
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

    const html = structuralState.value.tree
      .map((node) => {
        const position = node.position;
        if (!position) return "";

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
    </section>

    <section class="workspace">
      <article class="panel">
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

      <article class="panel">
        <header class="panel-head">
          <p class="eyebrow">{{ copy.sourceEyebrow }}</p>
          <h2>{{ copy.sourceTitle }}</h2>
        </header>
        <div class="panel-body source-body">
          <div class="source-meta">
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
            <pre class="editor-highlight" aria-hidden="true" v-html="highlightedSource" />
            <textarea
              v-model="source"
              class="editor-input"
              spellcheck="false"
              @click="syncCaretOffset"
              @input="syncCaretOffset"
              @keyup="syncCaretOffset"
            />
          </div>
        </div>
      </article>

      <article class="panel">
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
