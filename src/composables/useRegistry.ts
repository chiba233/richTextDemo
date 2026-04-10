import { computed, type Ref, type ComputedRef } from "vue";
import {
  createSimpleInlineHandlers,
  createPipeHandlers,
  declareMultilineTags,
  type TagHandler,
  type PipeHandlerDefinition,
  type BlockTagInput,
  type TagForm,
  type TextToken,
} from "yume-dsl-rich-text";
import type { TranslationCopy, CompletionTemplate, RegistryItem } from "../types";

const registryBase: readonly RegistryItem[] = [
  { key: "bold", label: "bold" },
  { key: "italic", label: "italic" },
  { key: "link", label: "link" },
  { key: "ruby", label: "ruby" },
  { key: "warn", label: "warn" },
  { key: "code", label: "code" },
];

const completionTemplates: Record<string, CompletionTemplate[]> = {
  bold: [
    {
      label: "bold",
      detail: "inline",
      template: "=bold<${text}>=",
      insertText: "=bold<>=",
      cursorOffset: "=bold<".length,
      info: "Insert a simple inline bold tag.",
    },
  ],
  italic: [
    {
      label: "italic",
      detail: "inline",
      template: "=italic<${text}>=",
      insertText: "=italic<>=",
      cursorOffset: "=italic<".length,
      info: "Insert a simple inline italic tag.",
    },
  ],
  link: [
    {
      label: "link",
      detail: "inline",
      template: "=link<${https://example.com} | ${label}>=",
      insertText: "=link<https://example.com | label>=",
      cursorOffset: "=link<".length,
      info: "Insert a link tag with URL and label.",
    },
  ],
  ruby: [
    {
      label: "ruby",
      detail: "inline",
      template: "=ruby<${漢字} | ${かんじ}>=",
      insertText: "=ruby<漢字 | かんじ>=",
      cursorOffset: "=ruby<".length,
      info: "Insert ruby base text and reading.",
    },
  ],
  warn: [
    {
      label: "warn",
      detail: "inline",
      template: "=warn<${title} | ${meta1} | ${meta2}>=",
      insertText: "=warn<title | meta1 | meta2>=",
      cursorOffset: "=warn<".length,
      info: "Insert an inline warn tag with extra metadata slots.",
    },
    {
      label: "warn block",
      detail: "block",
      template: "=warn<${title} | ${meta1} | ${meta2}>*\n${content}\n*",
      insertText: "=warn<title | meta1 | meta2>*\ncontent\n*",
      cursorOffset: "=warn<".length,
      info: "Insert a block warn tag.",
    },
  ],
  code: [
    {
      label: "code",
      detail: "raw",
      template: "=code<${lang} | ${title}>%\n${content}\n%",
      insertText: "=code<lang | title>%\ncontent\n%",
      cursorOffset: "=code<".length,
      info: "Insert a raw code block tag.",
    },
  ],
};

export const useRegistry = (
  copy: ComputedRef<TranslationCopy>,
  enabledTags: Ref<string[]>,
) => {
  const registryOptions = computed(() =>
    registryBase.map((item) => ({
      ...item,
      description: copy.value.registryDescriptions[item.key as keyof typeof copy.value.registryDescriptions],
    })),
  );

  const activeHandlers = computed<Record<string, TagHandler>>(() => {
    const enabled = new Set(enabledTags.value);
    const handlers: Record<string, TagHandler> = {};

    if (enabled.has("bold") || enabled.has("italic")) {
      Object.assign(
        handlers,
        createSimpleInlineHandlers(
          (["bold", "italic"] as const).filter((name) => enabled.has(name)),
        ),
      );
    }

    const pipeDefinitions: Record<string, PipeHandlerDefinition> = {};

    if (enabled.has("link")) {
      pipeDefinitions.link = {
        inline: (args) => ({
          type: "link",
          href: args.text(0) || "#",
          value: args.materializedTailTokens(1),
        }),
      };
    }

    if (enabled.has("ruby")) {
      pipeDefinitions.ruby = {
        inline: (args) => ({
          type: "ruby",
          base: args.text(0),
          rt: args.text(1),
          value: args.materializedTokens(0),
        }),
      };
    }

    if (enabled.has("warn")) {
      pipeDefinitions.warn = {
        inline: (args) => ({
          type: "warn",
          title: args.text(0) || "Notice",
          titleTokens: args.materializedTokens(0),
          metaTokens: [args.materializedTokens(1), args.materializedTokens(2)].filter(
            (item) => item.length > 0,
          ),
          value: args.materializedTailTokens(3),
        }),
        block: (args, content: TextToken[]) => ({
          type: "warn",
          title: args.text(0) || "Notice",
          titleTokens: args.materializedTokens(0),
          metaTokens: [args.materializedTokens(1), args.materializedTokens(2)].filter(
            (item) => item.length > 0,
          ),
          value: content,
        }),
      };
    }

    if (enabled.has("code")) {
      pipeDefinitions.code = {
        raw: (args, content: string) => ({
          type: "code",
          language: args.text(0) || "plain",
          title: args.text(1) || "",
          value: content,
        }),
      };
    }

    if (Object.keys(pipeDefinitions).length > 0) {
      Object.assign(handlers, createPipeHandlers(pipeDefinitions));
    }

    return handlers;
  });

  const activeBlockTags = computed(() => {
    const tags: BlockTagInput[] = [];
    if (enabledTags.value.includes("warn")) tags.push("warn");
    if (enabledTags.value.includes("code"))
      tags.push({ tag: "code", forms: ["raw" as TagForm] });
    return declareMultilineTags(tags);
  });

  return {
    registryBase,
    registryOptions,
    activeHandlers,
    activeBlockTags,
    completionTemplates,
    enabledTags,
  };
};
