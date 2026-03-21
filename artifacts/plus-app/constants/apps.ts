export type AppItem = {
  id: number;
  name: string;
  descAr: string;
  descEn: string;
  category: string;
  tag: "tweaked" | "modded" | "hacked";
  icon: string;
  isHot?: boolean;
  downloadCount: number;
  dateAdded: string;
  catKey?: string;
};

export const ALL_APPS: AppItem[] = [
  { id: 1, name: "WhatsApp++", descAr: "ميزات مخفية مفعّلة", descEn: "Hidden features unlocked", category: "social", tag: "tweaked", icon: "message-circle", isHot: true, downloadCount: 52000, dateAdded: "2025-06-01", catKey: "social" },
  { id: 2, name: "Snapchat++", descAr: "حفظ السنابات والقصص", descEn: "Save snaps & stories", category: "social", tag: "tweaked", icon: "camera", isHot: true, downloadCount: 41000, dateAdded: "2025-07-10", catKey: "social" },
  { id: 3, name: "Instagram++", descAr: "تحميل القصص والريلز", descEn: "Download stories & reels", category: "social", tag: "tweaked", icon: "instagram", isHot: true, downloadCount: 48000, dateAdded: "2025-05-15", catKey: "social" },
  { id: 4, name: "TikTok++", descAr: "بدون إعلانات، تحميل الفيديو", descEn: "No ads, video download", category: "social", tag: "tweaked", icon: "video", isHot: true, downloadCount: 39000, dateAdded: "2025-08-20", catKey: "social" },
  { id: 5, name: "Telegram++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", category: "social", tag: "tweaked", icon: "send", downloadCount: 22000, dateAdded: "2025-09-05", catKey: "social" },
  { id: 6, name: "Twitter++", descAr: "تحميل الفيديوهات والثريدات", descEn: "Download videos & threads", category: "social", tag: "tweaked", icon: "twitter", downloadCount: 18000, dateAdded: "2025-10-12", catKey: "social" },
  { id: 7, name: "ChatGPT Pro", descAr: "وصول GPT-4 مفعّل", descEn: "GPT-4 access unlocked", category: "ai", tag: "modded", icon: "cpu", isHot: true, downloadCount: 55000, dateAdded: "2025-11-01", catKey: "ai" },
  { id: 8, name: "Copilot+", descAr: "مساعد برمجة بالذكاء الاصطناعي", descEn: "AI coding assistant", category: "ai", tag: "modded", icon: "zap", downloadCount: 12000, dateAdded: "2026-02-15", catKey: "ai" },
  { id: 9, name: "Gemini Pro", descAr: "Google AI بريميوم", descEn: "Google AI Premium", category: "ai", tag: "modded", icon: "star", downloadCount: 15000, dateAdded: "2026-03-01", catKey: "ai" },
  { id: 10, name: "CapCut Pro", descAr: "أدوات تعديل متقدمة", descEn: "Advanced editing tools", category: "edit", tag: "modded", icon: "scissors", isHot: true, downloadCount: 35000, dateAdded: "2026-01-20", catKey: "edit" },
  { id: 11, name: "Canva Pro", descAr: "جميع القوالب مفتوحة", descEn: "All templates unlocked", category: "edit", tag: "modded", icon: "edit", downloadCount: 28000, dateAdded: "2026-02-28", catKey: "edit" },
  { id: 12, name: "Lightroom++", descAr: "فلاتر بريميوم مجانية", descEn: "Free premium filters", category: "edit", tag: "tweaked", icon: "aperture", downloadCount: 16000, dateAdded: "2025-04-10", catKey: "edit" },
  { id: 13, name: "PUBG Hack", descAr: "تصويب تلقائي و ESP", descEn: "Aimbot & ESP", category: "games", tag: "hacked", icon: "crosshair", isHot: true, downloadCount: 45000, dateAdded: "2025-03-01", catKey: "games" },
  { id: 14, name: "Minecraft+", descAr: "جميع السكنات مفتوحة", descEn: "All skins unlocked", category: "games", tag: "hacked", icon: "box", downloadCount: 32000, dateAdded: "2025-06-15", catKey: "games" },
  { id: 15, name: "Roblox Mod", descAr: "روبوكس غير محدود", descEn: "Unlimited Robux", category: "games", tag: "modded", icon: "play", downloadCount: 29000, dateAdded: "2026-03-10", catKey: "games" },
  { id: 16, name: "YouTube Premium", descAr: "بدون إعلانات، تشغيل بالخلفية", descEn: "No ads, background play", category: "tweaked", tag: "tweaked", icon: "youtube", isHot: true, downloadCount: 62000, dateAdded: "2025-01-15", catKey: "tweaked" },
  { id: 17, name: "Spotify++", descAr: "ميزات بريميوم مجانية", descEn: "Free premium features", category: "tweaked", tag: "tweaked", icon: "music", isHot: true, downloadCount: 51000, dateAdded: "2025-02-20", catKey: "tweaked" },
  { id: 18, name: "SoundCloud++", descAr: "تحميل بدون إنترنت", descEn: "Offline download", category: "tweaked", tag: "tweaked", icon: "headphones", downloadCount: 9500, dateAdded: "2025-08-10", catKey: "tweaked" },
  { id: 19, name: "Netflix", descAr: "جميع المحتوى مفتوح", descEn: "All content unlocked", category: "tv", tag: "modded", icon: "film", isHot: true, downloadCount: 58000, dateAdded: "2025-01-01", catKey: "tv" },
  { id: 20, name: "Disney+", descAr: "ديزني و مارفل مباشر", descEn: "Disney & Marvel streaming", category: "tv", tag: "modded", icon: "play-circle", downloadCount: 33000, dateAdded: "2025-05-20", catKey: "tv" },
  { id: 21, name: "Shahid VIP", descAr: "محتوى عربي بريميوم", descEn: "Premium Arabic content", category: "tv", tag: "tweaked", icon: "tv", downloadCount: 21000, dateAdded: "2026-03-15", catKey: "tv" },
  { id: 22, name: "Xcode Helper", descAr: "أدوات تطوير iOS", descEn: "iOS dev tools", category: "develop", tag: "modded", icon: "terminal", downloadCount: 7500, dateAdded: "2025-07-01", catKey: "develop" },
  { id: 23, name: "iSH Shell", descAr: "طرفية لينكس على iOS", descEn: "Linux terminal on iOS", category: "develop", tag: "tweaked", icon: "code", downloadCount: 6800, dateAdded: "2026-03-18", catKey: "develop" },
  { id: 24, name: "Pythonista+", descAr: "بايثون IDE بريميوم", descEn: "Premium Python IDE", category: "develop", tag: "modded", icon: "file-text", downloadCount: 5200, dateAdded: "2025-09-15", catKey: "develop" },
];
