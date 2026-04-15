import { computed, ref, watch } from "vue";
import type { TranslationCopy, LanguageOption } from "../types";

export const languages: readonly LanguageOption[] = [
  { key: "zh", label: "中文" },
  { key: "en", label: "EN" },
  { key: "ja", label: "日本語" },
];

const translations: Record<string, TranslationCopy> = {
  zh: {
    heroKicker: "Vue 3 + yume-dsl-rich-text",
    heroTitle: "左边输入 DSL，右边看渲染结果",
    heroCopy: `这个 demo 基于 \`createParser\` + 事先声明好的 handlers 构建。右侧上方展示 \`parseStructural + nodeAtOffset/enclosingNode + parseSlice\` 的局部重解析——仅凭主 API 就能实现部分增量解析效果。下方则进一步使用实验性增量解析 API \`createIncrementalSession\`，每次编辑只增量更新受影响的区域，拼出最终效果图。此 demo 为纯 AI 生成产物，仅用作展示。`,
    registryEyebrow: "Registry",
    registryTitle: "用户自己声明 handler",
    sourceEyebrow: "Source",
    sourceTitle: "用户输入",
    previewEyebrow: "Preview",
    previewTitle: "结果",
    previewViewResult: "结果",
    previewViewStructural: "Structural 结构",
    previewViewRichText: "parseRichText 结构",
    previewViewDiff: "Diff",
    structuralTreeTitle: "Structural 树",
    richTextTreeTitle: "parseRichText 树",
    diffTitle: "增量 Diff",
    diffEmpty: "当前这次更新没有可展示的 diff。切回结果页编辑一下，或触发一次单编辑增量更新。",
    printedSourceTitle: "print 输出",
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
    incrementalLabel: "增量解析",
    incrementalModeLabel: "增量模式",
    reusedLabel: "复用片段",
    sliceTitle: "局部重解析（parseSlice）",
    sliceCopy:
      "用光标 offset 命中节点，再通过 `parseSlice(...)` 只解析这段源码。",
    sliceEmpty: "当前光标没有命中可切片的带位置节点，暂时只显示最终效果图。",
    composedTitle: "最终效果图（增量解析驱动）",
    composedCopy:
      "这里使用了实验性增量解析 API（createIncrementalSession），每次编辑只增量更新受影响的区域。",
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

在 inline 参数内部还可以使用简写形式——省掉前后缀，直接写 bold<内容> 即可。
简写会被完整 DSL 抢占：=bold<完整标签 italic<简写嵌套> 跟 ruby<漢字 | かんじ> 可以混用>=。

参数里的转义只对语法符号生效，比如 =italic<字面 ~<尖括号~> ~| 分隔符>=。

嵌套 inline 也可以工作，比如 =bold<外层里还有 =italic<italic>= 和 =ruby<漢字 | かんじ>=>=。

=warn<注意 | beta | ui>*
这不是"自动识别全部标签"。
只有页面初始化时声明过的 handler，才会被渲染成对应效果。
*
=warn<可嵌套标题 | beta | ui>*
块级内容里也可以继续放 =bold<inline>=、=italic<嵌套>= 和 =link<https://github.com/chiba233/yumeDSL | link>=。
*
=code<js | raw demo>%
const message = "raw tag works";
console.log(message);
%`,
  },
  en: {
    heroKicker: "Vue 3 + yume-dsl-rich-text",
    heroTitle: "Type DSL on the left, see the result on the right",
    heroCopy:
      "This demo is built on `createParser` plus predeclared handlers. The upper-right panel shows local reparsing via `parseStructural + nodeAtOffset/enclosingNode + parseSlice` — the main API alone can achieve partial incremental parsing. The lower-right panel goes further with the experimental incremental API `createIncrementalSession`, which only updates affected regions on each edit to produce the final composed preview. This demo is fully AI-generated and is for demonstration purposes only.",
    registryEyebrow: "Registry",
    registryTitle: "User-declared handlers",
    sourceEyebrow: "Source",
    sourceTitle: "Input",
    previewEyebrow: "Preview",
    previewTitle: "Result",
    previewViewResult: "Result",
    previewViewStructural: "Structural",
    previewViewRichText: "parseRichText",
    previewViewDiff: "Diff",
    structuralTreeTitle: "Structural tree",
    richTextTreeTitle: "parseRichText tree",
    diffTitle: "Incremental diff",
    diffEmpty:
      "No diff payload is available for the current update. Make a normal single-edit incremental update to see the new API output here.",
    printedSourceTitle: "print output",
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
    incrementalLabel: "Incremental",
    incrementalModeLabel: "Inc. mode",
    reusedLabel: "Reused segments",
    sliceTitle: "Local reparse (parseSlice)",
    sliceCopy:
      "Locate the current node by caret offset, then reparse only that source span with `parseSlice(...)`.",
    sliceEmpty:
      "The current caret position does not hit a sliceable node with positions, so only the composed preview is shown.",
    composedTitle: "Final composed preview (incremental)",
    composedCopy:
      "Powered by the experimental incremental API (createIncrementalSession) — each edit incrementally updates only the affected regions.",
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

Inside inline args you can also use shorthand — skip the prefix/suffix and just write bold<content>.
Shorthand yields to full DSL: =bold<full tag with italic<shorthand nested> and ruby<漢字 | kanji> mixed>=.

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
      "このデモは `createParser` と事前宣言した handlers をベースにしています。右上には `parseStructural + nodeAtOffset/enclosingNode + parseSlice` による部分再解析を表示——メイン API だけでも部分的な増量解析効果が得られます。右下ではさらに実験的な増量解析 API `createIncrementalSession` を使用し、各編集は影響を受ける領域のみを更新して最終プレビューを合成します。このデモは純粋に AI が生成したもので、展示用途のみです。",
    registryEyebrow: "Registry",
    registryTitle: "ユーザーが宣言する handler",
    sourceEyebrow: "Source",
    sourceTitle: "入力",
    previewEyebrow: "Preview",
    previewTitle: "結果",
    previewViewResult: "結果",
    previewViewStructural: "Structural 構造",
    previewViewRichText: "parseRichText 構造",
    previewViewDiff: "Diff",
    structuralTreeTitle: "Structural ツリー",
    richTextTreeTitle: "parseRichText ツリー",
    diffTitle: "増量 Diff",
    diffEmpty:
      "現在の更新には表示できる diff がありません。結果タブに戻って編集するか、単一編集の増量更新を発生させてください。",
    printedSourceTitle: "print 出力",
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
    incrementalLabel: "増量解析",
    incrementalModeLabel: "増量モード",
    reusedLabel: "再利用片段",
    sliceTitle: "部分再解析（parseSlice）",
    sliceCopy:
      "カーソル offset でノードを特定し、その範囲だけ `parseSlice(...)` で再解析します。",
    sliceEmpty:
      "現在のカーソル位置では位置情報付きの slice 対象ノードに当たっていないため、合成結果のみ表示します。",
    composedTitle: "最終プレビュー（増量解析駆動）",
    composedCopy:
      "実験的な増量解析 API（createIncrementalSession）を使用し、各編集は影響を受ける領域だけを増量更新します。",
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

inline 引数の中では省略形も使えます——前後の記号を省いて bold<内容> と書くだけで OK。
省略形はフル DSL に譲ります：=bold<フルタグに italic<省略ネスト> と ruby<漢字 | かんじ> を混在>=。

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

export const useI18n = () => {
  const currentLang = ref("zh");
  const copy = computed(() => translations[currentLang.value]);
  const source = ref(translations.zh.sampleSource);

  watch(currentLang, (lang) => {
    source.value = translations[lang].sampleSource;
  });

  return { currentLang, copy, source };
};
