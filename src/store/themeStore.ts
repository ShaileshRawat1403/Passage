import { create } from "zustand";

export type ThemeId =
  | "cyber-obsidian"
  | "emerald-matrix"
  | "tokyo-sunset"
  | "polar-frost"
  | "monochrome-industrial"
  | "blueprint-light";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  isDark: boolean;
  colors: {
    appBg: string;
    panelBg: string;
    border: string;
    primary: string;
    secondary: string;
    textMain: string;
    textMuted: string;
  };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "cyber-obsidian",
    name: "Cyber Obsidian",
    tagline: "Cyan & violet cyberpunk dark canvas",
    isDark: true,
    colors: {
      appBg: "#070b14",
      panelBg: "#0e1626",
      border: "rgba(34,211,238,0.3)",
      primary: "#22d3ee",
      secondary: "#a855f7",
      textMain: "#f8fafc",
      textMuted: "#94a3b8",
    },
  },
  {
    id: "emerald-matrix",
    name: "Emerald Matrix",
    tagline: "Bio-tech terminal with vibrant green glow",
    isDark: true,
    colors: {
      appBg: "#030d08",
      panelBg: "#081810",
      border: "rgba(16,185,129,0.35)",
      primary: "#10b981",
      secondary: "#06b6d4",
      textMain: "#f0fdf4",
      textMuted: "#6ee7b7",
    },
  },
  {
    id: "tokyo-sunset",
    name: "Tokyo Sunset",
    tagline: "Synthwave dark with neon magenta & amber",
    isDark: true,
    colors: {
      appBg: "#0f0814",
      panelBg: "#180e22",
      border: "rgba(236,72,153,0.35)",
      primary: "#ec4899",
      secondary: "#f59e0b",
      textMain: "#fdf2f8",
      textMuted: "#f472b6",
    },
  },
  {
    id: "polar-frost",
    name: "Polar Frost",
    tagline: "Arctic deep navy with ice blue accents",
    isDark: true,
    colors: {
      appBg: "#080d1a",
      panelBg: "#0f172a",
      border: "rgba(56,189,248,0.35)",
      primary: "#38bdf8",
      secondary: "#818cf8",
      textMain: "#f0f9ff",
      textMuted: "#7dd3fc",
    },
  },
  {
    id: "monochrome-industrial",
    name: "Monochrome Industrial",
    tagline: "Stealth zinc with stark white indicators",
    isDark: true,
    colors: {
      appBg: "#09090b",
      panelBg: "#18181b",
      border: "rgba(255,255,255,0.25)",
      primary: "#f4f4f5",
      secondary: "#a1a1aa",
      textMain: "#fafafa",
      textMuted: "#a1a1aa",
    },
  },
  {
    id: "blueprint-light",
    name: "Pure White Light",
    tagline: "Crisp pure white high-contrast light theme",
    isDark: false,
    colors: {
      appBg: "#ffffff",
      panelBg: "#ffffff",
      border: "rgba(203,213,225,0.9)",
      primary: "#2563eb",
      secondary: "#0284c7",
      textMain: "#0f172a",
      textMuted: "#475569",
    },
  },
];

interface ThemeStoreState {
  currentThemeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  currentThemeId: "cyber-obsidian",
  setTheme: (themeId: ThemeId) => {
    document.documentElement.setAttribute("data-theme", themeId);
    set({ currentThemeId: themeId });
  },
}));
