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

const toggleTag = (key: string, checked: boolean, current: string[]) => {
  const next = checked
    ? [...current, key]
    : current.filter((t) => t !== key);
  emit("update:enabledTags", next);
};
</script>

<template>
  <article class="panel source-panel">
    <header class="panel-head">
      <p class="eyebrow">{{ copy.registryEyebrow }}</p>
      <h2>{{ copy.registryTitle }}</h2>
    </header>
    <div class="panel-body registry-grid">
      <label v-for="option in registryOptions" :key="option.key" class="registry-item">
        <input
          type="checkbox"
          :checked="enabledTags.includes(option.key)"
          @change="toggleTag(option.key, ($event.target as HTMLInputElement).checked, enabledTags)"
        />
        <div>
          <div class="registry-title">
            <code>{{ option.label }}</code>
          </div>
          <div class="registry-copy">{{ option.description }}</div>
        </div>
      </label>
      <div class="tag-list">
        <span v-for="tag in enabledTags" :key="tag" class="tag-chip">
          {{ copy.declared }}: {{ tag }}
        </span>
      </div>
    </div>
  </article>
</template>
