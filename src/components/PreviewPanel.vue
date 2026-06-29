<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { TranslationCopy, SliceResult, ComposedState } from "../types";
import TokenRenderer from "./TokenRenderer";
import FormattedText from "./FormattedText";
import { useGlow } from "../composables/useGlow";

const props = defineProps<{
  copy: TranslationCopy;
  sliceState: SliceResult;
  composedState: ComposedState;
}>();

const emit = defineEmits<{
  openInspect: [];
}>();

const glow = useGlow();

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

onBeforeUnmount(() => {
  if (lazyObserver) {
    lazyObserver.disconnect();
    lazyObserver = null;
  }
});

defineExpose({
  setupLazyObserver,
  disconnectObserver: () => {
    if (lazyObserver) lazyObserver.disconnect();
  },
});
</script>

<template>
  <article class="panel glass preview-panel" v-on="glow">
    <header class="panel-head">
      <div class="panel-head-main">
        <p class="eyebrow">{{ copy.previewEyebrow }}</p>
        <h2>{{ copy.previewTitle }}</h2>
      </div>
      <button type="button" class="inspect-button" @click="emit('openInspect')">
        {{ copy.inspect }}
      </button>
    </header>

    <div class="panel-body preview-body">
      <div class="metric-row">
        <div class="metric-chip">
          <span class="metric-chip-label">{{ copy.parseSliceLabel }}</span>
          <span class="metric-chip-value">{{ sliceState.sliceMs.toFixed(3) }} ms</span>
        </div>
        <div class="metric-chip">
          <span class="metric-chip-label">{{ copy.incrementalLabel }}</span>
          <span class="metric-chip-value">{{ composedState.incrementalMs.toFixed(3) }} ms</span>
        </div>
        <div class="metric-chip">
          <span class="metric-chip-label">{{ copy.composeLabel }}</span>
          <span class="metric-chip-value">{{ composedState.composeMs.toFixed(3) }} ms</span>
        </div>
        <div class="metric-chip">
          <span class="metric-chip-label">{{ copy.incrementalModeLabel }}</span>
          <span class="metric-chip-value-text">{{ composedState.incrementalMode }}</span>
        </div>
        <div class="metric-chip">
          <span class="metric-chip-label">{{ copy.reusedLabel }}</span>
          <span class="metric-chip-value">{{ composedState.reusedCount }}</span>
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
            :class="{ 'lazy-segment-incremental': seg.isIncrementalRange }"
            :style="
              hiddenSegments.has(idx)
                ? { minHeight: (segmentHeights.get(idx) || 0) + 'px' }
                : undefined
            "
          >
            <span v-if="seg.isIncrementalRange" class="lazy-segment-badge">incremental</span>
            <TokenRenderer v-if="!hiddenSegments.has(idx)" :tokens="seg.tokens" />
          </div>
        </div>
      </section>
    </div>
  </article>
</template>
