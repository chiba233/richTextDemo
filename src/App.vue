<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { languages, useI18n } from "./composables/useI18n";
import { useRegistry } from "./composables/useRegistry";
import { useParser } from "./composables/useParser";
import { useIncremental } from "./composables/useIncremental";
import { useEditor } from "./composables/useEditor";
import { useTheme } from "./composables/useTheme";
import {
  createDeepNestedSample,
  createLargeSample,
  randomSnippets,
} from "./lib/samples";
import FormattedText from "./components/FormattedText";
import TopBar from "./components/TopBar.vue";
import TagDock from "./components/TagDock.vue";
import SourcePanel from "./components/SourcePanel.vue";
import PreviewPanel from "./components/PreviewPanel.vue";
import InspectModal from "./components/InspectModal.vue";

// Apply persisted sakura-glass theme (sets accent + aurora CSS variables).
useTheme();

const { currentLang, copy, source } = useI18n();
const enabledTags = ref(["bold", "italic", "link", "ruby", "warn", "code"]);
const caretOffset = ref(0);
const inspectOpen = ref(false);

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
  previewPanelRef.value?.setupLazyObserver();
});

onBeforeUnmount(() => {
  destroyEditor();
  previewPanelRef.value?.disconnectObserver();
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
</script>

<template>
  <div class="aurora-bg" aria-hidden="true" />

  <TopBar
    :copy="copy"
    :current-lang="currentLang"
    :languages="languages"
    @update:current-lang="currentLang = $event"
  />

  <div class="viewport">
    <main class="stage">
      <section class="intro">
        <h1>{{ copy.heroTitle }}</h1>
        <p class="intro-copy"><FormattedText :text="copy.heroCopy" /></p>
        <div class="intro-links">
          <a href="https://github.com/chiba233/yumeDSL" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://github.com/chiba233/yumeDSL/wiki" target="_blank" rel="noreferrer">Wiki</a>
          <a href="https://www.npmjs.com/package/yume-dsl-rich-text" target="_blank" rel="noreferrer">npm</a>
        </div>
      </section>

      <section class="stage-grid">
        <SourcePanel
          ref="sourcePanelRef"
          :copy="copy"
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
          :slice-state="sliceState"
          :composed-state="composedState"
          @open-inspect="inspectOpen = true"
        />
      </section>
    </main>
  </div>

  <TagDock
    :copy="copy"
    :registry-options="registryOptions"
    :enabled-tags="enabledTags"
    @update:enabled-tags="enabledTags = $event"
  />

  <InspectModal
    v-if="inspectOpen"
    :copy="copy"
    :composed-state="composedState"
    @close="inspectOpen = false"
  />
</template>
