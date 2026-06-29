<script setup lang="ts">
import { ref } from "vue";
import type { TranslationCopy, CompletionTemplate } from "../types";
import { useGlow } from "../composables/useGlow";

defineProps<{
  copy: TranslationCopy;
  caretOffset: number;
  sliceTargetLabel: string;
  sliceRangeLabel: string;
  showCompletionPanel: boolean;
  completionPanelStyle: Record<string, string>;
  currentDslCompletion: {
    from: number;
    to: number;
    typed: string;
    options: (CompletionTemplate & { tag: string })[];
  } | null;
  selectedCompletionIndex: number;
}>();

const emit = defineEmits<{
  loadDeep: [];
  loadLarge: [];
  insertRandom: [];
  applyCompletion: [entry: CompletionTemplate];
}>();

const editorRoot = ref<HTMLElement | null>(null);
const completionPanel = ref<HTMLElement | null>(null);

const glow = useGlow();

defineExpose({ editorRoot, completionPanel });
</script>

<template>
  <article class="panel glass source-panel" v-on="glow">
    <header class="panel-head">
      <div class="panel-head-main">
        <p class="eyebrow">{{ copy.sourceEyebrow }}</p>
        <h2>{{ copy.sourceTitle }}</h2>
      </div>
      <div class="source-tools">
        <button
          type="button"
          class="mini-action"
          :title="copy.deepSampleHint"
          @click="emit('loadDeep')"
        >
          {{ copy.deepSample }}
        </button>
        <button
          type="button"
          class="mini-action"
          :title="copy.largeSampleHint"
          @click="emit('loadLarge')"
        >
          {{ copy.largeSample }}
        </button>
        <button type="button" class="mini-action" @click="emit('insertRandom')">
          {{ copy.randomInsert }}
        </button>
      </div>
    </header>
    <div class="panel-body source-body">
      <div class="source-meta">
        <div class="slice-meta">
          <span class="meta-chip">{{ copy.caret }}: {{ caretOffset }}</span>
          <span class="meta-chip">{{ copy.hit }}: {{ sliceTargetLabel }}</span>
          <span class="meta-chip">{{ copy.range }}: {{ sliceRangeLabel }}</span>
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
            @mousedown.prevent="emit('applyCompletion', option)"
          >
            <span class="editor-completion-label">{{ option.label }}</span>
            <span class="editor-completion-detail">{{ option.detail }}</span>
          </button>
        </div>
        <div ref="editorRoot" class="editor-root" />
      </div>
    </div>
  </article>
</template>
