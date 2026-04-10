import { computed, shallowRef, watch, type Ref, type ComputedRef } from "vue";
import {
  createIncrementalSession,
  buildPositionTracker,
  type IncrementalEdit,
  type StructuralNode,
  type TextToken,
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

const buildSegments = (
  tree: readonly StructuralNode[],
  text: string,
  parser: Parser,
  cache: Map<string, TextToken[]>,
): { segments: Segment[]; reusedCount: number } => {
  const tracker = buildPositionTracker(text);
  const segments: Segment[] = [];
  let inlineBuf: TextToken[] = [];
  let inlineSrcFrom = -1;
  let inlineSrcTo = -1;
  let reused = 0;

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
      inlineBuf = [...inlineBuf, ...tokens];
      continue;
    }

    const sourceSlice = text.slice(position.start.offset, position.end.offset);
    const nodeTag = "tag" in node ? (node as { tag: string }).tag : "";
    const cacheKey = `${node.type}:${nodeTag}:${sourceSlice}`;

    let tokens = cache.get(cacheKey);
    if (tokens) {
      reused++;
    } else {
      tokens = parseSlice(text, position, parser, tracker);
      cache.set(cacheKey, tokens);
    }

    if (BLOCK_NODE_TYPES.has(node.type)) {
      flushInline();
      segments.push({
        key: `b-${position.start.offset}-${position.end.offset}`,
        tokens,
        srcFrom: position.start.offset,
        srcTo: position.end.offset,
      });
    } else {
      if (inlineSrcFrom < 0) inlineSrcFrom = position.start.offset;
      inlineSrcTo = position.end.offset;
      inlineBuf = [...inlineBuf, ...tokens];
    }
  }
  flushInline();
  return { segments, reusedCount: reused };
};

export const useIncremental = (
  source: Ref<string>,
  enabledTags: Ref<string[]>,
  parserOptions: ComputedRef<{ handlers: Record<string, TagHandler>; blockTags: BlockTagInput[]; syntax: SyntaxConfig; depthLimit: number }>,
  parser: ComputedRef<Parser>,
  caretOffset: Ref<number>,
  copy: ComputedRef<TranslationCopy>,
) => {
  let session: Session | null = null;
  let lastKnownSource = "";
  let tokenCache = new Map<string, TextToken[]>();

  const currentTree = shallowRef<readonly StructuralNode[]>([]);

  const composedState = shallowRef<ComposedState>({
    segments: [],
    composeMs: 0,
    reusedCount: 0,
    incrementalMs: 0,
    incrementalMode: "init",
  });

  const updateFromSession = (mode: string, sessionMs: number) => {
    if (!session) return;
    const composeStarted = performance.now();
    const doc = session.getDocument();
    currentTree.value = doc.tree;
    const { segments, reusedCount } = buildSegments(
      doc.tree,
      doc.source,
      parser.value,      tokenCache,
    );
    composedState.value = {
      segments,
      composeMs: performance.now() - composeStarted,
      reusedCount,
      incrementalMs: sessionMs,
      incrementalMode: mode,
    };
  };

  const makeIncOptions = () => {
    const opts = parserOptions.value;
    return {
      handlers: opts.handlers,
      blockTags: opts.blockTags,
      syntax: opts.syntax,
      depthLimit: opts.depthLimit,
    };
  };

  const initSession = () => {
    const started = performance.now();
    tokenCache = new Map();
    session = createIncrementalSession(source.value, makeIncOptions());
    lastKnownSource = source.value;
    updateFromSession("full-init", performance.now() - started);
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
      const result = session.applyEdit(edit, newSource, incOptions);
      updateFromSession(result.mode, performance.now() - started);
    } else {
      session.rebuild(newSource, incOptions);
      updateFromSession("full-rebuild (multi-change)", performance.now() - started);
    }
  };

  // Slice state: cursor-based local reparse for preview
  const sliceState = computed<SliceResult>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _tree = currentTree.value; // reactive dependency
    try {
      const tree = currentTree.value as StructuralNode[];
      const text = source.value;
      const safeOffset = Math.max(0, Math.min(caretOffset.value, text.length));
      const deepNode = nodeAtOffset(tree, safeOffset);
      const tagNode = enclosingNode(tree, safeOffset);
      const targetNode = tagNode ?? deepNode;

      if (!targetNode?.position) {
        return {
          error: "",
          tokens: [],
          sliceMs: 0,
          targetLabel: copy.value.noSlice,
          rangeLabel: "n/a",
          node: null,
        };
      }

      const tracker = buildPositionTracker(text);
      const started = performance.now();
      const tokens = parseSlice(text, targetNode.position, parser.value, tracker);
      const tagLabel = "tag" in targetNode ? (targetNode as { tag: string }).tag : "";
      return {
        error: "",
        tokens,
        sliceMs: performance.now() - started,
        targetLabel: `${targetNode.type}${tagLabel ? `:${tagLabel}` : ""}`,
        rangeLabel: `${targetNode.position.start.offset}-${targetNode.position.end.offset}`,
        node: targetNode,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
        tokens: [],
        sliceMs: 0,
        targetLabel: "error",
        rangeLabel: "n/a",
        node: null,
      };
    }
  });

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

  // Initialize
  initSession();

  return {
    composedState,
    sliceState,
    handleEditorChange,
  };
};
