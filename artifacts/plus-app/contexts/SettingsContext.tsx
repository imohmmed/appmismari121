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
  onboardingDone: boolean;
  setOnboardingDone: (done: boolean) => void;
  deviceUdid: string;
  setDeviceUdid: (udid: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const LANG_KEY = "@mismari_language";
const THEME_KEY = "@mismari_theme";
const CODE_KEY = "@mismari_subscription_code";
const ONBOARDING_KEY = "@mismari_onboarding_done";
const UDID_KEY = "@mismari_device_udid";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [language, setLanguageState] = useState<Language>("ar");
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [subscriptionCode, setSubscriptionCodeState] = useState("");
  const [onboardingDone, setOnboardingDoneState] = useState(false);
  const [deviceUdid, setDeviceUdidState] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedLang, savedTheme, savedCode, savedOnboarding, savedUdid] = await Promise.all([
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(CODE_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(UDID_KEY),
        ]);
        if (savedLang === "ar" || savedLang === "en") setLanguageState(savedLang);
        if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") setThemeModeState(savedTheme);
        if (savedCode) setSubscriptionCodeState(savedCode);
        if (savedOnboarding === "true") setOnboardingDoneState(true);
        if (savedUdid) setDeviceUdidState(savedUdid);
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

  const setOnboardingDone = (done: boolean) => {
    setOnboardingDoneState(done);
    AsyncStorage.setItem(ONBOARDING_KEY, done ? "true" : "false").catch(() => {});
  };

  const setDeviceUdid = (udid: string) => {
    setDeviceUdidState(udid);
    AsyncStorage.setItem(UDID_KEY, udid).catch(() => {});
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
        onboardingDone,
        setOnboardingDone,
        deviceUdid,
        setDeviceUdid,
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
