<script setup lang="ts">
import type { TranslationCopy, RegistryItem } from "../types";

defineProps<{
  copy: TranslationCopy;
  registryOptions: RegistryItem[];
  enabledTags: string[];
}>();

const emit = defineEmits<{
  "update:enabledTags": [tags: string[]];
}>();

const toggleTag = (key: string, current: string[]) => {
  const next = current.includes(key)
    ? current.filter((tag) => tag !== key)
    : [...current, key];
  emit("update:enabledTags", next);
};
</script>

<template>
  <nav class="tag-dock chrome" :aria-label="copy.registryTitle">
    <span class="dock-label" :title="copy.registryTitle" :aria-label="copy.registryTitle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    </span>
    <button
      v-for="option in registryOptions"
      :key="option.key"
      type="button"
      class="tag-toggle"
      :class="[`tt-${option.key}`, { active: enabledTags.includes(option.key) }]"
      :title="`${option.label} — ${option.description}`"
      :aria-label="option.label"
      :aria-pressed="enabledTags.includes(option.key)"
      @click="toggleTag(option.key, enabledTags)"
    >
      <template v-if="option.key === 'ruby'">
        <ruby class="tag-full">{{ option.label }}<rt>ルビ</rt></ruby>
        <ruby class="tag-short">字<rt>じ</rt></ruby>
      </template>
      <template v-else-if="option.key === 'code'">
        <span class="tag-full">{{ option.label }}</span>
        <span class="tag-short">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8.5 8 4.5 12l4 4" />
            <path d="M15.5 8l4 4-4 4" />
          </svg>
        </span>
      </template>
      <template v-else-if="option.key === 'warn'">
        <span class="tag-full">{{ option.label }}</span>
        <span class="tag-short">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 4 21 19H3z" />
            <path d="M12 10v4" />
            <path d="M12 17h.01" />
          </svg>
        </span>
      </template>
      <template v-else>
        <span class="tag-full">{{ option.label }}</span>
        <span class="tag-short">{{ option.label.charAt(0) }}</span>
      </template>
    </button>
  </nav>
</template>
