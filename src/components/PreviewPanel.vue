<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from "vue";
import type { TranslationCopy, SliceResult, ComposedState } from "../types";
import TokenRenderer from "./TokenRenderer";
import FormattedText from "./FormattedText";

const props = defineProps<{
  copy: TranslationCopy;
  panelHeight: number;
  sliceState: SliceResult;
  composedState: ComposedState;
}>();

const lazyRoot = ref<HTMLElement | null>(null);
const hiddenSegments = ref(new Set<number>());
const segmentHeights = ref(new Map<number, number>());
const previewMode = ref<"result" | "structural" | "richText">("result");
let lazyObserver: IntersectionObserver | null = null;

const MAX_SERIALIZE_NODES = 500_000;
const MAX_SERIALIZE_CHARS = 2_000_000;

const isObjectLike = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

const normalizeLeaf = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[Function]";
  if (typeof value === "symbol") return String(value);
  return value;
};

const stringifyJsonIterative = (root: unknown): string => {
  if (!isObjectLike(root)) {
    const out = JSON.stringify(root, null, 2);
    return out ?? "null";
  }

  interface ArrayFrame {
    kind: "array";
    value: unknown[];
    index: number;
    started: boolean;
  }
  interface ObjectFrame {
    kind: "object";
    value: Record<string, unknown>;
    keys: string[];
    index: number;
    started: boolean;
  }
  type Frame = ArrayFrame | ObjectFrame;

  const stack: Frame[] = [];
  const out: string[] = [];
  let outChars = 0;
  let truncated = false;
  const indent = (depth: number): string => "  ".repeat(depth);
  const append = (chunk: string): boolean => {
    const next = outChars + chunk.length;
    if (next > MAX_SERIALIZE_CHARS) {
      truncated = true;
      return false;
    }
    out.push(chunk);
    outChars = next;
    return true;
  };
  const pushValue = (value: unknown) => {
    if (!isObjectLike(value)) {
      const primitive = JSON.stringify(value);
      append(primitive ?? "null");
      return;
    }
    if (Array.isArray(value)) {
      stack.push({ kind: "array", value, index: 0, started: false });
    } else {
      const record = value as Record<string, unknown>;
      stack.push({
        kind: "object",
        value: record,
        keys: Object.keys(record),
        index: 0,
        started: false,
      });
    }
  };

  pushValue(root);

  while (stack.length > 0) {
    if (truncated) break;
    const frame = stack[stack.length - 1];
    if (!frame) break;
    const depth = stack.length - 1;

    if (frame.kind === "array") {
      if (!frame.started) {
        if (!append("[")) break;
        frame.started = true;
        if (frame.value.length > 0 && !append("\n")) break;
      }
      if (frame.index >= frame.value.length) {
        if (frame.value.length > 0) {
          if (!append("\n")) break;
          if (!append(indent(depth))) break;
        }
        if (!append("]")) break;
        stack.pop();
        continue;
      }
      if (frame.index > 0 && !append(",\n")) break;
      if (!append(indent(depth + 1))) break;
      const value = frame.value[frame.index];
      frame.index++;
      pushValue(value);
      continue;
    }

    if (!frame.started) {
      if (!append("{")) break;
      frame.started = true;
      if (frame.keys.length > 0 && !append("\n")) break;
    }
    if (frame.index >= frame.keys.length) {
      if (frame.keys.length > 0) {
        if (!append("\n")) break;
        if (!append(indent(depth))) break;
      }
      if (!append("}")) break;
      stack.pop();
      continue;
    }
    if (frame.index > 0 && !append(",\n")) break;
    if (!append(indent(depth + 1))) break;
    const key = frame.keys[frame.index];
    frame.index++;
    if (!append(JSON.stringify(key))) break;
    if (!append(": ")) break;
    pushValue(frame.value[key]);
  }

  const serialized = out.join("");
  return truncated
    ? `${serialized}\n... [Output truncated: exceeded ${MAX_SERIALIZE_CHARS.toLocaleString()} chars]`
    : serialized;
};

