import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "app_theme";

export const DARK = {
  bg:      "#07080f",
  card:    "#0f1120",
  border:  "#1e2235",
  grid:    "#181b2e",
  primary: "#4f8ef7",
  green:   "#22c55e",
  yellow:  "#f59e0b",
  red:     "#ef4444",
  cyan:    "#06b6d4",
  text1:   "#f1f5f9",
  text2:   "#94a3b8",
  text3:   "#475569",
  isDark:  true,
};

export const LIGHT = {
  bg:      "#f0f4f8",
  card:    "#ffffff",
  border:  "#dde3ed",
  grid:    "#edf2f7",
  primary: "#3b82f6",
  green:   "#16a34a",
  yellow:  "#d97706",
  red:     "#dc2626",
  cyan:    "#0891b2",
  text1:   "#0f172a",
  text2:   "#475569",
  text3:   "#94a3b8",
  isDark:  false,
};

const ThemeContext = createContext({ C: DARK, isDark: true, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === "light") setIsDark(false);
    });
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ C: isDark ? DARK : LIGHT, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
