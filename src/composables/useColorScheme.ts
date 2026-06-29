import { ref } from "vue";

// Reactive `prefers-color-scheme: dark` flag, shared app-wide.
const query =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export const isDark = ref(query ? query.matches : false);

query?.addEventListener("change", (event) => {
  isDark.value = event.matches;
});