const safeStringify = (value: unknown): string => {
  try {
    const rootRaw = isObjectLike(value) ? toRaw(value) : value;
    if (!isObjectLike(rootRaw)) {
      const out = JSON.stringify(normalizeLeaf(rootRaw), null, 2);
      return out ?? "null";
    }

    const rootSnapshot: unknown[] | Record<string, unknown> = Array.isArray(rootRaw) ? [] : {};
    const visited = new WeakMap<object, unknown>();
    visited.set(rootRaw, rootSnapshot);

    let nodeCount = 1;
    const stack: Array<{
      source: object;
      target: unknown[] | Record<string, unknown>;
    }> = [{ source: rootRaw, target: rootSnapshot }];

    while (stack.length > 0) {
      const frame = stack.pop();
      if (!frame) continue;

      if (Array.isArray(frame.source) && Array.isArray(frame.target)) {
        for (let i = 0; i < frame.source.length; i++) {
          const rawChild = isObjectLike(frame.source[i]) ? toRaw(frame.source[i]) : frame.source[i];
          if (!isObjectLike(rawChild)) {
            frame.target[i] = normalizeLeaf(rawChild);
            continue;
          }
          if (visited.has(rawChild)) {
            frame.target[i] = "[Circular]";
            continue;
          }
          if (nodeCount >= MAX_SERIALIZE_NODES) {
            frame.target[i] = "[Truncated]";
            continue;
          }
          if (rawChild instanceof Date) {
            frame.target[i] = rawChild.toISOString();
            continue;
          }
          if (rawChild instanceof RegExp) {
            frame.target[i] = rawChild.toString();
            continue;
          }
          if (rawChild instanceof Map) {
            frame.target[i] = `[Map(${rawChild.size})]`;
            continue;
          }
          if (rawChild instanceof Set) {
            frame.target[i] = `[Set(${rawChild.size})]`;
            continue;
          }

          const childSnapshot: unknown[] | Record<string, unknown> = Array.isArray(rawChild) ? [] : {};
          visited.set(rawChild, childSnapshot);
          nodeCount++;
          frame.target[i] = childSnapshot;
          stack.push({ source: rawChild, target: childSnapshot });
        }
        continue;
      }

      const sourceRecord = frame.source as Record<string, unknown>;
      const targetRecord = frame.target as Record<string, unknown>;
      for (const key of Object.keys(sourceRecord)) {
        let propValue: unknown;
        try {
          propValue = sourceRecord[key];
        } catch (error) {
          targetRecord[key] = `<error: ${String(error)}>`;
          continue;
        }

        const rawChild = isObjectLike(propValue) ? toRaw(propValue) : propValue;
        if (!isObjectLike(rawChild)) {
          targetRecord[key] = normalizeLeaf(rawChild);
          continue;
        }
        if (visited.has(rawChild)) {
          targetRecord[key] = "[Circular]";
          continue;
        }
        if (nodeCount >= MAX_SERIALIZE_NODES) {
          targetRecord[key] = "[Truncated]";
          continue;
        }
        if (rawChild instanceof Date) {
          targetRecord[key] = rawChild.toISOString();
          continue;
        }
        if (rawChild instanceof RegExp) {
          targetRecord[key] = rawChild.toString();
          continue;
        }
        if (rawChild instanceof Map) {
          targetRecord[key] = `[Map(${rawChild.size})]`;
          continue;
        }
        if (rawChild instanceof Set) {
          targetRecord[key] = `[Set(${rawChild.size})]`;
          continue;
        }

        const childSnapshot: unknown[] | Record<string, unknown> = Array.isArray(rawChild) ? [] : {};
        visited.set(rawChild, childSnapshot);
        nodeCount++;
        targetRecord[key] = childSnapshot;
        stack.push({ source: rawChild, target: childSnapshot });
      }
    }

    return stringifyJsonIterative(rootSnapshot);
  } catch (error) {
    return `"<serialize error: ${String(error)}>"`;
  }
};

