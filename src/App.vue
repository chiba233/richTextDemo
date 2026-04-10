<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { languages, useI18n } from "./composables/useI18n";
import { useRegistry } from "./composables/useRegistry";
import { useParser } from "./composables/useParser";
import { useIncremental } from "./composables/useIncremental";
import { useEditor } from "./composables/useEditor";
import {
  createDeepNestedSample,
  createLargeSample,
  randomSnippets,
} from "./lib/samples";
import HeroSection from "./components/HeroSection.vue";
import RegistryPanel from "./components/RegistryPanel.vue";
import SourcePanel from "./components/SourcePanel.vue";
import PreviewPanel from "./components/PreviewPanel.vue";

const { currentLang, copy, source } = useI18n();
const enabledTags = ref(["bold", "italic", "link", "ruby", "warn", "code"]);
const caretOffset = ref(0);

const { registryOptions, activeHandlers, activeBlockTags, completionTemplates } =
  useRegistry(copy, enabledTags);

const { parserOptions, parser, tokenizer } = useParser(
  activeHandlers,
  activeBlockTags,
);

const { composedState, sliceState, handleEditorChange } = useIncremental(
  source,
  enabledTags,
  parserOptions,
  parser,
  caretOffset,
  copy,
);

const {
  editorRoot,
  completionPanel,
  panelHeight,
  selectedCompletionIndex,
  completionPanelStyle,
  showCompletionPanel,
  getCurrentDslCompletion,
  applyCompletionTemplate,
  mountEditor,
  destroyEditor,
  syncSourceToEditor,
  remountPreservingSelection,
  insertSnippetAtRandom,
  updatePanelHeight,
} = useEditor(
  source,
  caretOffset,
  tokenizer,
  enabledTags,
  completionTemplates,
  handleEditorChange,
);

const sourcePanelRef = ref<InstanceType<typeof SourcePanel> | null>(null);
const previewPanelRef = ref<InstanceType<typeof PreviewPanel> | null>(null);

// Wire SourcePanel's DOM refs into useEditor after mount
const bindEditorRefs = () => {
  if (sourcePanelRef.value) {
    editorRoot.value = sourcePanelRef.value.editorRoot;
    completionPanel.value = sourcePanelRef.value.completionPanel;
  }
};

// Sample loaders
const loadDeepNestedSample = () => {
  source.value = createDeepNestedSample(currentLang.value);
  caretOffset.value = source.value.length;
};

const loadLargeSample = () => {
  source.value = createLargeSample();
  caretOffset.value = 0;
};

const insertRandomText = () => {
  const snippet =
    randomSnippets[Math.floor(Math.random() * randomSnippets.length)];
  insertSnippetAtRandom(snippet);
};

// Lifecycle
onMounted(async () => {
  await nextTick();
  bindEditorRefs();
  mountEditor();
  updatePanelHeight();
  previewPanelRef.value?.setupLazyObserver();
  window.addEventListener("resize", updatePanelHeight);
});

onBeforeUnmount(() => {
  destroyEditor();
  previewPanelRef.value?.disconnectObserver();
  window.removeEventListener("resize", updatePanelHeight);
});

// Watch language → update source sample
watch(currentLang, () => {
  caretOffset.value = 0;
});

// Sync external source changes to editor
watch(source, (nextSource) => {
  syncSourceToEditor(nextSource);
});

// Registry changes → remount editor with new extensions
watch(
  enabledTags,
  async () => {
    await nextTick();
    bindEditorRefs();
    remountPreservingSelection();
  },
  { deep: true },
);

// Recalc panel height on layout-affecting changes
watch([currentLang, source, enabledTags], async () => {
  await nextTick();
  updatePanelHeight();
});
</script>

<template>
  <main class="page-shell">
    <HeroSection
      :copy="copy"
      :current-lang="currentLang"
      :languages="languages"
      @update:current-lang="currentLang = $event"
    />

    <section class="workspace">
      <RegistryPanel
        :copy="copy"
        :registry-options="registryOptions"
        :enabled-tags="enabledTags"
        @update:enabled-tags="enabledTags = $event"
      />

      <SourcePanel
        ref="sourcePanelRef"
        :copy="copy"
        :panel-height="panelHeight"
        :caret-offset="caretOffset"
        :slice-target-label="sliceState.targetLabel"
        :slice-range-label="sliceState.rangeLabel"
        :show-completion-panel="showCompletionPanel"
        :completion-panel-style="completionPanelStyle"
        :current-dsl-completion="getCurrentDslCompletion()"
        :selected-completion-index="selectedCompletionIndex"
        @load-deep="loadDeepNestedSample"
        @load-large="loadLargeSample"
        @insert-random="insertRandomText"
        @apply-completion="applyCompletionTemplate($event)"
      />

      <PreviewPanel
        ref="previewPanelRef"
        :copy="copy"
        :panel-height="panelHeight"
        :slice-state="sliceState"
        :composed-state="composedState"
      />
    </section>
  </main>
</template>
