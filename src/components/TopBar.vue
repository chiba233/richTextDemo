<script setup lang="ts">
import { computed, ref } from "vue";
import type { TranslationCopy, LanguageOption } from "../types";
import { themePresets, activeTheme, setTheme } from "../composables/useTheme";

const props = defineProps<{
  copy: TranslationCopy;
  currentLang: string;
  languages: readonly LanguageOption[];
}>();

const emit = defineEmits<{
  "update:currentLang": [lang: string];
}>();

const menuOpen = ref(false);

const version = computed(
  () => `rich-text ${__YUME_DEMO_PACKAGE_VERSIONS__["yume-dsl-rich-text"]}`,
);

const currentLangLabel = computed(
  () => props.languages.find((item) => item.key === props.currentLang)?.label ?? props.currentLang,
);

const activeSwatch = computed(
  () => themePresets.find((item) => item.key === activeTheme.value)?.swatch ?? "#e07aa0",
);
</script>

<template>
  <header class="topbar chrome">
    <div class="brand">
      <span class="brand-mark" aria-label="TypeScript" role="img">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <rect width="24" height="24" rx="5" fill="#3178c6" />
          <text
            x="12.5"
            y="17"
            text-anchor="middle"
            font-family="'SFMono-Regular', 'JetBrains Mono', 'Menlo', monospace"
            font-weight="700"
            font-size="9.5"
            fill="#ffffff"
          >TS</text>
        </svg>
      </span>
      <span class="brand-name">yumeDSL</span>
      <span class="brand-version">{{ version }}</span>
    </div>

    <div class="topbar-controls">
      <div class="language-switch" role="group" aria-label="language">
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
      <div class="theme-switch" role="group" aria-label="theme">
        <button
          v-for="preset in themePresets"
          :key="preset.key"
          type="button"
          class="theme-dot"
          :class="{ active: activeTheme === preset.key }"
          :style="{ '--dot': preset.swatch }"
          :title="preset.label"
          :aria-label="preset.label"
          :aria-pressed="activeTheme === preset.key"
          @click="setTheme(preset.key)"
        />
      </div>
    </div>

    <button
      type="button"
      class="topbar-menu-btn"
      :aria-expanded="menuOpen"
      aria-label="settings"
      @click="menuOpen = !menuOpen"
    >
      <span class="menu-lang">{{ currentLangLabel }}</span>
      <span class="menu-dot" :style="{ background: activeSwatch }" />
    </button>

    <Teleport to="body">
      <template v-if="menuOpen">
        <div class="settings-backdrop" @click="menuOpen = false" />
        <div class="settings-sheet chrome" role="menu">
          <div class="settings-group">
            <p class="settings-label">Language</p>
            <div class="settings-cards">
              <button
                v-for="item in languages"
                :key="item.key"
                type="button"
                class="lang-card"
                :class="{ active: currentLang === item.key }"
                @click="emit('update:currentLang', item.key)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
          <div class="settings-group">
            <p class="settings-label">Theme</p>
            <div class="settings-cards">
              <button
                v-for="preset in themePresets"
                :key="preset.key"
                type="button"
                class="theme-card"
                :class="{ active: activeTheme === preset.key }"
                @click="setTheme(preset.key)"
              >
                <span class="theme-card-dot" :style="{ background: preset.swatch }" />
                <span class="theme-card-label">{{ preset.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </Teleport>
  </header>
</template>
