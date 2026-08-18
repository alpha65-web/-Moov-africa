"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface ThemePreset {
  key: string;
  label: string;
  primary: string;
  primaryLight: string;
  swatch: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { key: "orange", label: "Orange", primary: "#ff6500", primaryLight: "#ff8c42", swatch: "#ff6500" },
  { key: "blue", label: "Bleu", primary: "#2563eb", primaryLight: "#3b82f6", swatch: "#2563eb" },
  { key: "emerald", label: "Emerald", primary: "#059669", primaryLight: "#10b981", swatch: "#059669" },
  { key: "violet", label: "Violet", primary: "#7c3aed", primaryLight: "#8b5cf6", swatch: "#7c3aed" },
  { key: "rose", label: "Rose", primary: "#e11d48", primaryLight: "#f43f5e", swatch: "#e11d48" },
  { key: "cyan", label: "Cyan", primary: "#0891b2", primaryLight: "#06b6d4", swatch: "#0891b2" },
  { key: "amber", label: "Ambre", primary: "#d97706", primaryLight: "#f59e0b", swatch: "#d97706" },
  { key: "slate", label: "Slate", primary: "#475569", primaryLight: "#64748b", swatch: "#475569" },
];

const DEFAULT_THEME = "orange";

interface ThemeColorContextValue {
  themeKey: string;
  setThemeKey: (key: string) => void;
  preset: ThemePreset;
}

const ThemeColorContext = createContext<ThemeColorContextValue>({
  themeKey: DEFAULT_THEME,
  setThemeKey: () => {},
  preset: THEME_PRESETS[0],
});

function applyTheme(preset: ThemePreset) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", preset.primary);
  root.style.setProperty("--color-primary-light", preset.primaryLight);
}

export function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKeyState] = useState(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme-color") || DEFAULT_THEME;
    const preset = THEME_PRESETS.find(p => p.key === saved) || THEME_PRESETS[0];
    setThemeKeyState(preset.key);
    applyTheme(preset);
    setMounted(true);
  }, []);

  const setThemeKey = useCallback((key: string) => {
    const preset = THEME_PRESETS.find(p => p.key === key) || THEME_PRESETS[0];
    setThemeKeyState(preset.key);
    localStorage.setItem("theme-color", preset.key);
    applyTheme(preset);
  }, []);

  const preset = THEME_PRESETS.find(p => p.key === themeKey) || THEME_PRESETS[0];

  if (!mounted) return <>{children}</>;

  return (
    <ThemeColorContext.Provider value={{ themeKey, setThemeKey, preset }}>
      {children}
    </ThemeColorContext.Provider>
  );
}

export function useThemeColor() {
  return useContext(ThemeColorContext);
}
