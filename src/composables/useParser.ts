import { computed, type ComputedRef } from "vue";
import {
  createParser,
  createSyntax,
  type SyntaxConfig,
  type TagHandler,
  type BlockTagInput,
  createEasyStableId,
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
    implicitInlineShorthand: true,
    createId: createEasyStableId(),
  }));

  const parser = computed(() => createParser(parserOptions.value));

  // Syntax palette tuned for the light frosted-glass editor surface — deep,
  // saturated tones that stay legible on a near-white background.
  const tokenizer = computed(() =>
    createTokenizerFromParser(parserOptions.value, {
      punct: "#b32d6b",
      tagName: "#c1432f",
      bracket: "#b06a18",
      operator: "#9a6d00",
      separator: "#0e7490",
      end: "#2f8a4e",
      escape: "#7c4dcf",
      argText: "#6d5577",
      contentText: "#3a2e25",
    }),
  );

  return { demoSyntax, parserOptions, parser, tokenizer };
};
