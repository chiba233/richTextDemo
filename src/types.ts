import type { StructuralNode, TextToken, TokenDiffResult } from "yume-dsl-rich-text";

export interface LanguageOption {
  key: string;
  label: string;
}

export interface RegistryItem {
  key: string;
  label: string;
  description?: string;
}

export interface CompletionTemplate {
  label: string;
  detail: string;
  template: string;
  insertText: string;
  cursorOffset: number;
  info: string;
}

export interface RegistryDescriptions {
  bold: string;
  italic: string;
  link: string;
  ruby: string;
  warn: string;
  code: string;
}

export interface TranslationCopy {
  heroKicker: string;
  heroTitle: string;
  heroCopy: string;
  registryEyebrow: string;
  registryTitle: string;
  sourceEyebrow: string;
  sourceTitle: string;
  previewEyebrow: string;
  previewTitle: string;
  previewViewResult: string;
  previewViewStructural: string;
  previewViewRichText: string;
  previewViewDiff: string;
  structuralTreeTitle: string;
  richTextTreeTitle: string;
  diffTitle: string;
  diffEmpty: string;
  printedSourceTitle: string;
  deepSample: string;
  deepSampleHint: string;
  largeSample: string;
  largeSampleHint: string;
  randomInsert: string;
  declared: string;
  caret: string;
  hit: string;
  range: string;
  noSlice: string;
  parseSliceLabel: string;
  structuralLabel: string;
  composeLabel: string;
  incrementalLabel: string;
  incrementalModeLabel: string;
  reusedLabel: string;
  sliceTitle: string;
  sliceCopy: string;
  sliceEmpty: string;
  composedTitle: string;
  composedCopy: string;
  registryDescriptions: RegistryDescriptions;
  sampleSource: string;
}

export interface SliceResult {
  error: string;
  tokens: TextToken[];
  sliceMs: number;
  targetLabel: string;
  rangeLabel: string;
  node: StructuralNode | null;
}

export interface Segment {
  key: string;
  tokens: TextToken[];
  srcFrom: number;
  srcTo: number;
}

export interface ComposedState {
  segments: Segment[];
  composeMs: number;
  reusedCount: number;
  incrementalMs: number;
  incrementalMode: string;
  structuralTree: StructuralNode[];
  richTextTokens: TextToken[];
  incrementalDiff: TokenDiffResult | null;
  printedSource: string;
}
