import { ref, type Ref, type ComputedRef } from "vue";
import {
  autocompletion,
  closeCompletion,
  snippetCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import { EditorState, Prec, RangeSetBuilder, type ChangeSet } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { basicSetup } from "codemirror";
import type { CompletionTemplate } from "../types";

interface TokenizerLike {
  tokenize: (text: string) => Array<{ content: string; color?: string }>;
}

interface HighlightState {
  decorations: DecorationSet;
  update: (update: ViewUpdate) => void;
}

const buildDecorations = (
  view: EditorView,
  tokenize: (text: string) => Array<{ content: string; color?: string }>,
): DecorationSet => {
  const { from: vpFrom, to: vpTo } = view.viewport;
  const lineFrom = view.state.doc.lineAt(vpFrom).from;
  const lineTo = view.state.doc.lineAt(vpTo).to;
  const slice = view.state.sliceDoc(lineFrom, lineTo);
  const tokens = tokenize(slice);
  const builder = new RangeSetBuilder<Decoration>();
  let offset = lineFrom;

  for (const token of tokens) {
    const length = token.content.length;
    const end = offset + length;
    if (end > lineTo) break;
    if (length > 0 && token.color) {
      builder.add(
        offset,
        end,
        Decoration.mark({ attributes: { style: `color: ${token.color}` } }),
      );
    }
    offset = end;
  }

  return builder.finish();
};

const buildHighlightPlugin = (
  tokenize: (text: string) => Array<{ content: string; color?: string }>,
) =>
  ViewPlugin.define<HighlightState>(
    (view) => {
      const state: HighlightState = {
        decorations: buildDecorations(view, tokenize),
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) {
            state.decorations = buildDecorations(update.view, tokenize);
          }
        },
      };
      return state;
    },
    { decorations: (v) => v.decorations },
  );