const structuralJson = computed(() =>
  safeStringify(props.composedState.structuralTree),
);
const richTextJson = computed(() =>
  safeStringify(props.composedState.richTextTokens),
);

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
        const el = entry.target as HTMLElement;
        const idx = Number(el.dataset.segIdx);
        if (entry.isIntersecting) {
          next.delete(idx);
        } else {
          heights.set(idx, el.getBoundingClientRect().height);
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
  () => props.composedState.segments,
  async () => {
    await nextTick();
    setupLazyObserver();
  },
);

defineExpose({
  setupLazyObserver,
  disconnectObserver: () => {
    if (lazyObserver) lazyObserver.disconnect();
  },
});
</script>

<template>
  <article
    class="panel preview-panel"
    :style="{ height: `${panelHeight}px`, maxHeight: `${panelHeight}px` }"
  >
    <header class="panel-head">
      <p class="eyebrow">{{ copy.previewEyebrow }}</p>
      <div class="preview-mode-tabs">
        <button
          type="button"
          class="preview-mode-tab"
          :class="{ 'preview-mode-tab-active': previewMode === 'result' }"
          @click="previewMode = 'result'"
        >
          {{ copy.previewViewResult }}
        </button>
        <button
          type="button"
          class="preview-mode-tab"
          :class="{ 'preview-mode-tab-active': previewMode === 'structural' }"
          @click="previewMode = 'structural'"
        >
          {{ copy.previewViewStructural }}
        </button>
        <button
          type="button"
          class="preview-mode-tab"
          :class="{ 'preview-mode-tab-active': previewMode === 'richText' }"
          @click="previewMode = 'richText'"
        >
          {{ copy.previewViewRichText }}
        </button>
      </div>
    </header>
    <div class="panel-body preview-body">
      <template v-if="previewMode === 'result'">
        <div class="compare-grid">
          <div class="compare-card">
            <div class="compare-label">{{ copy.parseSliceLabel }}</div>
            <div class="compare-value">{{ sliceState.sliceMs.toFixed(3) }} ms</div>
          </div>
          <div class="compare-card">
            <div class="compare-label">{{ copy.incrementalLabel }}</div>
            <div class="compare-value">{{ composedState.incrementalMs.toFixed(3) }} ms</div>
          </div>
          <div class="compare-card">
            <div class="compare-label">{{ copy.composeLabel }}</div>
            <div class="compare-value">{{ composedState.composeMs.toFixed(3) }} ms</div>
          </div>
          <div class="compare-card">
            <div class="compare-label">{{ copy.incrementalModeLabel }}</div>
            <div class="compare-value compare-value-small">{{ composedState.incrementalMode }}</div>
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
            <p><FormattedText :text="copy.sliceCopy" /></p>
          </div>
          <div v-if="sliceState.tokens.length" class="preview slice-preview">
            <TokenRenderer :tokens="sliceState.tokens" />
          </div>
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
            >
              <TokenRenderer v-if="!hiddenSegments.has(idx)" :tokens="seg.tokens" />
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="previewMode === 'structural'">
        <div class="structural-split">
          <section class="preview-section preview-section-large structural-pane">
            <div class="slice-preview-head">
              <h3>{{ copy.structuralTreeTitle }}</h3>
            </div>
            <pre class="debug-box">{{ structuralJson }}</pre>
          </section>

          <section class="preview-section preview-section-large structural-pane">
            <div class="slice-preview-head">
              <h3>{{ copy.printedSourceTitle }}</h3>
            </div>
            <pre class="debug-box debug-print">{{ composedState.printedSource }}</pre>
          </section>
        </div>
      </template>

      <template v-else>
        <section class="slice-preview-block preview-section preview-section-large">
          <div class="slice-preview-head">
            <h3>{{ copy.richTextTreeTitle }}</h3>
          </div>
          <pre class="debug-box">{{ richTextJson }}</pre>
        </section>
      </template>
    </div>
  </article>
</template>
