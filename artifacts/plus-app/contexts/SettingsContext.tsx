import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";

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
  profilePhoto: string;
  setProfilePhoto: (uri: string) => void;
  loaded: boolean;
  appName: string;
  appNameEn: string;
  logoUrl: string;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const LANG_KEY = "@mismari_language";
const THEME_KEY = "@mismari_theme";
const CODE_KEY = "@mismari_subscription_code";
const ONBOARDING_KEY = "@mismari_onboarding_done";
const UDID_KEY = "@mismari_device_udid";
const PHOTO_KEY = "@mismari_profile_photo";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(
    Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, []);

  const [language, setLanguageState] = useState<Language>("ar");
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [subscriptionCode, setSubscriptionCodeState] = useState("");
  const [onboardingDone, setOnboardingDoneState] = useState(false);
  const [deviceUdid, setDeviceUdidState] = useState("");
  const [profilePhoto, setProfilePhotoState] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [appName, setAppName] = useState("مسماري");
  const [appNameEn, setAppNameEn] = useState("Mismari");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [savedLang, savedTheme, savedCode, savedOnboarding, savedUdid, savedPhoto] = await Promise.all([
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(CODE_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(UDID_KEY),
          AsyncStorage.getItem(PHOTO_KEY),
        ]);
        if (savedLang === "ar" || savedLang === "en") setLanguageState(savedLang);
        if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") setThemeModeState(savedTheme);
        if (savedCode) setSubscriptionCodeState(savedCode);
        if (savedOnboarding === "true") setOnboardingDoneState(true);
        if (savedUdid) setDeviceUdidState(savedUdid);
        if (savedPhoto) setProfilePhotoState(savedPhoto);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  /* جلب اسم التطبيق واللوغو من API */
  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
    if (!domain) return;
    fetch(`https://${domain}/api/appearance`)
      .then(r => r.json())
      .then(d => {
        if (d?.appearance_app_name) setAppName(d.appearance_app_name);
        if (d?.appearance_app_name_en) {
          setAppNameEn(d.appearance_app_name_en);
        } else if (d?.appearance_site_name) {
          const enPart = d.appearance_site_name.split("|")[0]?.trim();
          if (enPart) setAppNameEn(enPart);
        }
        if (d?.appearance_logo_url) setLogoUrl(`https://${domain}${d.appearance_logo_url}`);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (subscriptionCode || !deviceUdid) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
    if (!domain) return;
    fetch(`https://${domain}/api/enroll/check?udid=${encodeURIComponent(deviceUdid)}`)
      .then(r => r.json())
      .then(data => {
        if (data.found && data.subscriber?.code) {
          setSubscriptionCodeState(data.subscriber.code);
          AsyncStorage.setItem(CODE_KEY, data.subscriber.code).catch(() => {});
        }
      })
      .catch(() => {});
  }, [loaded, deviceUdid, subscriptionCode]);

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

  const setProfilePhoto = (uri: string) => {
    setProfilePhotoState(uri);
    AsyncStorage.setItem(PHOTO_KEY, uri).catch(() => {});
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
        profilePhoto,
        setProfilePhoto,
        loaded,
        appName,
        appNameEn,
        logoUrl,
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
