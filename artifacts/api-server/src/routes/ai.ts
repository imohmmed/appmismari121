import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: Router = Router();

/* ─── Runtime key lookup (DB first, env fallback) ──────────────────────────── */
async function getSettingValue(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    return rows[0]?.value || null;
  } catch {
    return null;
  }
}

async function buildOpenAIClient(): Promise<{ client: OpenAI; braveKey: string | null }> {
  const dbOpenRouterKey = await getSettingValue("ai_openrouter_key");
  const dbBraveKey = await getSettingValue("ai_brave_key");

  const apiKey = dbOpenRouterKey || process.env.OPENAI_API_KEY || "";
  const braveKey = dbBraveKey || process.env.BRAVE_SEARCH_API_KEY || null;
  const isOpenRouter = apiKey.startsWith("sk-or-") || apiKey.startsWith("sk_or_");

  const client = new OpenAI({
    apiKey,
    ...(isOpenRouter ? {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://app.mismari.com",
        "X-Title": "Mismari AI",
      },
    } : {}),
  });

  return { client, braveKey };
}

const PRIMARY_MODEL = "gpt-4o";
const FALLBACK_MODEL = "gpt-4o-mini";
const MAX_CONTEXT_MESSAGES = 10;
const MAX_CONTEXT_CHARS = 12000;

// ─── System Prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(deviceInfo?: { udid?: string; iosVersion?: string; deviceName?: string }): string {
  const deviceCtx = deviceInfo?.udid
    ? `\n\nمعلومات جهاز المستخدم:\n- UDID: ${deviceInfo.udid}\n- إصدار iOS: ${deviceInfo.iosVersion || "غير معروف"}\n- الجهاز: ${deviceInfo.deviceName || "iPhone"}`
    : "";
  return `أنت مسماري الذكي، المساعد التقني الأول في العراق لمتجر مسماري بلس.

شخصيتك:
- أسلوبك تقني، واثق، ومرح قليلاً
- لغتك الافتراضية العربية بلهجة عراقية بيضاء مفهومة
- إذا تكلم معك المستخدم بالإنجليزية، رد عليه بالإنجليزية
- اسمك دائماً "مسماري" وليس "ChatGPT" أو "Claude" أو أي اسم آخر

تخصصاتك:
- تطوير تطبيقات iOS (Swift, Objective-C, SwiftUI)
- أدوات Theos لتطوير التعديلات (Tweaks) على iOS
- توقيع التطبيقات (IPA Signing) وأدوات Zsign وAltSign
- TrollStore وتثبيت التطبيقات بدون جيلبريك
- تجاوز الحمايات التقنية في التطبيقات (Anti-cheat, SSL Pinning)
- Python, JavaScript, TypeScript, وبرمجة عامة
- تحليل ملفات IPA وكشف الثغرات الأمنية
- React Native وExpo Framework

قواعد مهمة:
- لا تقل أبداً "لا أستطيع المساعدة" في الأمور التقنية المشروعة
- عندما تكتب كوداً، استخدم markdown مع تحديد اللغة (مثال: \`\`\`swift)
- الإجابات تكون دقيقة، مختصرة، وعملية
- إذا لم تعرف شيئاً، قل "ما أعرف بس أقدر أحاول معاك" بدل الرفض التام
- عندما تستخدم أداة البحث، اذكر مصادرك في ردك${deviceCtx}`;
}

// ─── Context Truncation ──────────────────────────────────────────────────────

function truncateMessages(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
  let totalChars = 0;
  const result = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    totalChars += recent[i].content.length;
    if (totalChars > MAX_CONTEXT_CHARS) break;
    result.unshift(recent[i]);
  }
  return result.length > 0 ? result : recent.slice(-2);
}

// ─── Brave Web Search ────────────────────────────────────────────────────────

