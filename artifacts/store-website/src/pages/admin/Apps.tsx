import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAdminListApps, useAdminCreateApp, useAdminUpdateApp, useAdminDeleteApp, useAdminListCategories, getAdminListAppsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, X, Upload, Link2, MoreVertical,
  Copy, Edit2, EyeOff, FlaskConical, Trash2, CheckSquare, Square,
  Loader2, AlertCircle, CheckCircle2, RefreshCw, FileArchive, Globe, Bell,
  Flame, ArrowUpCircle, Languages, GitFork, AlertTriangle, PackageCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { App } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const VITE_API = import.meta.env.VITE_API_URL || "";
const ACCENT = "#9fbcff";

async function callApi(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${VITE_API}/api${path}`, {
    ...opts,
    headers: { ...(opts?.headers || {}), "x-admin-token": token },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "خطأ غير معروف");
  return json;
}

async function translateText(text: string, from: string, to: string): Promise<string> {
  const result = await callApi("/admin/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, from, to }),
  });
  return result.translated || "";
}

const TAGS = [
  { value: "tweaked", label: "Tweaked", color: "text-blue-400 bg-blue-500/10" },
  { value: "modded", label: "Modded", color: "text-purple-400 bg-purple-500/10" },
  { value: "hacked", label: "Hacked", color: "text-red-400 bg-red-500/10" },
  { value: "new", label: "New", color: "text-green-400 bg-green-500/10" },
  { value: "hot", label: "Hot", color: "text-orange-400 bg-orange-500/10" },
];

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: `${ACCENT}99` }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn("w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20", props.className)}
    />
  );
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn("w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20 resize-none", props.className)}
    />
  );
}

function Select({ ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none appearance-none"
    />
  );
}

interface DescriptionFieldsProps {
  ar: string;
  en: string;
  onArChange: (v: string) => void;
  onEnChange: (v: string) => void;
}

function DescriptionFields({ ar, en, onArChange, onEnChange }: DescriptionFieldsProps) {
  const [translatingAr, setTranslatingAr] = useState(false);
  const [translatingEn, setTranslatingEn] = useState(false);
  const { toast } = useToast();

  const handleTranslateToEn = async () => {
    if (!ar.trim()) return;
    setTranslatingAr(true);
    try {
      const translated = await translateText(ar, "ar", "en");
      onEnChange(translated);
    } catch { toast({ title: "فشل الترجمة", variant: "destructive" }); }
    setTranslatingAr(false);
  };

  const handleTranslateToAr = async () => {
    if (!en.trim()) return;
    setTranslatingEn(true);
    try {
      const translated = await translateText(en, "en", "ar");
      onArChange(translated);
    } catch { toast({ title: "فشل الترجمة", variant: "destructive" }); }
    setTranslatingEn(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium" style={{ color: `${ACCENT}99` }}>الوصف بالعربي</label>
          <button
            type="button"
            onClick={handleTranslateToEn}
            disabled={translatingAr || !ar.trim()}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"
          >
            {translatingAr ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Languages className="w-2.5 h-2.5" />}
            ترجمة للإنجليزي
          </button>
        </div>
        <Textarea value={ar} onChange={e => onArChange(e.target.value)} placeholder="وصف التطبيق بالعربي..." rows={3} dir="rtl" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium" style={{ color: `${ACCENT}99` }}>الوصف بالإنجليزي</label>
          <button
            type="button"
            onClick={handleTranslateToAr}
            disabled={translatingEn || !en.trim()}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"
          >
            {translatingEn ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Languages className="w-2.5 h-2.5" />}
            ترجمة للعربي
          </button>
        </div>
        <Textarea value={en} onChange={e => onEnChange(e.target.value)} placeholder="App description in English..." rows={3} dir="ltr" />
      </div>
    </div>
  );
}

interface UploadResult {
  name: string;
  bundleId: string;
  version: string;
  icon: string | null;
  size: string;
  minOsVersion: string | null;
  downloadUrl: string;
  ipaPath: string;
  iconPath: string | null;
}

function IpaImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: catData } = useAdminListCategories();
  const categories = catData?.categories || [];
  const createMutation = useAdminCreateApp();
  const { toast } = useToast();

  const [step, setStep] = useState<"source" | "uploading" | "form">("source");
  const [sourceMode, setSourceMode] = useState<"url" | "file">("file");
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState("");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", bundleId: "", version: "", size: "", icon: "", iconPath: "" as string | null,
    descriptionAr: "", descriptionEn: "",
    downloadUrl: "", ipaPath: "",
    categoryId: 1, tag: "tweaked" as any,
    isHot: false, notify: false,
  });

  const applyResult = (r: UploadResult) => {
    setUploadResult(r);
    setForm(f => ({
      ...f,
      name: r.name || f.name,
      bundleId: r.bundleId || f.bundleId,
      version: r.version || f.version,
      size: r.size || f.size,
      icon: r.icon || f.icon,
      iconPath: r.iconPath ?? f.iconPath,
      downloadUrl: r.downloadUrl || f.downloadUrl,
      ipaPath: r.ipaPath || f.ipaPath,
    }));
    setStep("form");
  };

  const handleUploadFile = async (file: File) => {
    setStep("uploading");
    setError("");
    setUploadProgress("جاري رفع الملف وحفظه على السيرفر...");
    const token = localStorage.getItem("adminToken") || "";
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${VITE_API}/api/admin/ipa/upload-file`, {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل الرفع");
      applyResult(json);
    } catch (err: any) {
      setError(err.message || "فشل رفع الملف");
      setStep("source");
    }
  };

  const handleSaveFromUrl = async () => {
    if (!urlInput.trim()) return;
    setStep("uploading");
    setError("");
    setUploadProgress("جاري تحميل الملف من الرابط وحفظه على السيرفر...");
    try {
      const result = await callApi("/admin/ipa/save-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      applyResult(result);
    } catch (err: any) {
      setError(err.message || "فشل تحميل الملف من الرابط");
      setStep("source");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name,
          description: form.descriptionAr || form.descriptionEn || undefined,
          descriptionAr: form.descriptionAr || undefined,
          descriptionEn: form.descriptionEn || undefined,
          icon: form.icon || `https://ui-avatars.com/api/?name=${form.name}&background=111111&color=9fbcff`,
          ipaPath: form.ipaPath || undefined,
          iconPath: form.iconPath || undefined,
          categoryId: form.categoryId,
          tag: form.tag,
          version: form.version || undefined,
          size: form.size || undefined,
          bundleId: form.bundleId || undefined,
          downloadUrl: form.downloadUrl || undefined,
          isHot: form.isHot,
        },
      });
      toast({ title: "تمت إضافة التطبيق بنجاح" });
      onDone();
    } catch {
      toast({ title: "حدث خطأ أثناء الإضافة", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">
              {step === "form" ? "إضافة تطبيق" : "رفع ملف IPA"}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: `${ACCENT}70` }}>
              {step === "source" && "اختر مصدر الملف — يُحفظ مباشرة على السيرفر"}
              {step === "uploading" && uploadProgress}
              {step === "form" && "أكمل بيانات التطبيق"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === "source" && (
            <div className="p-5 space-y-5">
              <div className="flex rounded-xl border border-white/10 overflow-hidden">
                {(["file", "url"] as const).map(m => (
                  <button key={m} onClick={() => setSourceMode(m)}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all", sourceMode === m ? "" : "text-white/30 hover:text-white/60")}
                    style={sourceMode === m ? { background: `${ACCENT}15`, color: ACCENT } : {}}>
                    {m === "file" ? <><FileArchive className="w-4 h-4" /> رفع ملف</> : <><Globe className="w-4 h-4" /> عبر رابط</>}
                  </button>
                ))}
              </div>

              {sourceMode === "file" ? (
                <div className="space-y-3">
                  <input ref={fileInputRef} type="file" accept=".ipa" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/10 rounded-xl p-10 text-center hover:border-white/20 transition-colors">
                    <FileArchive className="w-8 h-8 mx-auto mb-3" style={{ color: ACCENT }} />
                    <p className="text-sm font-medium text-white">اسحب ملف IPA هنا أو اضغط للاختيار</p>
                    <p className="text-xs text-white/30 mt-1">يُرفع ويُحفظ مباشرة على سيرفرك</p>
                  </button>
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <FieldGroup label="رابط ملف IPA الخارجي">
                    <Input dir="ltr" placeholder="https://example.com/app.ipa" value={urlInput}
                      onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveFromUrl()} />
                  </FieldGroup>
                  <p className="text-xs text-white/30">سيتم تحميل الملف وحفظه مباشرة على سيرفرك</p>
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  <button onClick={handleSaveFromUrl} disabled={!urlInput.trim()}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-40"
                    style={{ background: ACCENT }}>
                    تحميل وحفظ على السيرفر
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "uploading" && (
            <div className="p-16 flex flex-col items-center gap-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: ACCENT }} />
              <div>
                <p className="text-white font-medium">{uploadProgress}</p>
                <p className="text-white/30 text-xs mt-1">يتم استخراج الاسم والأيقونة وحفظها تلقائياً...</p>
              </div>
            </div>
          )}

          {step === "form" && (
            <form id="app-form" onSubmit={handleSubmit} className="p-5 space-y-4">
              {uploadResult && (
                <div className="flex items-center gap-4 p-3 rounded-xl border border-white/10 bg-white/3">
                  {uploadResult.icon ? (
                    <img src={uploadResult.icon} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <FileArchive className="w-6 h-6 text-white/30" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">{uploadResult.name || "—"}</p>
                    <p className="text-xs text-white/40 mt-0.5 font-mono truncate">{uploadResult.bundleId}</p>
                    <div className="flex gap-3 mt-1">
                      {uploadResult.version && <span className="text-xs" style={{ color: ACCENT }}>v{uploadResult.version}</span>}
                      {uploadResult.size && <span className="text-xs text-white/30">{uploadResult.size}</span>}
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                </div>
              )}

              {uploadResult?.downloadUrl && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-white/8 bg-white/3">
                  <span className="text-xs text-white/30 shrink-0">رابط السيرفر:</span>
                  <span className="text-xs font-mono text-green-400/80 truncate flex-1" dir="ltr">{uploadResult.downloadUrl}</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(uploadResult.downloadUrl); }}
                    className="text-white/30 hover:text-white shrink-0"><Copy className="w-3 h-3" /></button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <FieldGroup label="اسم التطبيق *">
                    <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="اسم التطبيق" />
                  </FieldGroup>
                </div>
                <FieldGroup label="Bundle ID">
                  <Input dir="ltr" value={form.bundleId} onChange={e => setForm({ ...form, bundleId: e.target.value })} placeholder="com.example.app" />
                </FieldGroup>
                <FieldGroup label="الإصدار">
                  <Input dir="ltr" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" />
                </FieldGroup>
                <FieldGroup label="التصنيف">
                  <Select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: Number(e.target.value) })}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    {categories.length === 0 && <option value={1}>تطبيقات بلس</option>}
                  </Select>
                </FieldGroup>
                <FieldGroup label="النوع">
                  <Select value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value as any })}>
                    {TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </FieldGroup>

                <div className="col-span-2">
                  <DescriptionFields
                    ar={form.descriptionAr}
                    en={form.descriptionEn}
                    onArChange={v => setForm({ ...form, descriptionAr: v })}
                    onEnChange={v => setForm({ ...form, descriptionEn: v })}
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <button type="button" onClick={() => setForm(f => ({ ...f, isHot: !f.isHot }))}
                    className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all", form.isHot ? "border-current" : "border-white/5 text-white/30")}
                    style={form.isHot ? { background: `rgba(249,115,22,0.1)`, borderColor: `rgba(249,115,22,0.3)`, color: `#f97316` } : {}}>
                    <Flame className="w-3.5 h-3.5" /> الأكثر رواجاً
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, notify: !f.notify }))}
                    className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all", form.notify ? "border-current" : "border-white/5 text-white/30")}
                    style={form.notify ? { background: `${ACCENT}10`, borderColor: `${ACCENT}30`, color: ACCENT } : {}}>
                    <Bell className="w-3.5 h-3.5" /> إشعار المستخدمين
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {step === "form" && (
          <div className="border-t border-white/5 p-4 flex items-center justify-between shrink-0">
            <button type="button" onClick={() => setStep("source")} className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> تغيير الملف
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm transition-colors">إلغاء</button>
              <button form="app-form" type="submit" disabled={createMutation.isPending} className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5" style={{ background: ACCENT }}>
                {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                إضافة التطبيق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditAppModal({ app, onClose }: { app: App; onClose: () => void }) {
  const { data: catData } = useAdminListCategories();
  const categories = catData?.categories || [];
  const updateMutation = useAdminUpdateApp();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: app.name || "",
    bundleId: app.bundleId || "",
    version: app.version || "",
    size: app.size || "",
    icon: app.icon || "",
    descriptionAr: app.descriptionAr || "",
    descriptionEn: app.descriptionEn || "",
    downloadUrl: app.downloadUrl || "",
    ipaPath: app.ipaPath || "",
    iconPath: app.iconPath || "",
    categoryId: app.categoryId || 1,
    tag: app.tag || "tweaked",
    isFeatured: app.isFeatured || false,
    isHot: app.isHot || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        id: app.id,
        data: {
          name: form.name,
          description: form.descriptionAr || form.descriptionEn || undefined,
          descriptionAr: form.descriptionAr || undefined,
          descriptionEn: form.descriptionEn || undefined,
          icon: form.icon,
          ipaPath: form.ipaPath || undefined,
          iconPath: form.iconPath || undefined,
          categoryId: form.categoryId,
          tag: form.tag as any,
          version: form.version || undefined,
          size: form.size || undefined,
          bundleId: form.bundleId || undefined,
          downloadUrl: form.downloadUrl || undefined,
          isFeatured: form.isFeatured,
          isHot: form.isHot,
        },
      });
      queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
      toast({ title: "تم تحديث التطبيق بنجاح" });
      onClose();
    } catch {
      toast({ title: "حدث خطأ أثناء التحديث", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <img src={app.icon} alt={app.name} className="w-10 h-10 rounded-xl object-cover bg-white/5"
              onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${app.name}&background=111111&color=9fbcff`; }} />
            <div>
              <h3 className="text-sm font-bold text-white">تعديل التطبيق</h3>
              <p className="text-xs mt-0.5 font-mono" style={{ color: `${ACCENT}70` }}>{app.bundleId || app.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <form id="edit-form" onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <FieldGroup label="اسم التطبيق *">
                  <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="اسم التطبيق" />
                </FieldGroup>
              </div>
              <FieldGroup label="Bundle ID">
                <Input dir="ltr" value={form.bundleId} onChange={e => setForm({ ...form, bundleId: e.target.value })} placeholder="com.example.app" />
              </FieldGroup>
              <FieldGroup label="الإصدار">
                <Input dir="ltr" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" />
              </FieldGroup>
              <FieldGroup label="التصنيف">
                <Select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: Number(e.target.value) })}>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FieldGroup>
              <FieldGroup label="النوع">
                <Select value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value as any })}>
                  {TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </FieldGroup>
              <FieldGroup label="الحجم">
                <Input dir="ltr" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="MB 120" />
              </FieldGroup>
              <div className="col-span-2">
                <FieldGroup label="رابط التحميل (IPA) على السيرفر">
                  <Input dir="ltr" value={form.downloadUrl} onChange={e => setForm({ ...form, downloadUrl: e.target.value })} placeholder="https://domain/admin/FilesIPA/IpaApp/..." />
                </FieldGroup>
              </div>
              <div className="col-span-2">
                <FieldGroup label="رابط الأيقونة">
                  <div className="flex gap-2">
                    {form.icon && <img src={form.icon} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    <Input dir="ltr" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="رابط الأيقونة" className="flex-1" />
                  </div>
                </FieldGroup>
              </div>
              <div className="col-span-2">
                <DescriptionFields
                  ar={form.descriptionAr}
                  en={form.descriptionEn}
                  onArChange={v => setForm({ ...form, descriptionAr: v })}
                  onEnChange={v => setForm({ ...form, descriptionEn: v })}
                />
              </div>
              <div className="col-span-2 flex items-center gap-2 pt-1">
                <button type="button" onClick={() => setForm(f => ({ ...f, isHot: !f.isHot }))}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all", form.isHot ? "border-current" : "border-white/5 text-white/30")}
                  style={form.isHot ? { background: `rgba(249,115,22,0.1)`, borderColor: `rgba(249,115,22,0.3)`, color: `#f97316` } : {}}>
                  <Flame className="w-3.5 h-3.5" /> الأكثر رواجاً
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="border-t border-white/5 p-4 flex items-center justify-between shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm transition-colors">إلغاء</button>
          <button form="edit-form" type="submit" disabled={updateMutation.isPending} className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5" style={{ background: ACCENT }}>
            {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            حفظ التغييرات
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateAppModal({ app, onClose, onDone }: { app: App; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const updateMutation = useAdminUpdateApp();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"select" | "uploading" | "done">("select");
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyUpdate = async (r: UploadResult) => {
    setResult(r);
    try {
      await updateMutation.mutateAsync({
        id: app.id,
        data: {
          name: app.name,
          icon: r.icon || app.icon,
          ipaPath: r.ipaPath || undefined,
          iconPath: r.iconPath || undefined,
          categoryId: app.categoryId,
          tag: app.tag,
          version: r.version || app.version || undefined,
          size: r.size || app.size || undefined,
          bundleId: r.bundleId || app.bundleId || undefined,
          downloadUrl: r.downloadUrl,
        },
      });
      queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
      setStep("done");
      toast({ title: "تم تحديث التطبيق بنجاح" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
      setStep("select");
    }
  };

  const handleUploadFile = async (file: File) => {
    setStep("uploading");
    setError("");
    const token = localStorage.getItem("adminToken") || "";
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${VITE_API}/api/admin/ipa/upload-file`, {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل الرفع");
      await applyUpdate(json);
    } catch (err: any) {
      setError(err.message || "فشل رفع الملف");
      setStep("select");
    }
  };

  const handleSaveFromUrl = async () => {
    if (!urlInput.trim()) return;
    setStep("uploading");
    setError("");
    try {
      const r = await callApi("/admin/ipa/save-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      await applyUpdate(r);
    } catch (err: any) {
      setError(err.message || "فشل تحميل الملف");
      setStep("select");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h3 className="text-sm font-bold text-white">تحديث التطبيق</h3>
            <p className="text-xs mt-0.5 text-white/30">{app.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5">
          {step === "select" && (
            <div className="space-y-4">
              <div className="flex rounded-xl border border-white/10 overflow-hidden">
                {(["file", "url"] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all", mode === m ? "" : "text-white/30")}
                    style={mode === m ? { background: `${ACCENT}15`, color: ACCENT } : {}}>
                    {m === "file" ? <><Upload className="w-3.5 h-3.5" /> رفع ملف</> : <><Globe className="w-3.5 h-3.5" /> عبر رابط</>}
                  </button>
                ))}
              </div>

              {mode === "file" ? (
                <div className="space-y-3">
                  <input ref={fileInputRef} type="file" accept=".ipa" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-white/20 transition-colors">
                    <Upload className="w-7 h-7 mx-auto mb-2" style={{ color: ACCENT }} />
                    <p className="text-sm text-white">اختر ملف IPA المُحدَّث</p>
                    <p className="text-xs text-white/30 mt-1">يُرفع ويستبدل الرابط القديم</p>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input dir="ltr" placeholder="https://example.com/app-new.ipa" value={urlInput}
                    onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveFromUrl()} />
                  <button onClick={handleSaveFromUrl} disabled={!urlInput.trim()}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-40"
                    style={{ background: ACCENT }}>
                    تحميل وتحديث السيرفر
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === "uploading" && (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-9 h-9 animate-spin" style={{ color: ACCENT }} />
              <p className="text-white text-sm font-medium">جاري الرفع والتحديث...</p>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium">تم التحديث بنجاح!</p>
                  <p className="text-xs text-white/40 mt-0.5">{result.version && `الإصدار الجديد: ${result.version}`}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/3 border border-white/8">
                <p className="text-xs text-white/30 mb-1">رابط السيرفر الجديد:</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono text-green-400/80 truncate flex-1" dir="ltr">{result.downloadUrl}</p>
                  <button onClick={() => navigator.clipboard.writeText(result!.downloadUrl)} className="text-white/30 hover:text-white shrink-0">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <button onClick={onClose} className="w-full py-2 rounded-xl text-sm font-bold text-black" style={{ background: ACCENT }}>
                إغلاق
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clone Modal ─────────────────────────────────────────────────────────────
type CloneStage = "idle" | "unzip" | "patch" | "save" | "done" | "error";

const CLONE_STAGES: { id: CloneStage; label: string }[] = [
  { id: "unzip", label: "فتح ملف IPA وقراءة المحتوى..." },
  { id: "patch", label: "تعديل معرّف الحزمة والاسم..." },
  { id: "save", label: "حفظ النسخة الجديدة في السيرفر..." },
  { id: "done", label: "اكتمل التكرار بنجاح!" },
];

function CloneModal({ app, onClose, onDone }: { app: App; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(`${app.name} 2`);
  const [stage, setStage] = useState<CloneStage>("idle");
  const [error, setError] = useState("");
  const [newBundleId, setNewBundleId] = useState("");

  const handleClone = async () => {
    if (!name.trim()) return;
    setError("");
    setStage("unzip");

    const token = localStorage.getItem("adminToken") || "";
    const api = import.meta.env.VITE_API_URL || "";

    await new Promise(r => setTimeout(r, 700));
    setStage("patch");
    await new Promise(r => setTimeout(r, 600));
    setStage("save");

    try {
      const res = await fetch(`${api}/api/admin/apps/${app.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل التكرار");
      setNewBundleId(json.newBundleId || "");
      setStage("done");
      onDone();
    } catch (err: any) {
      setError(err.message || "فشل التكرار");
      setStage("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 overflow-hidden" style={{ background: "#0a0a0a" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="font-bold text-white text-sm">تكرار التطبيق</span>
          </div>
          <button onClick={onClose} disabled={stage !== "idle" && stage !== "done" && stage !== "error"}
            className="text-white/30 hover:text-white disabled:opacity-20">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Original app info */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/5" style={{ background: "#111" }}>
            {app.icon && <img src={app.icon} className="w-10 h-10 rounded-xl object-cover" />}
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{app.name}</p>
              <p className="text-white/30 text-xs font-mono truncate">{app.bundleId || "—"}</p>
            </div>
          </div>

          {/* Warning note */}
          <div className="flex gap-2 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-yellow-300/80 text-xs leading-relaxed">
              التكرار قد لا يدعم ميزات معينة مثل <strong>الإشعارات</strong> وبعض روابط التطبيق العميقة في بعض التطبيقات.
            </p>
          </div>

          {stage === "idle" || stage === "error" ? (
            <>
              {/* Name input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${ACCENT}99` }}>
                  اسم النسخة الجديدة
                </label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: واتساب 2"
                  dir="rtl"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleClone()}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:border-white/20 hover:text-white transition-colors">
                  إلغاء
                </button>
                <button onClick={handleClone} disabled={!name.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: ACCENT }}>
                  <GitFork className="w-4 h-4" /> تثبيت
                </button>
              </div>
            </>
          ) : stage === "done" ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <PackageCheck className="w-12 h-12 mx-auto mb-3" style={{ color: ACCENT }} />
                <p className="text-white font-bold">تم إنشاء النسخة بنجاح!</p>
                <p className="text-white/40 text-xs mt-1">اسم التطبيق: <span className="text-white/70">{name}</span></p>
                {newBundleId && (
                  <p className="text-white/30 text-xs mt-0.5 font-mono">{newBundleId}</p>
                )}
              </div>
              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-black"
                style={{ background: ACCENT }}>
                إغلاق
              </button>
            </div>
          ) : (
            /* Progress stages */
            <div className="space-y-3 py-2">
              {CLONE_STAGES.slice(0, 3).map((s, i) => {
                const currentIdx = CLONE_STAGES.findIndex(x => x.id === stage);
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={s.id} className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all border",
                    done ? "border-green-500/20 bg-green-500/5" :
                    active ? "border-white/20 bg-white/5" :
                    "border-white/5 opacity-30"
                  )}>
                    <div className="shrink-0">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : active ? (
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT }} />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/20" />
                      )}
                    </div>
                    <span className={cn("text-sm", done ? "text-green-300" : active ? "text-white" : "text-white/30")}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminApps() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListApps({ page: 1, limit: 100 });
  const apps = data?.apps || [];
  const { data: catData } = useAdminListCategories();
  const categories = catData?.categories || [];

  const updateMutation = useAdminUpdateApp();
  const deleteMutation = useAdminDeleteApp();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [modal, setModal] = useState<"import" | null>(null);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [updatingApp, setUpdatingApp] = useState<App | null>(null);
  const [cloningApp, setCloningApp] = useState<App | null>(null);

  const filteredApps = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.toLowerCase();
    return apps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.bundleId || "").toLowerCase().includes(q) ||
      (a.categoryName || "").toLowerCase().includes(q)
    );
  }, [apps, search]);

  const allFilteredSelected = filteredApps.length > 0 && filteredApps.every(a => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredApps.map(a => a.id)));
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleDelete = async (id: number) => {
    const app = apps.find(a => a.id === id);
    if (!confirm(`هل أنت متأكد من حذف "${app?.name}"؟ سيتم حذف الملفات من السيرفر أيضاً.`)) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
      toast({ title: "تم الحذف بنجاح" });
    } catch { toast({ title: "حدث خطأ", variant: "destructive" }); }
    setMenuOpenId(null);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} تطبيق؟ سيتم حذف الملفات من السيرفر.`)) return;
    for (const id of selectedIds) { try { await deleteMutation.mutateAsync({ id }); } catch {} }
    queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
    setSelectedIds(new Set());
    toast({ title: `تم حذف ${selectedIds.size} تطبيق` });
  };

  const copyLink = (app: App) => {
    const url = app.downloadUrl || "";
    if (!url) { toast({ title: "لا يوجد رابط محفوظ", variant: "destructive" }); return; }
    navigator.clipboard.writeText(url);
    toast({ title: "تم نسخ الرابط", description: url.length > 60 ? url.slice(0, 60) + "..." : url });
    setMenuOpenId(null);
  };

  const tagBadge = (tag: string) => {
    const t = TAGS.find(x => x.value === tag);
    return t ? <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium", t.color)}>{t.label}</span> : null;
  };

  const statusBadge = (app: App) => {
    if (app.isHot) return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-orange-500/10 text-orange-400">رائج</span>;
    if (app.isHidden) return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-yellow-500/10 text-yellow-400">مخفي</span>;
    if (app.isTestMode) return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-400">تجريبي</span>;
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-green-500/10 text-green-400">نشط</span>;
  };

  return (
    <AdminLayout>
      {modal === "import" && <IpaImportModal onClose={() => setModal(null)} onDone={() => { setModal(null); queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() }); }} />}
      {editingApp && <EditAppModal app={editingApp} onClose={() => setEditingApp(null)} />}
      {updatingApp && <UpdateAppModal app={updatingApp} onClose={() => setUpdatingApp(null)} onDone={() => { setUpdatingApp(null); queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() }); }} />}
      {cloningApp && <CloneModal app={cloningApp} onClose={() => setCloningApp(null)} onDone={() => { queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() }); }} />}

      <div className="space-y-4" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">قائمة التطبيقات</h2>
            <p className="text-xs text-white/30 mt-0.5">{filteredApps.length} تطبيق</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setModal("import")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-black" style={{ background: ACCENT }}>
              <Plus className="w-3.5 h-3.5" /> إضافة تطبيق
            </button>
          </div>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input type="text" placeholder="ابحث عن تطبيق..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2 pr-3 pl-9 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-2.5" style={{ background: `${ACCENT}08` }}>
            <span className="text-sm font-medium" style={{ color: ACCENT }}>{selectedIds.size} محدد</span>
            <div className="flex-1" />
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20">
              <Trash2 className="w-3 h-3" /> حذف
            </button>
            <button onClick={async () => {
              for (const id of selectedIds) {
                const app = apps.find(a => a.id === id);
                if (app) await updateMutation.mutateAsync({ id, data: { name: app.name, icon: app.icon, categoryId: app.categoryId, tag: app.tag, isHidden: true } });
              }
              queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
              setSelectedIds(new Set());
            }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20">
              <EyeOff className="w-3 h-3" /> إخفاء
            </button>
          </div>
        )}

        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[640px]">
              <thead className="border-b border-white/5">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-white/25 hover:text-white">
                      {allFilteredSelected ? <CheckSquare className="w-4 h-4" style={{ color: ACCENT }} /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-white/30">الاسم</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/30">الإصدار</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/30 hidden sm:table-cell">Bundle ID</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/30 hidden md:table-cell">الحجم</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/30">الحالة</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/30 hidden lg:table-cell">الفئة</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="p-12 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: ACCENT }} />
                  </td></tr>
                ) : filteredApps.length === 0 ? (
                  <tr><td colSpan={8} className="p-12 text-center text-white/25 text-sm">لا توجد تطبيقات</td></tr>
                ) : (
                  filteredApps.map(app => (
                    <tr key={app.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(app.id)} className="text-white/25 hover:text-white">
                          {selectedIds.has(app.id) ? <CheckSquare className="w-4 h-4" style={{ color: ACCENT }} /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={app.icon} alt={app.name} className="w-8 h-8 rounded-lg object-cover bg-white/5 shrink-0"
                            onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${app.name}&background=111111&color=9fbcff&bold=true`; }} />
                          <div className="min-w-0">
                            <span className="text-white font-medium text-sm truncate block max-w-[130px]">{app.name}</span>
                            {tagBadge(app.tag)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs">{app.version || "—"}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-white/30 text-xs font-mono">{app.bundleId || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-white/30 text-xs hidden md:table-cell">{app.size || "—"}</td>
                      <td className="px-4 py-3">{statusBadge(app)}</td>
                      <td className="px-4 py-3 text-white/30 text-xs hidden lg:table-cell">{app.categoryName}</td>
                      <td className="px-4 py-3 relative">
                        <button onClick={() => setMenuOpenId(menuOpenId === app.id ? null : app.id)}
                          className="p-1 rounded text-white/20 hover:text-white hover:bg-white/5">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpenId === app.id && (
                          <div className="absolute left-0 top-full mt-1 w-48 bg-[#111111] border border-white/10 rounded-xl shadow-2xl z-50 py-1 text-right overflow-hidden">
                            <button onClick={() => copyLink(app)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5">
                              <Copy className="w-3.5 h-3.5" /> نسخ رابط السيرفر
                            </button>
                            <button onClick={() => { setEditingApp(app); setMenuOpenId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5">
                              <Edit2 className="w-3.5 h-3.5" /> تعديل
                            </button>
                            <button onClick={() => { setCloningApp(app); setMenuOpenId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5" style={{ color: "#a78bfa" }}>
                              <GitFork className="w-3.5 h-3.5" /> تكرار
                            </button>
                            <button onClick={() => { setUpdatingApp(app); setMenuOpenId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5" style={{ color: ACCENT }}>
                              <ArrowUpCircle className="w-3.5 h-3.5" /> تحديث (رفع نسخة جديدة)
                            </button>
                            <button
                              onClick={async () => {
                                await updateMutation.mutateAsync({ id: app.id, data: { name: app.name, icon: app.icon, categoryId: app.categoryId, tag: app.tag, isHidden: !app.isHidden } });
                                queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
                                setMenuOpenId(null);
                                toast({ title: app.isHidden ? "تم إظهار التطبيق" : "تم إخفاء التطبيق" });
                              }}
                              className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5", app.isHidden ? "text-green-400" : "text-yellow-400")}>
                              <EyeOff className="w-3.5 h-3.5" /> {app.isHidden ? "إظهار" : "إخفاء"}
                            </button>
                            <button
                              onClick={async () => {
                                await updateMutation.mutateAsync({ id: app.id, data: { name: app.name, icon: app.icon, categoryId: app.categoryId, tag: app.tag, isHot: !app.isHot } });
                                queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
                                setMenuOpenId(null);
                                toast({ title: app.isHot ? "تم إلغاء الرواج" : "تم تمييز كـ رائج" });
                              }}
                              className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5", app.isHot ? "text-green-400" : "text-orange-400")}>
                              <Flame className="w-3.5 h-3.5" /> {app.isHot ? "إلغاء الرواج" : "تمييز كـ رائج"}
                            </button>
                            <button
                              onClick={async () => {
                                await updateMutation.mutateAsync({ id: app.id, data: { name: app.name, icon: app.icon, categoryId: app.categoryId, tag: app.tag, isTestMode: !app.isTestMode } });
                                queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
                                setMenuOpenId(null);
                                toast({ title: app.isTestMode ? "تم إلغاء وضع التجربة" : "تم تفعيل وضع التجربة" });
                              }}
                              className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5", app.isTestMode ? "text-green-400" : "text-purple-400")}>
                              <FlaskConical className="w-3.5 h-3.5" /> {app.isTestMode ? "إلغاء التجربة" : "وضع التجربة"}
                            </button>
                            <div className="my-1 border-t border-white/5" />
                            <button onClick={() => handleDelete(app.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5">
                              <Trash2 className="w-3.5 h-3.5" /> حذف (مع الملفات)
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
