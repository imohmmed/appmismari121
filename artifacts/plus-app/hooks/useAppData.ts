import { useState, useEffect, useCallback } from "react";

const getBase = () => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
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
  descAr?: string | null;
  icon: string;
  categoryId: number;
  categoryName: string;
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

    const url = `${base}/apps${params.toString() ? `?${params}` : ""}`;

    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setApps(d?.apps || []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [opts?.categoryId, opts?.section, opts?.search, opts?.limit, opts?.skip]);

  return { apps, loading };
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
