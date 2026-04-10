<script setup lang="ts">
import type { TranslationCopy, LanguageOption } from "../types";
import FormattedText from "./FormattedText";

defineProps<{
  copy: TranslationCopy;
  currentLang: string;
  languages: readonly LanguageOption[];
}>();

const emit = defineEmits<{
  "update:currentLang": [lang: string];
}>();
</script>

<template>
  <section class="hero">
    <div class="hero-topline">
      <p class="hero-kicker">{{ copy.heroKicker }}</p>
      <div class="language-switch">
        <button
          v-for="item in languages"
          :key="item.key"
          type="button"
          class="lang-button"
          :class="{ active: currentLang === item.key }"
          @click="emit('update:currentLang', item.key)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
    <h1>{{ copy.heroTitle }}</h1>
    <p class="hero-copy">
      <FormattedText :text="copy.heroCopy" />
    </p>
    <div class="hero-links">
      <a href="https://github.com/chiba233/yumeDSL" target="_blank" rel="noreferrer">GitHub</a>
      <a href="https://github.com/chiba233/yumeDSL/wiki" target="_blank" rel="noreferrer">Wiki</a>
      <a href="https://www.npmjs.com/package/yume-dsl-rich-text" target="_blank" rel="noreferrer">npm</a>
    </div>
  </section>
</template>
