import { computed, type ComputedRef } from "vue";
import {
  createParser,
  createSyntax,
  type SyntaxConfig,
  type TagHandler,
  type BlockTagInput,
} from "yume-dsl-rich-text";
import { createTokenizerFromParser } from "yume-dsl-shiki-highlight";

export const demoSyntax: SyntaxConfig = createSyntax({
  tagPrefix: "=",
  tagOpen: "<",
  tagClose: ">",
  tagDivider: "|",
  endTag: ">=",
  rawOpen: ">%",
  blockOpen: ">*",
  rawClose: "%",
  blockClose: "*",
  escapeChar: "~",
});

export const useParser = (
  activeHandlers: ComputedRef<Record<string, TagHandler>>,
  activeBlockTags: ComputedRef<BlockTagInput[]>,
) => {
  const parserOptions = computed(() => ({
    handlers: activeHandlers.value,
    blockTags: activeBlockTags.value,
    syntax: demoSyntax,
    depthLimit: 9950,
  }));

  const parser = computed(() => createParser(parserOptions.value));

  const tokenizer = computed(() =>
    createTokenizerFromParser(parserOptions.value, {
      punct: "#ffd166",
      tagName: "#ff6b6b",
      bracket: "#f4a261",
      operator: "#e9c46a",
      separator: "#4cc9f0",
      end: "#80ed99",
      escape: "#c77dff",
      argText: "#fff1db",
      contentText: "#f8f9fa",
    }),
  );

  return { demoSyntax, parserOptions, parser, tokenizer };
};
