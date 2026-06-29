import { ref } from "vue";

// Sakura-glass theming. Each preset drives the accent (text / borders / glow)
// and the three aurora blobs behind the glass. Inspired by YumeLog's
// single-color-derives-everything approach, but curated rather than generative.

export interface ThemePreset {
  key: string;
  label: string;
  /** Solid color shown on the selector dot. */
  swatch: string;
  /** Accent as an "r, g, b" triplet so CSS can compose alpha + color-mix. */
  accentRgb: string;
  /** Three soft tints for the aurora backdrop. */
  aurora: [string, string, string];
}

export const themePresets: ThemePreset[] = [
  {
    key: "sakura",
    label: "桜",
    swatch: "#e07aa0",
    accentRgb: "214, 91, 134",
    aurora: ["#ffdce8", "#ffe7d4", "#ece1ff"],
  },
  {
    key: "matcha",
    label: "抹茶",
    swatch: "#6fa15a",
    accentRgb: "94, 140, 79",
    aurora: ["#dcf0d4", "#eef6d2", "#d2efe2"],
  },
  {
    key: "sora",
    label: "空",
    swatch: "#4c93c4",
    accentRgb: "63, 134, 184",
    aurora: ["#d4e8f6", "#dbe6ff", "#e3dbff"],
  },
  {
    key: "fuji",
    label: "藤",
    swatch: "#9579c9",
    accentRgb: "138, 107, 191",
    aurora: ["#e7ddff", "#f3dcef", "#ddd9ff"],
  },
  {
    key: "mitsu",
    label: "蜜",
    swatch: "#cf9436",
    accentRgb: "192, 131, 42",
    aurora: ["#ffedcf", "#ffe1c6", "#f7ead0"],
  },
];

const STORAGE_KEY = "yumedsl-demo-theme";

const readStored = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "sakura";
  } catch {
    return "sakura";
  }
};

export const activeTheme = ref(readStored());

const apply = (key: string): void => {
  if (typeof document === "undefined") return;
  const preset = themePresets.find((item) => item.key === key) ?? themePresets[0];
  const root = document.documentElement;
  root.style.setProperty("--accent-rgb", preset.accentRgb);
  root.style.setProperty("--aurora-1", preset.aurora[0]);
  root.style.setProperty("--aurora-2", preset.aurora[1]);
  root.style.setProperty("--aurora-3", preset.aurora[2]);
};

export const setTheme = (key: string): void => {
  activeTheme.value = key;
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* ignore storage failures */
  }
  apply(key);
};

export const useTheme = () => {
  apply(activeTheme.value);
  return { themePresets, activeTheme, setTheme };
};