async function braveSearch(query: string, key: string): Promise<string> {
  if (!key) return "خدمة البحث غير متاحة حالياً (مفتاح API مفقود).";

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&text_decorations=false&result_filter=web`;
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
    });

    if (!resp.ok) return `فشل البحث: HTTP ${resp.status}`;

    const data = await resp.json() as any;
    const results: any[] = data.web?.results || [];

    if (results.length === 0) return "لم تُوجد نتائج لهذا البحث.";

    return (
      `نتائج البحث عن: "${query}"\n\n` +
      results.slice(0, 5).map((r: any, i: number) =>
        `[${i + 1}] ${r.title}\n${r.description || ""}\nالمصدر: ${r.url}`
      ).join("\n\n")
    );
  } catch (err: any) {
    return `خطأ في البحث: ${err?.message || "غير معروف"}`;
  }
}

// ─── OpenAI Tool Definition ──────────────────────────────────────────────────

const SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_web",
    description: [
      "Search the internet for real-time or recent information.",
      "Use ONLY when the user asks about: current events, latest iOS versions,",
      "recent CVEs/vulnerabilities, news, prices, release dates, or anything",
      "that might have changed after your knowledge cutoff (early 2024).",
      "Do NOT use for general coding questions or knowledge you already have.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Concise English search query for best results",
        },
      },
      required: ["query"],
    },
  },
};

// ─── Main Route ──────────────────────────────────────────────────────────────

router.post("/ai/chat", async (req: Request, res: Response): Promise<void> => {
  const { messages, model, deviceInfo, imageBase64, imageMime } = req.body as {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    deviceInfo?: { udid?: string; iosVersion?: string; deviceName?: string };
    imageBase64?: string;
    imageMime?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages required" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  const systemPrompt = buildSystemPrompt(deviceInfo);
  const contextMessages = truncateMessages(messages);

  // Build messages — inject vision image into last user message if provided
  const builtMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = contextMessages.map((m, i) => {
    const isLastUser = m.role === "user" && i === contextMessages.length - 1 && !!imageBase64;
    if (isLastUser && imageBase64) {
      const mime = imageMime || "image/jpeg";
      return {
        role: "user" as const,
        content: [
          {
            type: "image_url" as const,
            image_url: { url: `data:${mime};base64,${imageBase64}`, detail: "high" as const },
          },
          { type: "text" as const, text: m.content || "حلل هذه الصورة" },
        ],
      };
    }
    return {
      role: m.role as "user" | "assistant",
      content: m.content,
    };
  });

  const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...builtMessages,
  ];

  const primaryModel = model || PRIMARY_MODEL;
  const modelsToTry = [primaryModel, FALLBACK_MODEL].filter((v, i, a) => a.indexOf(v) === i);

  // Resolve API keys (DB overrides env vars)
  const { client: openai, braveKey } = await buildOpenAIClient();

  // ── Phase 1: Check if web search is needed (non-streaming, with tools) ──
  // Skip Phase 1 when an image is attached — tool check would send base64 twice
  let finalMessages = [...baseMessages];

  if (braveKey && !imageBase64) {
    try {
      const toolCheck = await openai.chat.completions.create({
        model: primaryModel,
        messages: baseMessages,
        tools: [SEARCH_TOOL],
        tool_choice: "auto",
        max_tokens: 200,
        stream: false,
      });

      const choice = toolCheck.choices[0];
      const toolCalls = choice?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        const call = toolCalls[0];
        const args = JSON.parse(call.function.arguments || "{}");
        const query = args.query || "";

        // Notify frontend that search is happening
        send({ status: "searching", query });

        // Execute Brave search
        const searchResults = await braveSearch(query, braveKey!);

        // Add tool call + result to messages
        finalMessages = [
          ...baseMessages,
          { role: "assistant" as const, content: null, tool_calls: toolCalls } as any,
          {
            role: "tool" as const,
            tool_call_id: call.id,
            content: searchResults,
          },
        ];
      }
    } catch {
      // If tool check fails, continue without search
    }
  }

  // ── Phase 2: Stream the final response ──
  for (const tryModel of modelsToTry) {
    try {
      const stream = await openai.chat.completions.create({
        model: tryModel,
        messages: finalMessages,
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) send({ content });
      }

      send({ done: true, model: tryModel });
      res.end();
      return;
    } catch (err: any) {
      if (tryModel === modelsToTry[modelsToTry.length - 1]) {
        send({ error: err?.message || "فشل الاتصال بالذكاء الاصطناعي" });
        res.end();
        return;
      }
    }
  }
});

export default router;