export const useEditor = (
  source: Ref<string>,
  caretOffset: Ref<number>,
  tokenizer: ComputedRef<TokenizerLike>,
  enabledTags: Ref<string[]>,
  completionTemplates: Record<string, CompletionTemplate[]>,
  onDocChange: (changes: ChangeSet, newSource: string) => void,
) => {
  const editorRoot = ref<HTMLElement | null>(null);
  const completionPanel = ref<HTMLElement | null>(null);
  const panelHeight = ref(860);
  const selectedCompletionIndex = ref(0);
  const completionPanelStyle = ref<Record<string, string>>({});
  const showCompletionPanel = ref(false);
  let completionDismissedAt = -1;
  let editorView: EditorView | null = null;

  // Completion: plain entries for custom panel
  const getPlainCompletionEntries = () =>
    enabledTags.value.flatMap((tag) =>
      (completionTemplates[tag] ?? []).map((entry) => ({
        ...entry,
        tag,
      })),
    );

  // Completion: snippet entries for CM autocompletion
  const getCompletionOptions = () =>
    enabledTags.value.flatMap((tag) =>
      (completionTemplates[tag] ?? []).map((entry) =>
        snippetCompletion(entry.template, {
          label: entry.label,
          detail: entry.detail,
          info: entry.info,
        }),
      ),
    );

  // Custom DSL completion detection
  const getCurrentDslCompletion = () => {
    const head = caretOffset.value;
    const before = source.value.slice(Math.max(0, head - 64), head);
    const match = before.match(/(?<![>~])=([A-Za-z-]*)$/);
    if (!match) return null;

    const typed = match[1] ?? "";
    const options = getPlainCompletionEntries().filter((entry) =>
      entry.label.startsWith(typed),
    );
    if (options.length === 0) return null;

    return { from: head - match[0].length, to: head, typed, options };
  };

  const applyCompletionTemplate = (entry: CompletionTemplate) => {
    const completion = getCurrentDslCompletion();
    if (!editorView || !completion) return;
    editorView.dispatch({
      changes: { from: completion.from, to: completion.to, insert: entry.insertText },
      selection: { anchor: completion.from + entry.cursorOffset },
    });
    showCompletionPanel.value = false;
    editorView.focus();
  };

  const syncCompletionScroll = () => {
    queueMicrotask(() => {
      const active = completionPanel.value?.querySelector(
        ".editor-completion-item-active",
      );
      active?.scrollIntoView({ block: "nearest" });
    });
  };

  const moveCompletionSelection = (delta: number): boolean => {
    const completion = getCurrentDslCompletion();
    if (!completion) return false;
    const { options } = completion;
    selectedCompletionIndex.value =
      (selectedCompletionIndex.value + delta + options.length) % options.length;
    syncCompletionScroll();
    return true;
  };

  const applySelectedCompletion = (): boolean => {
    const completion = getCurrentDslCompletion();
    if (!completion) return false;
    const option = completion.options[selectedCompletionIndex.value];
    if (!option) return false;
    applyCompletionTemplate(option);
    return true;
  };

  const updateCompletionPanelPosition = () => {
    const completion = getCurrentDslCompletion();
    if (
      !editorView ||
      !editorRoot.value ||
      !completion ||
      !showCompletionPanel.value
    ) {
      completionPanelStyle.value = {};
      return;
    }

    const caret = editorView.coordsAtPos(
      editorView.state.selection.main.head,
    );
    const rootRect = editorRoot.value.getBoundingClientRect();
    if (!caret) {
      completionPanelStyle.value = {};
      return;
    }

    const panelWidth = Math.min(320, Math.max(220, rootRect.width - 24));
    const left = Math.min(
      Math.max(12, caret.left - rootRect.left),
      Math.max(12, rootRect.width - panelWidth - 12),
    );
    const top = Math.min(
      Math.max(12, caret.bottom - rootRect.top + 8),
      Math.max(12, rootRect.height - 192),
    );

    completionPanelStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
      width: `${panelWidth}px`,
    };
  };

  const shouldTriggerDslCompletion = (view: EditorView): boolean => {
    const head = view.state.selection.main.head;
    const before = view.state.sliceDoc(Math.max(0, head - 64), head);
    return /(?<![>~])=([A-Za-z-]*)$/.test(before);
  };

  const queueCompletion = (view: EditorView) => {
    queueMicrotask(() => {
      if (!view.hasFocus) return;
      if (completionDismissedAt >= 0) {
        completionDismissedAt = -1;
        return;
      }
      if (shouldTriggerDslCompletion(view)) {
        selectedCompletionIndex.value = 0;
        showCompletionPanel.value = true;
        startCompletion(view);
        updateCompletionPanelPosition();
      } else {
        showCompletionPanel.value = false;
        closeCompletion(view);
        completionPanelStyle.value = {};
      }
    });
  };

  const completeDslTag = (context: { matchBefore: (re: RegExp) => { from: number; to: number; text: string } | null; explicit: boolean }) => {
    const before = context.matchBefore(/(?<![>~])=[A-Za-z-]*/);
    if (!before) return null;
    if (!context.explicit && before.from === before.to) return null;

    const typed = before.text.slice(1);
    const options = getCompletionOptions().filter((option) =>
      option.label.startsWith(typed),
    );
    if (options.length === 0) return null;

    return {
      from: before.from,
      options,
      validFor: /^(?<![>~])=[A-Za-z-]*$/,
    };
  };

  const createEditorExtensions = () => [
    basicSetup,
    EditorView.lineWrapping,
    autocompletion({
      override: [completeDslTag],
      activateOnTyping: true,
      defaultKeymap: true,
    }),
    buildHighlightPlugin((text) => tokenizer.value.tokenize(text)),
    Prec.highest(
      keymap.of([
        { key: "ArrowDown", run: () => moveCompletionSelection(1) },
        { key: "ArrowUp", run: () => moveCompletionSelection(-1) },
        { key: "Enter", run: () => applySelectedCompletion() },
        { key: "Tab", run: () => applySelectedCompletion() },
        {
          key: "Escape",
          run: () => {
            if (!editorView) return false;
            showCompletionPanel.value = false;
            completionDismissedAt = editorView.state.selection.main.head;
            closeCompletion(editorView);
            completionPanelStyle.value = {};
            return true;
          },
        },
        ...Array.from({ length: 9 }, (_, index) => ({
          key: String(index + 1),
          run: () => {
            const completion = getCurrentDslCompletion();
            if (!completion) return false;
            selectedCompletionIndex.value = Math.min(
              index,
              completion.options.length - 1,
            );
            syncCompletionScroll();
            return applySelectedCompletion();
          },
        })),
      ]),
    ),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const nextSource = update.state.doc.toString();
        onDocChange(update.changes, nextSource);
        queueCompletion(update.view);
      }

      if (update.docChanged || update.selectionSet) {
        caretOffset.value = update.state.selection.main.head;
        updateCompletionPanelPosition();
      }

      if (!update.docChanged && update.selectionSet) {
        showCompletionPanel.value = false;
        closeCompletion(update.view);
        completionPanelStyle.value = {};
      }

      if (update.viewportChanged) {
        updateCompletionPanelPosition();
      }
    }),
    EditorView.theme({
      "&": {
        height: "100%",
        backgroundColor: "#171311",
        color: "#f7f1e8",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: '"SFMono-Regular", "JetBrains Mono", "Menlo", monospace',
        lineHeight: "1.65",
        scrollbarGutter: "stable",
      },
      ".cm-content, .cm-gutter": { minHeight: "100%" },
      ".cm-content": {
        padding: "18px 0",
        caretColor: "#fff4de",
        fontKerning: "none",
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "calt" 0',
      },
      ".cm-line": { padding: "0 18px" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#fff4de" },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: "rgba(255, 214, 102, 0.22) !important",
      },
      ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.02)" },
      ".cm-gutters": { display: "none" },
      ".cm-focused": { outline: "none" },
    }),
  ];

  const mountEditor = () => {
    if (!editorRoot.value) return;
    editorView?.destroy();
    editorView = new EditorView({
      state: EditorState.create({
        doc: source.value,
        extensions: createEditorExtensions(),
      }),
      parent: editorRoot.value,
    });
    caretOffset.value = editorView.state.selection.main.head;
    updateCompletionPanelPosition();
  };

  const destroyEditor = () => {
    editorView?.destroy();
    editorView = null;
  };

  const syncSourceToEditor = (nextSource: string) => {
    if (!editorView) return;
    const currentDoc = editorView.state.doc.toString();
    if (currentDoc === nextSource) return;
    editorView.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: nextSource },
      selection: { anchor: Math.min(caretOffset.value, nextSource.length) },
    });
  };

  const remountPreservingSelection = () => {
    if (!editorView) return;
    const selection = editorView.state.selection;
    mountEditor();
    if (editorView) {
      editorView.dispatch({ selection });
    }
  };

  const insertSnippetAtRandom = (snippet: string) => {
    if (editorView) {
      const docLen = editorView.state.doc.length;
      const pos = Math.floor(Math.random() * (docLen + 1));
      editorView.dispatch({
        changes: { from: pos, insert: snippet },
        selection: { anchor: pos + snippet.length },
      });
      editorView.focus();
    } else {
      const pos = Math.floor(Math.random() * (source.value.length + 1));
      source.value =
        source.value.slice(0, pos) + snippet + source.value.slice(pos);
      caretOffset.value = pos + snippet.length;
    }
  };

  return {
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
    updatePanelHeight: () => {
      panelHeight.value = Math.min(1500, Math.max(1000, window.innerHeight - 100));
    },
  };
};
