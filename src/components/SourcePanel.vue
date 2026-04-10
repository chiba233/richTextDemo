<script setup lang="ts">
import { ref } from "vue";
import type { TranslationCopy, CompletionTemplate } from "../types";

defineProps<{
  copy: TranslationCopy;
  panelHeight: number;
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

defineExpose({ editorRoot, completionPanel });
</script>

<template>
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
