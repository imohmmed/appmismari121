import { useState, useEffect, useCallback } from "react";

const getBase = () => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
  return domain ? `https://${domain}/api` : "";
};

export interface ApiCategory {
  id: number;
  name: string;
  nameAr: string | null;
  icon: string | null;
  appCount: number;
}

export interface ApiApp {
  id: number;
  name: string;
  description: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  descAr?: string | null;
  descEn?: string | null;
  icon: string;
  categoryId: number;
  categoryName: string;
  categoryNameAr?: string | null;
  tag: string;
  version: string | null;
  size: string | null;
  downloads: number;
  isFeatured: boolean;
  isHot: boolean;
  createdAt: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    const base = getBase();
    if (!base) { setLoading(false); return; }
    try {
      const res = await fetch(`${base}/categories`);
      const data = await res.json();
      setCategories(data?.categories || []);
    } catch { /* silently fail */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { categories, loading, refetch: fetch_ };
}

export function useApps(opts?: {
  categoryId?: number;
  section?: "trending" | "most_downloaded" | "latest";
  search?: string;
  limit?: number;
  skip?: boolean;
  code?: string;
}) {
  const [apps, setApps] = useState<ApiApp[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opts?.skip) { setApps([]); setLoading(false); return; }

    const base = getBase();
    if (!base) { setLoading(false); return; }

    const params = new URLSearchParams();
    if (opts?.categoryId) params.set("categoryId", String(opts.categoryId));
    if (opts?.section)    params.set("section", opts.section);
    if (opts?.search)     params.set("search", opts.search);
    if (opts?.limit)      params.set("limit", String(opts.limit));
    if (opts?.code)       params.set("code", opts.code);

    const url = `${base}/apps${params.toString() ? `?${params}` : ""}`;

    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setApps(d?.apps || []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [opts?.categoryId, opts?.section, opts?.search, opts?.limit, opts?.skip, opts?.code]);

  return { apps, loading };
}

export interface ApiBanner {
  id: number;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  image: string | null;
  imageEn: string | null;
  link: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function useBanners() {
  const [banners, setBanners] = useState<ApiBanner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    const base = getBase();
    if (!base) { setLoading(false); return; }
    try {
      const res = await fetch(`${base}/banners`);
      const data = await res.json();
      setBanners(data?.banners || []);
    } catch { /* silently fail */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { banners, loading, refetch: fetch_ };
}

// Fallback icon name when app icon isn't a valid Feather icon
export const FALLBACK_ICON = "box";

// Map category icon (emoji or feather) to a color for display
const CAT_COLORS: Record<string, string> = {
  "1": "#007AFF", "2": "#AF52DE", "3": "#FF9500",
  "4": "#34C759", "5": "#5AC8FA", "6": "#FF3B30",
  "7": "#FF9500", "8": "#8E8E93",
};

export function getCategoryColor(id: number): string {
  return CAT_COLORS[String(id)] || "#9fbcff";
}

// Map tag to color
export function getTagColor(tag: string): string {
  const map: Record<string, string> = {
    tweaked: "#007AFF",
    modded:  "#AF52DE",
    hacked:  "#FF3B30",
    plus:    "#34C759",
  };
  return map[tag] || "#9fbcff";
}
