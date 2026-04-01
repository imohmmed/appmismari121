import { useEffect } from "react";

const BASE = "مسماري+";

export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | ${BASE}` : BASE;
    return () => { document.title = prev; };
  }, [title]);
}
