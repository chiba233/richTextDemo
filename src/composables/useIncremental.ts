import { shallowRef, watch, type Ref, type ComputedRef } from "vue";
import {
  createIncrementalSession,
  buildPositionTracker,
  type IncrementalEdit,
  type StructuralNode,
  type TextToken,
  type TokenDiffResult,
  type TagHandler,
  type BlockTagInput,
  type SyntaxConfig,
} from "yume-dsl-rich-text";
import type { Parser } from "yume-dsl-rich-text";
import { enclosingNode, nodeAtOffset, parseSlice } from "yume-dsl-token-walker";
import type { ChangeSet } from "@codemirror/state";
import type { Segment, ComposedState, SliceResult, TranslationCopy } from "../types";

type Session = ReturnType<typeof createIncrementalSession>;

const BLOCK_NODE_TYPES: ReadonlySet<string> = new Set(["raw", "block"]);

// Content-based cache key with small sample — fallback when WeakMap misses
const KEY_SAMPLE = 16;
const KEY_THRESHOLD = KEY_SAMPLE * 2 + 16;

const makeCacheKey = (
  text: string,
  type: string,
  tag: string,
  start: number,
  end: number,
): string => {
  const len = end - start;
  if (len <= KEY_THRESHOLD) {
    return `${type}:${tag}:${text.slice(start, end)}`;
  }
  return `${type}:${tag}:${len}:${text.slice(start, start + KEY_SAMPLE)}…${text.slice(end - KEY_SAMPLE, end)}`;
};

// Cached position tracker — avoids rebuilding on unchanged source
let cachedTrackerText = "";
let cachedTracker: ReturnType<typeof buildPositionTracker> | null = null;

const getCachedTracker = (text: string) => {
  if (cachedTracker && cachedTrackerText === text) return cachedTracker;
  cachedTrackerText = text;
  cachedTracker = buildPositionTracker(text);
  return cachedTracker;
};

const buildSegments = (
  tree: readonly StructuralNode[],
  text: string,
  parser: Parser,
  contentCache: Map<string, TextToken[]>,
  identityCache: WeakMap<StructuralNode, TextToken[]>,
  offsetCache: { text: string; map: Map<string, TextToken[]> },
): { segments: Segment[]; reusedCount: number } => {
  const tracker = getCachedTracker(text);
  const segments: Segment[] = [];
  let inlineBuf: TextToken[] = [];
  let inlineSrcFrom = -1;
  let inlineSrcTo = -1;
  let reused = 0;

  // Offset cache valid only for current text
  if (offsetCache.text !== text) {
    offsetCache.text = text;
    offsetCache.map.clear();
  }
  const oMap = offsetCache.map;

  const flushInline = () => {
    if (inlineBuf.length === 0) return;
    segments.push({
      key: `i-${inlineSrcFrom}-${inlineSrcTo}`,
      tokens: inlineBuf,
      srcFrom: inlineSrcFrom,
      srcTo: inlineSrcTo,
    });
    inlineBuf = [];
    inlineSrcFrom = -1;
  };

  for (let idx = 0; idx < tree.length; idx++) {
    const node = tree[idx];
    const position = node.position;
    if (!position) continue;

    // Skip leading newline of text after block nodes
    if (
      node.type === "text" &&
      idx > 0 &&
      BLOCK_NODE_TYPES.has(tree[idx - 1].type)
    ) {
      const rawValue = (node as { type: "text"; value: string }).value;
      const trimmed = rawValue.replace(/^\r?\n/, "");
      if (trimmed === "") continue;
      const tokens = parseSlice(text, position, parser, tracker);
      if (inlineSrcFrom < 0) inlineSrcFrom = position.start.offset;
      inlineSrcTo = position.end.offset;
      inlineBuf.push(...tokens);
      continue;
    }

    const start = position.start.offset;
    const end = position.end.offset;
    const offsetKey = `${start}:${end}`;

    // Tier 1: offset cache (same text, zero text.slice cost)
    let tokens = oMap.get(offsetKey);
    if (tokens) {
      reused++;
    } else {
      // Tier 2: identity cache (node object reuse across incremental edits)
      tokens = identityCache.get(node);
      if (tokens) {
        reused++;
      } else {
        // Tier 3: content cache (cross-text reuse via sampled content key)
        const nodeTag = "tag" in node ? (node as { tag: string }).tag : "";
        const cacheKey = makeCacheKey(text, node.type, nodeTag, start, end);
        tokens = contentCache.get(cacheKey);
        if (tokens) {
          reused++;
        } else {
          tokens = parseSlice(text, position, parser, tracker);
          contentCache.set(cacheKey, tokens);
        }
        identityCache.set(node, tokens);
      }
      oMap.set(offsetKey, tokens);
    }

    if (BLOCK_NODE_TYPES.has(node.type)) {
      flushInline();
      segments.push({
        key: `b-${start}-${end}`,
        tokens,
        srcFrom: start,
        srcTo: end,
      });
    } else {
      if (inlineSrcFrom < 0) inlineSrcFrom = start;
      inlineSrcTo = end;
      inlineBuf.push(...tokens);
    }
  }
  flushInline();
  return { segments, reusedCount: reused };
};

