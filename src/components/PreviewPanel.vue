<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
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
let lazyObserver: IntersectionObserver | null = null;

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
      <h2>{{ copy.previewTitle }}</h2>
    </header>
    <div class="panel-body preview-body">
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
    </div>
  </article>
</template>
