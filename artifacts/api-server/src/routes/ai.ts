import { Router, type Request, type Response } from "express";
import OpenAI from "openai";

const router: Router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PRIMARY_MODEL = "gpt-4o";
const FALLBACK_MODEL = "gpt-4o-mini";
const MAX_CONTEXT_MESSAGES = 10;
const MAX_CONTEXT_CHARS = 12000;

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
- إذا لم تعرف شيئاً، قل "ما أعرف بس أقدر أحاول معاك" بدل الرفض التام${deviceCtx}`;
}

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

router.post("/ai/chat", async (req: Request, res: Response): Promise<void> => {
  const { messages, model, deviceInfo } = req.body as {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    deviceInfo?: { udid?: string; iosVersion?: string; deviceName?: string };
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const systemPrompt = buildSystemPrompt(deviceInfo);
  const contextMessages = truncateMessages(messages);
  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...contextMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const modelsToTry = [model || PRIMARY_MODEL, FALLBACK_MODEL].filter((v, i, a) => a.indexOf(v) === i);

  for (const tryModel of modelsToTry) {
    try {
      const stream = await openai.chat.completions.create({
        model: tryModel,
        messages: chatMessages,
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, model: tryModel })}\n\n`);
      res.end();
      return;
    } catch (err: any) {
      if (tryModel === modelsToTry[modelsToTry.length - 1]) {
        const msg = err?.message || "فشل الاتصال بالذكاء الاصطناعي";
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
        return;
      }
    }
  }
});

export default router;
