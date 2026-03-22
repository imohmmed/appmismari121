import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

import Colors, { type ThemeColors } from "@/constants/colors";
import translations, { type Language, type TranslationKey } from "@/constants/translations";

export type ThemeMode = "light" | "dark" | "system";

interface SettingsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
  t: (key: TranslationKey) => string;
  isArabic: boolean;
  fontAr: (weight: "Regular" | "Medium" | "SemiBold" | "Bold" | "ExtraBold" | "Black" | "Light") => string;
  subscriptionCode: string;
  setSubscriptionCode: (code: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const LANG_KEY = "@mismari_language";
const THEME_KEY = "@mismari_theme";
const CODE_KEY = "@mismari_subscription_code";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [language, setLanguageState] = useState<Language>("ar");
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [subscriptionCode, setSubscriptionCodeState] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedLang, savedTheme, savedCode] = await Promise.all([
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(CODE_KEY),
        ]);
        if (savedLang === "ar" || savedLang === "en") setLanguageState(savedLang);
        if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") setThemeModeState(savedTheme);
        if (savedCode) setSubscriptionCodeState(savedCode);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANG_KEY, lang).catch(() => {});
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_KEY, mode).catch(() => {});
  };

  const setSubscriptionCode = (code: string) => {
    setSubscriptionCodeState(code);
    AsyncStorage.setItem(CODE_KEY, code).catch(() => {});
  };

  const resolvedTheme =
    themeMode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : themeMode;

  const isDark = resolvedTheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  const isArabic = language === "ar";

  const fontAr = (weight: "Regular" | "Medium" | "SemiBold" | "Bold" | "ExtraBold" | "Black" | "Light"): string => {
    if (isArabic) return `Mestika-${weight}`;
    const map: Record<string, string> = {
      Regular: "Inter_400Regular",
      Medium: "Inter_500Medium",
      SemiBold: "Inter_600SemiBold",
      Bold: "Inter_700Bold",
      ExtraBold: "Inter_700Bold",
      Black: "Inter_700Bold",
      Light: "Inter_400Regular",
    };
    return map[weight];
  };

  if (!loaded) return null;

  return (
    <SettingsContext.Provider
      value={{
        language,
        setLanguage,
        themeMode,
        setThemeMode,
        colors,
        isDark,
        t,
        isArabic,
        fontAr,
        subscriptionCode,
        setSubscriptionCode,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
