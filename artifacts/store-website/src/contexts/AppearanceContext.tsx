import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const API = import.meta.env.VITE_API_URL || "";

export interface AppearanceSettings {
  appearance_site_name: string;
  appearance_app_name: string;
  appearance_site_description: string;
  appearance_logo_url: string;
  appearance_favicon_url: string;
  appearance_og_image_url: string;
  appearance_font_family: string;
  appearance_font_file_url: string;
  appearance_web_primary: string;
  appearance_web_text: string;
  appearance_web_bg: string;
  appearance_admin_bg: string;
  appearance_admin_text: string;
  appearance_admin_accent: string;
  appearance_app_light_primary: string;
  appearance_app_light_text: string;
  appearance_app_light_bg: string;
  appearance_app_dark_primary: string;
  appearance_app_dark_text: string;
  appearance_app_dark_bg: string;
  appearance_announcement_on: string;
  appearance_announcement_text: string;
  appearance_announcement_color: string;
  appearance_seo_keywords: string;
}

const DEFAULTS: AppearanceSettings = {
  appearance_site_name:          "Mismari | مسماري",
  appearance_app_name:           "مسماري",
  appearance_site_description:   "",
  appearance_logo_url:           "",
  appearance_favicon_url:        "",
  appearance_og_image_url:       "",
  appearance_font_family:        "Tajawal",
  appearance_font_file_url:      "",
  appearance_web_primary:        "#9fbcff",
  appearance_web_text:           "#ffffff",
  appearance_web_bg:             "#2b283b",
  appearance_admin_bg:           "#000000",
  appearance_admin_text:         "#ffffff",
  appearance_admin_accent:       "#9fbcff",
  appearance_app_light_primary:  "#9fbcff",
  appearance_app_light_text:     "#2b283b",
  appearance_app_light_bg:       "#ffffff",
  appearance_app_dark_primary:   "#9fbcff",
  appearance_app_dark_text:      "#ffffff",
  appearance_app_dark_bg:        "#2b283b",
  appearance_announcement_on:    "false",
  appearance_announcement_text:  "",
  appearance_announcement_color: "#9fbcff",
  appearance_seo_keywords:       "",
};

const AppearanceContext = createContext<AppearanceSettings>(DEFAULTS);

const GOOGLE_FONTS: Record<string, string> = {
  Tajawal:          "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap",
  Cairo:            "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap",
  Noto_Sans_Arabic: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700&display=swap",
  Amiri:            "https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&display=swap",
  IBM_Plex_Arabic:  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap",
};

export function applyAppearanceToDom(s: AppearanceSettings) {
  const r = document.documentElement;

  /* CSS variables */
  r.style.setProperty("--ap",  s.appearance_web_primary || "#9fbcff");
  r.style.setProperty("--at",  s.appearance_web_text    || "#ffffff");
  r.style.setProperty("--ab",  s.appearance_web_bg      || "#2b283b");
  r.style.setProperty("--aa",  s.appearance_admin_accent || "#9fbcff");
  r.style.setProperty("--admin-bg",   s.appearance_admin_bg   || "#000000");
  r.style.setProperty("--admin-text", s.appearance_admin_text || "#ffffff");

  /* ─── Title ─── */
  if (s.appearance_site_name) document.title = s.appearance_site_name;

  /* ─── Meta description ─── */
  if (s.appearance_site_description) {
    let meta = document.querySelector<HTMLMetaElement>("meta[name='description']");
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = s.appearance_site_description;
  }

  /* ─── SEO keywords ─── */
  if (s.appearance_seo_keywords) {
    let meta = document.querySelector<HTMLMetaElement>("meta[name='keywords']");
    if (!meta) { meta = document.createElement("meta"); meta.name = "keywords"; document.head.appendChild(meta); }
    meta.content = s.appearance_seo_keywords;
  }

  /* ─── OG tags ─── */
  const setOg = (prop: string, content: string) => {
    if (!content) return;
    let el = document.querySelector<HTMLMetaElement>(`meta[property='${prop}']`);
    if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
    el.content = content;
  };
  setOg("og:title",       s.appearance_site_name);
  setOg("og:description", s.appearance_site_description);
  if (s.appearance_og_image_url) setOg("og:image", `${API}${s.appearance_og_image_url}`);

  /* ─── Favicon ─── */
  if (s.appearance_favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = `${API}${s.appearance_favicon_url}`;
  }

  /* ─── Font ─── */
  const fontFamily = s.appearance_font_family || "Tajawal";
  const fontFileUrl = s.appearance_font_file_url;

  // Remove old injected font links
  document.querySelectorAll("link[data-mismari-font]").forEach(el => el.remove());
  document.querySelectorAll("style[data-mismari-font]").forEach(el => el.remove());

  if (fontFileUrl) {
    // Custom uploaded font
    const style = document.createElement("style");
    style.setAttribute("data-mismari-font", "1");
    style.textContent = `
      @font-face {
        font-family: 'MismariCustomFont';
        src: url('${API}${fontFileUrl}');
        font-display: swap;
      }
      body, * { font-family: 'MismariCustomFont', sans-serif !important; }
    `;
    document.head.appendChild(style);
  } else if (GOOGLE_FONTS[fontFamily]) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS[fontFamily];
    link.setAttribute("data-mismari-font", "1");
    document.head.appendChild(link);

    const cssName = fontFamily.replace(/_/g, " ");
    const style = document.createElement("style");
    style.setAttribute("data-mismari-font", "1");
    style.textContent = `body { font-family: '${cssName}', sans-serif; }`;
    document.head.appendChild(style);
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULTS);

  useEffect(() => {
    fetch(`${API}/api/appearance`)
      .then(r => r.json())
      .then((data: AppearanceSettings) => {
        const merged = { ...DEFAULTS, ...data };
        setSettings(merged);
        applyAppearanceToDom(merged);
      })
      .catch(() => {
        applyAppearanceToDom(DEFAULTS);
      });
  }, []);

  return <AppearanceContext.Provider value={settings}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
