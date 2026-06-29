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
import { isDark } from "./useColorScheme";

// Syntax palettes: deep tones for the light glass editor, brighter tones for
// the dark editor surface — both stay legible on their respective background.
const lightSyntax = {
  punct: "#b32d6b",
  tagName: "#c1432f",
  bracket: "#b06a18",
  operator: "#9a6d00",
  separator: "#0e7490",
  end: "#2f8a4e",
  escape: "#7c4dcf",
  argText: "#6d5577",
  contentText: "#3a2e25",
};

const darkSyntax = {
  punct: "#ff8fb3",
  tagName: "#ff9e7a",
  bracket: "#ffc266",
  operator: "#e3c266",
  separator: "#5cc8e0",
  end: "#7ddf9a",
  escape: "#c9a6ff",
  argText: "#cbb6d6",
  contentText: "#e8dfe8",
};

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

  const tokenizer = computed(() =>
    createTokenizerFromParser(parserOptions.value, isDark.value ? darkSyntax : lightSyntax),
  );

  return { demoSyntax, parserOptions, parser, tokenizer };
};