export const useIncremental = (
  source: Ref<string>,
  enabledTags: Ref<string[]>,
  parserOptions: ComputedRef<{
    handlers: Record<string, TagHandler>;
    blockTags: BlockTagInput[];
    syntax: SyntaxConfig;
    depthLimit: number;
    implicitInlineShorthand: boolean | readonly string[];
  }>,
  parser: ComputedRef<Parser>,
  caretOffset: Ref<number>,
  copy: ComputedRef<TranslationCopy>,
) => {
  let session: Session | null = null;
  let lastKnownSource = "";
  let tokenCache = new Map<string, TextToken[]>();
  let nodeIdentityCache = new WeakMap<StructuralNode, TextToken[]>();
  let offsetTokenCache = { text: "", map: new Map<string, TextToken[]>() };

  const currentTree = shallowRef<readonly StructuralNode[]>([]);

  const composedState = shallowRef<ComposedState>({
    segments: [],
    composeMs: 0,
    reusedCount: 0,
    incrementalMs: 0,
    incrementalMode: "init",
    structuralTree: [],
    richTextTokens: [],
    incrementalDiff: null,
    printedSource: "",
  });

  const updateFromSession = (mode: string, sessionMs: number, incrementalDiff: TokenDiffResult | null = null) => {
    if (!session) return;
    const composeStarted = performance.now();
    const doc = session.getDocument();
    currentTree.value = doc.tree;
    const structuralTree = doc.tree as StructuralNode[];
    const richTextTokens = parser.value.parse(doc.source);
    const printedSource = parser.value.print(structuralTree);
    const { segments, reusedCount } = buildSegments(
      doc.tree,
      doc.source,
      parser.value,
      tokenCache,
      nodeIdentityCache,
      offsetTokenCache,
    );
    composedState.value = {
      segments,
      composeMs: performance.now() - composeStarted,
      reusedCount,
      incrementalMs: sessionMs,
      incrementalMode: mode,
      structuralTree,
      richTextTokens,
      incrementalDiff,
      printedSource,
    };
    recomputeSlice();
  };

  const makeIncOptions = () => {
    const opts = parserOptions.value;
    return {
      handlers: opts.handlers,
      blockTags: opts.blockTags,
      syntax: opts.syntax,
      depthLimit: opts.depthLimit,
      implicitInlineShorthand: opts.implicitInlineShorthand,
    };
  };

  const initSession = () => {
    const started = performance.now();
    tokenCache = new Map();
    nodeIdentityCache = new WeakMap();
    offsetTokenCache = { text: "", map: new Map() };
    session = createIncrementalSession(source.value, makeIncOptions());
    lastKnownSource = source.value;
    updateFromSession("full-init", performance.now() - started);
  };

  // Keep incremental diff/mode aligned with the exact edit that just advanced
  // the session. RAF-coalescing can overwrite an earlier non-empty diff with a
  // later no-op edit in the same frame.
  const scheduleUpdate = (mode: string, sessionMs: number, incrementalDiff: TokenDiffResult | null = null) => {
    updateFromSession(mode, sessionMs, incrementalDiff);
  };

  // Called by editor on doc change with CM ChangeSet
  const handleEditorChange = (changes: ChangeSet, newSource: string) => {
    if (!session) {
      source.value = newSource;
      initSession();
      return;
    }

    // Count changes to determine if single-edit incremental path is usable
    let editCount = 0;
    let singleFrom = 0;
    let singleTo = 0;
    let singleInserted = "";
    changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      editCount++;
      if (editCount === 1) {
        singleFrom = fromA;
        singleTo = toA;
        singleInserted = inserted.toString();
      }
    });

    source.value = newSource;
    lastKnownSource = newSource;

    const incOptions = makeIncOptions();
    const started = performance.now();

    if (editCount === 1) {
      const edit: IncrementalEdit = {
        startOffset: singleFrom,
        oldEndOffset: singleTo,
        newText: singleInserted,
      };
      const result = session.applyEditWithDiff(edit, newSource, incOptions);
      scheduleUpdate(result.mode, performance.now() - started, result.diff);
    } else {
      session.rebuild(newSource, incOptions);
      scheduleUpdate("full-rebuild (multi-change)", performance.now() - started, null);
    }
  };

  // Slice state: cursor-based local reparse for preview (deferred with compose)
  const sliceState = shallowRef<SliceResult>({
    error: "",
    tokens: [],
    sliceMs: 0,
    targetLabel: copy.value.noSlice,
    rangeLabel: "n/a",
    node: null,
  });

  const recomputeSlice = () => {
    try {
      const tree = currentTree.value as StructuralNode[];
      const text = source.value;
      const safeOffset = Math.max(0, Math.min(caretOffset.value, text.length));
      const deepNode = nodeAtOffset(tree, safeOffset);
      const tagNode = enclosingNode(tree, safeOffset);
      const targetNode = tagNode ?? deepNode;

      if (!targetNode?.position) {
        sliceState.value = {
          error: "",
          tokens: [],
          sliceMs: 0,
          targetLabel: copy.value.noSlice,
          rangeLabel: "n/a",
          node: null,
        };
        return;
      }

      const tracker = getCachedTracker(text);
      const started = performance.now();
      const tokens = parseSlice(text, targetNode.position, parser.value, tracker);
      const tagLabel = "tag" in targetNode ? (targetNode as { tag: string }).tag : "";
      sliceState.value = {
        error: "",
        tokens,
        sliceMs: performance.now() - started,
        targetLabel: `${targetNode.type}${tagLabel ? `:${tagLabel}` : ""}`,
        rangeLabel: `${targetNode.position.start.offset}-${targetNode.position.end.offset}`,
        node: targetNode,
      };
    } catch (error) {
      sliceState.value = {
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
        tokens: [],
        sliceMs: 0,
        targetLabel: "error",
        rangeLabel: "n/a",
        node: null,
      };
    }
  };

  // Watch for external source changes (language switch, sample load)
  watch(source, (newSource) => {
    if (newSource === lastKnownSource) return;
    lastKnownSource = newSource;
    if (session) {
      const started = performance.now();
      session.rebuild(newSource, makeIncOptions());
      updateFromSession("full-rebuild (external)", performance.now() - started);
    } else {
      initSession();
    }
  });

  // Watch for registry changes → fresh session
  watch(
    enabledTags,
    () => {
      initSession();
    },
    { deep: true },
  );

  // Recompute slice when caret moves (deferred)
  let sliceRafId = 0;
  watch(caretOffset, () => {
    if (!sliceRafId) {
      sliceRafId = requestAnimationFrame(() => {
        sliceRafId = 0;
        recomputeSlice();
      });
    }
  });

  // Initialize
  initSession();

  return {
    composedState,
    sliceState,
    handleEditorChange,
  };
};
