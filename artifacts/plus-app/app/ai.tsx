import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  type ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import { useSettings } from "@/contexts/SettingsContext";

// ─── Types ─────────────────────────────────────────────────────────────────

type FontWeight = "Regular" | "Medium" | "SemiBold" | "Bold" | "ExtraBold" | "Black" | "Light";
type FontArFn = (w: FontWeight) => string;

type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  imageUri?: string;
  isStreaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  model: string;
}

interface Segment {
  type: "text" | "code";
  content: string;
  lang?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "@mismari_ai_convs_v2";

const MODELS = [
  { id: "gpt-4o", labelAr: "ذكي", labelEn: "Smart", descAr: "رؤية + نص", descEn: "Vision + Text" },
  { id: "gpt-4o-mini", labelAr: "سريع", labelEn: "Fast", descAr: "خفيف وسريع", descEn: "Light & fast" },
];

const SUGGESTIONS_AR = [
  { icon: "🔧", text: "اشرح لي كود Swift أو Theos" },
  { icon: "🔍", text: "ابحث عن ثغرة في iOS" },
  { icon: "📱", text: "مساعدة في TrollStore" },
  { icon: "⚡", text: "حوّل هذا الكود لـ Python" },
  { icon: "🔐", text: "كيف أتجاوز SSL Pinning؟" },
  { icon: "📦", text: "كيف أوقع IPA بـ Zsign؟" },
  { icon: "🛠️", text: "اكتب لي Tweak بـ Theos" },
  { icon: "🔬", text: "حلل هذا الملف IPA" },
  { icon: "🤖", text: "اكتب سكريبت Python لي" },
  { icon: "💉", text: "كيف أعمل Dylib Injection؟" },
  { icon: "🧩", text: "اشرح لي SwiftUI" },
  { icon: "🗝️", text: "مساعدة في AltSign" },
];

const SUGGESTIONS_EN = [
  { icon: "🔧", text: "Explain Swift or Theos code" },
  { icon: "🔍", text: "Find an iOS vulnerability" },
  { icon: "📱", text: "Help me with TrollStore" },
  { icon: "⚡", text: "Convert this code to Python" },
  { icon: "🔐", text: "How to bypass SSL Pinning?" },
  { icon: "📦", text: "How to sign IPA with Zsign?" },
  { icon: "🛠️", text: "Write me a Theos tweak" },
  { icon: "🔬", text: "Analyze this IPA file" },
  { icon: "🤖", text: "Write me a Python script" },
  { icon: "💉", text: "How to do Dylib Injection?" },
  { icon: "🧩", text: "Explain SwiftUI to me" },
  { icon: "🗝️", text: "Help with AltSign" },
];

// ─── Markdown Parser ────────────────────────────────────────────────────────

function parseMarkdown(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: "text", content: text.slice(lastIdx, match.index) });
    }
    segments.push({ type: "code", lang: match[1] || "code", content: match[2].trim() });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    segments.push({ type: "text", content: text.slice(lastIdx) });
  }
  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}

function renderInlineText(text: string, baseStyle: any) {
  const parts = text.split(/(\*\*[\s\S]*?\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <Text key={i} style={[baseStyle, { fontWeight: "700" }]}>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Text key={i} style={[baseStyle, { fontFamily: "Courier", backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 3, paddingHorizontal: 3 }]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={i} style={baseStyle}>{part}</Text>;
  });
}

// ─── Code Block ─────────────────────────────────────────────────────────────

function HtmlPreviewModal({ html, onClose, isDark }: { html: string; onClose: () => void; isDark: boolean }) {
  const insets = useSafeAreaInsets();
  const fullHtml = html.includes("<html") ? html : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;padding:16px;margin:0;background:${isDark ? "#1a1a1a" : "#fff"};color:${isDark ? "#fff" : "#111"}}</style></head><body>${html}</body></html>`;
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.previewModal, { backgroundColor: isDark ? "#000" : "#f5f5f5", paddingTop: insets.top }]}>
        <View style={styles.previewHeader}>
          <Text style={[styles.previewTitle, { color: isDark ? "#fff" : "#111" }]}>Preview</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.previewCloseBtn}>
            <Feather name="x" size={20} color={isDark ? "#fff" : "#111"} />
          </Pressable>
        </View>
        <View style={styles.previewWebViewContainer}>
          <WebView
            source={{ html: fullHtml }}
            style={{ flex: 1, backgroundColor: "transparent" }}
            scrollEnabled
            originWhitelist={["*"]}
          />
        </View>
      </View>
    </Modal>
  );
}

function CodeBlock({ code, lang, isDark }: { code: string; lang: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isHtml = ["html", "css", "htm", "svg"].includes((lang || "").toLowerCase());

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.codeWrapper, { backgroundColor: isDark ? "#0d0d0d" : "#1e1e1e" }]}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLang}>{lang || "code"}</Text>
        <View style={styles.codeActions}>
          {isHtml && (
            <Pressable onPress={() => setShowPreview(true)} style={styles.copyBtn} hitSlop={8}>
              <Feather name="eye" size={13} color="#7dd3fc" />
              <Text style={[styles.copyText, { color: "#7dd3fc" }]}>Preview</Text>
            </Pressable>
          )}
          <Pressable onPress={handleCopy} style={styles.copyBtn} hitSlop={8}>
            <Feather name={copied ? "check" : "copy"} size={13} color={copied ? "#4ade80" : "#aaa"} />
            <Text style={[styles.copyText, { color: copied ? "#4ade80" : "#aaa" }]}>
              {copied ? "تم النسخ" : "نسخ"}
            </Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.codeText}>{code}</Text>
      </ScrollView>
      {showPreview && <HtmlPreviewModal html={code} onClose={() => setShowPreview(false)} isDark={isDark} />}
    </View>
  );
}

// ─── Message View ────────────────────────────────────────────────────────────

const LOCAL_AVATAR = require("../assets/images/mismari-avatar.png");

function MessageView({
  msg, isDark, isArabic, fontAr, avatarSrc,
}: {
  msg: ChatMessage; isDark: boolean; isArabic: boolean; fontAr: FontArFn;
  avatarSrc?: ImageSourcePropType;
}) {
  const isUser = msg.role === "user";
  const textColor = isDark ? "#fff" : "#1a1a1a";
  const userBg = isDark ? "#0A84FF" : "#007AFF";
  const aiBg = isDark ? "#2a2a2a" : "#f0f0f0";
  const segments = parseMarkdown(msg.content);
  const resolvedAvatar = avatarSrc || LOCAL_AVATAR;

  if (isUser) {
    return (
      <View style={[styles.msgRow, styles.msgRowRight]}>
        <View style={{ maxWidth: "80%", alignItems: "flex-end", gap: 6 }}>
          {msg.imageUri ? (
            <Image source={{ uri: msg.imageUri }} style={styles.msgImage} resizeMode="cover" />
          ) : null}
          {msg.content ? (
            <View style={[styles.userBubble, { backgroundColor: userBg }]}>
              <Text style={[styles.userText, { fontFamily: fontAr("Regular"), textAlign: "right" }]}>
                {msg.content}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.msgRow, styles.msgRowLeft]}>
      <View style={styles.aiAvatarSmall}>
        <Image source={resolvedAvatar} style={styles.aiAvatarSmallImg} resizeMode="contain" />
      </View>
      <View style={[styles.aiBubble, { backgroundColor: aiBg, maxWidth: "88%" }]}>
        {msg.isStreaming && msg.content === "" ? (
          <View style={styles.typingDots}>
            <TypingDot delay={0} isDark={isDark} />
            <TypingDot delay={150} isDark={isDark} />
            <TypingDot delay={300} isDark={isDark} />
          </View>
        ) : (
          segments.map((seg, i) => {
            if (seg.type === "code") {
              return <CodeBlock key={i} code={seg.content} lang={seg.lang || ""} isDark={isDark} />;
            }
            return (
              <Text key={i} style={[styles.aiText, { color: textColor, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}>
                {renderInlineText(seg.content, { color: textColor, fontFamily: fontAr("Regular") })}
              </Text>
            );
          })
        )}
        {msg.isStreaming && msg.content !== "" && (
          <View style={[styles.streamCursor, { backgroundColor: isDark ? "#fff" : "#333" }]} />
        )}
      </View>
    </View>
  );
}

function TypingDot({ delay, isDark }: { delay: number; isDark: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: isDark ? "#888" : "#999", opacity: anim }]}
    />
  );
}

// ─── Welcome Screen ──────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function WelcomeScreen({
  onSuggestion, isArabic, isDark, fontAr, userName, avatarSrc,
}: {
  onSuggestion: (t: string) => void;
  isArabic: boolean; isDark: boolean; fontAr: FontArFn;
  userName?: string;
  avatarSrc?: ImageSourcePropType;
}) {
  const allSuggestions = isArabic ? SUGGESTIONS_AR : SUGGESTIONS_EN;
  const suggestions = useMemo(() => shuffle(allSuggestions).slice(0, 4), [isArabic]);
  const greetName = userName ? (isArabic ? `مرحباً ${userName}` : `Hi ${userName}`) : (isArabic ? "مرحباً" : "Hello");
  const subtitle = isArabic ? "من أين نبدأ اليوم؟" : "Where should we start?";
  const textColor = isDark ? "#fff" : "#1a1a1a";
  const subColor = isDark ? "#aaa" : "#555";
  const chipBg = isDark ? "#1c1c1e" : "#fff";
  const chipBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  return (
    <ScrollView
      contentContainerStyle={styles.welcomeContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.welcomeTop}>
        <View style={styles.aiAvatarLarge}>
          <Image source={avatarSrc || LOCAL_AVATAR} style={styles.aiAvatarLargeImg} resizeMode="contain" />
        </View>
        <Text style={[styles.greetSmall, { color: subColor, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}>
          {greetName}
        </Text>
        <Text style={[styles.greetBig, { color: textColor, fontFamily: fontAr("Bold"), textAlign: isArabic ? "right" : "left" }]}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.chipsContainer}>
        {suggestions.map((s, i) => (
          <Pressable
            key={i}
            onPress={() => onSuggestion(s.text)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: chipBg, borderColor: chipBorder, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.chipIcon}>{s.icon}</Text>
            <Text style={[styles.chipText, { color: textColor, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]} numberOfLines={2}>
              {s.text}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function ChatSidebar({
  conversations, currentId, onSelect, onNew, onClose, isDark, isArabic, fontAr,
}: {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  isDark: boolean; isArabic: boolean; fontAr: FontArFn;
}) {
  const [search, setSearch] = useState("");
  const startX = -320;
  const slideAnim = useRef(new Animated.Value(startX)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, []);

  const close = () => {
    Animated.timing(slideAnim, { toValue: startX, duration: 200, useNativeDriver: true }).start(onClose);
  };

  const bg = isDark ? "#111" : "#fafafa";
  const textColor = isDark ? "#fff" : "#111";
  const subColor = isDark ? "#888" : "#666";
  const inputBg = isDark ? "#1c1c1e" : "#f0f0f0";
  const activeBg = isDark ? "#1a2a4a" : "#e8f0ff";
  const filtered = conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.sidebarOverlay} onPress={close} />
      <Animated.View
        style={[
          styles.sidebar,
          {
            backgroundColor: bg,
            transform: [{ translateX: slideAnim }],
            left: 0,
          },
        ]}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.sidebarHeader}>
            <View style={[styles.sidebarSearchBar, { backgroundColor: inputBg }]}>
              <Feather name="search" size={15} color={subColor} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={isArabic ? "ابحث في المحادثات..." : "Search chats..."}
                placeholderTextColor={subColor}
                style={[styles.sidebarSearchInput, { color: textColor, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}
              />
            </View>
            <Pressable onPress={onNew} style={({ pressed }) => [styles.newChatBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Feather name="edit" size={18} color={isDark ? "#fff" : "#111"} />
            </Pressable>
          </View>
          <Text style={[styles.sidebarSectionTitle, { color: subColor, fontFamily: fontAr("SemiBold"), textAlign: isArabic ? "right" : "left" }]}>
            {isArabic ? "المحادثات" : "Chats"}
          </Text>
          <FlatList
            data={filtered}
            keyExtractor={c => c.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onSelect(item.id); close(); }}
                style={({ pressed }) => [
                  styles.sidebarItem,
                  { backgroundColor: item.id === currentId ? activeBg : "transparent", opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  style={[styles.sidebarItemText, { color: textColor, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
              </Pressable>
            )}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

// ─── Model Picker ────────────────────────────────────────────────────────────

function ModelPicker({
  current, onChange, onClose, isDark, isArabic, fontAr,
}: {
  current: string; onChange: (m: string) => void; onClose: () => void;
  isDark: boolean; isArabic: boolean; fontAr: FontArFn;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, []);
  const close = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 180, useNativeDriver: true }).start(onClose);
  };
  const bg = isDark ? "#1c1c1e" : "#fff";
  const textColor = isDark ? "#fff" : "#111";
  const subColor = isDark ? "#aaa" : "#666";
  const activeBorder = isDark ? "#0A84FF" : "#007AFF";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.sidebarOverlay} onPress={close} />
      <Animated.View style={[styles.modelSheet, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.modelHandle} />
        <Text style={[styles.modelSheetTitle, { color: textColor, fontFamily: fontAr("Bold"), textAlign: "center" }]}>
          {isArabic ? "اختر النموذج" : "Select Model"}
        </Text>
        {MODELS.map(m => (
          <Pressable
            key={m.id}
            onPress={() => { onChange(m.id); close(); }}
            style={[styles.modelItem, { borderColor: m.id === current ? activeBorder : "transparent", borderWidth: 2, backgroundColor: isDark ? "#2a2a2a" : "#f5f5f5" }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.modelName, { color: textColor, fontFamily: fontAr("SemiBold") }]}>
                {isArabic ? m.labelAr : m.labelEn}
              </Text>
              <Text style={[styles.modelDesc, { color: subColor, fontFamily: fontAr("Regular") }]}>
                {isArabic ? m.descAr : m.descEn}
              </Text>
            </View>
            {m.id === current && <Feather name="check-circle" size={18} color={activeBorder} />}
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

// ─── Attach Picker ───────────────────────────────────────────────────────────

function AttachPicker({
  onFilePick, onImagePick, onClose, isDark, isArabic, fontAr,
}: {
  onFilePick: (name: string, content: string) => void;
  onImagePick: (uri: string, base64?: string) => void;
  onClose: () => void;
  isDark: boolean; isArabic: boolean; fontAr: FontArFn;
}) {
  const slideAnim = useRef(new Animated.Value(200)).current;
  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, []);
  const close = () => {
    Animated.timing(slideAnim, { toValue: 200, duration: 150, useNativeDriver: true }).start(onClose);
  };

  const pickFile = async () => {
    close();
    await new Promise(r => setTimeout(r, 200));
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const name = asset.name;
    let content = "";
    const textTypes = [".swift", ".py", ".js", ".ts", ".x", ".m", ".h", ".c", ".cpp", ".txt", ".json", ".md", ".xml", ".plist"];
    const isText = textTypes.some(ext => name.toLowerCase().endsWith(ext));
    if (isText && asset.uri) {
      try { content = await (await fetch(asset.uri)).text(); }
      catch { content = "[تعذّر قراءة الملف]"; }
    } else {
      content = `[ملف: ${name}, الحجم: ${Math.round((asset.size ?? 0) / 1024)} KB]`;
    }
    onFilePick(name, content);
  };

  const pickFromLibrary = async () => {
    close();
    await new Promise(r => setTimeout(r, 200));
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    onImagePick(asset.uri, asset.base64 || undefined);
  };

  const pickFromCamera = async () => {
    close();
    await new Promise(r => setTimeout(r, 200));
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    onImagePick(asset.uri, asset.base64 || undefined);
  };

  const bg = isDark ? "#1c1c1e" : "#fff";
  const textColor = isDark ? "#fff" : "#111";

  const ATTACH_OPTIONS = [
    { icon: "camera" as const, label: isArabic ? "الكاميرا" : "Camera", onPress: pickFromCamera },
    { icon: "image" as const, label: isArabic ? "اختر صورة" : "Photo Library", onPress: pickFromLibrary },
    { icon: "file-text" as const, label: isArabic ? "ملف برمجي (.swift, .py, ...)" : "Code File (.swift, .py, ...)", onPress: pickFile },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.sidebarOverlay} onPress={close} />
      <Animated.View style={[styles.attachSheet, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.modelHandle} />
        {ATTACH_OPTIONS.map((opt, i) => (
          <Pressable
            key={i}
            onPress={opt.onPress}
            style={({ pressed }) => [styles.attachItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name={opt.icon} size={20} color={isDark ? "#fff" : "#111"} />
            <Text style={[styles.attachLabel, { color: textColor, fontFamily: fontAr("Regular") }]}>{opt.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

// ─── Input Bar ───────────────────────────────────────────────────────────────

function InputBar({
  value, onChange, onSend, onAttach, onModelPress, isStreaming, isDark, isArabic, fontAr, model,
  attachedFile, attachedImage, onRemoveFile, onRemoveImage, bottomInset,
}: {
  value: string; onChange: (t: string) => void; onSend: () => void; onAttach: () => void;
  onModelPress: () => void; isStreaming: boolean; isDark: boolean; isArabic: boolean;
  fontAr: FontArFn; model: string;
  attachedFile?: { name: string; content: string } | null;
  attachedImage?: { uri: string; base64?: string } | null;
  onRemoveFile?: () => void;
  onRemoveImage?: () => void;
  bottomInset?: number;
}) {
  const bg = isDark ? "#1c1c1e" : "#fff";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const textColor = isDark ? "#fff" : "#111";
  const subColor = isDark ? "#888" : "#999";
  const sendActive = isDark ? "#0A84FF" : "#007AFF";
  const currentModel = MODELS.find(m => m.id === model);
  const modelLabel = isArabic ? currentModel?.labelAr : currentModel?.labelEn;
  const hasAttachment = !!(attachedFile || attachedImage);

  return (
    <View style={[styles.inputBar, { backgroundColor: bg, borderTopColor: border, paddingBottom: (bottomInset ?? 0) + 4 }]}>
      {/* Attachment previews above text field */}
      {hasAttachment && (
        <View style={styles.attachPreviewRow}>
          {attachedImage && (
            <View style={styles.attachThumbWrapper}>
              <Image source={{ uri: attachedImage.uri }} style={styles.attachThumb} />
              <Pressable style={styles.attachThumbX} onPress={onRemoveImage} hitSlop={4}>
                <Feather name="x" size={10} color="#fff" />
              </Pressable>
            </View>
          )}
          {attachedFile && (
            <View style={[styles.attachFileChip, { backgroundColor: isDark ? "#2a2a3a" : "#e8f0ff" }]}>
              <Feather name="file-text" size={13} color="#007AFF" />
              <Text style={[styles.attachFileChipText, { color: isDark ? "#aac4ff" : "#007AFF" }]} numberOfLines={1}>
                {attachedFile.name}
              </Text>
              <Pressable onPress={onRemoveFile} hitSlop={6}>
                <Feather name="x" size={12} color={isDark ? "#888" : "#666"} />
              </Pressable>
            </View>
          )}
        </View>
      )}
      <View style={[styles.inputRow, { backgroundColor: isDark ? "#2a2a2a" : "#f0f0f0", borderRadius: 22 }]}>
        <Pressable onPress={onAttach} style={styles.inputIconBtn} hitSlop={8}>
          <Feather name="plus" size={20} color={subColor} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline
          placeholder={isArabic ? "اسألني أي شيء..." : "Ask Mismari AI..."}
          placeholderTextColor={subColor}
          style={[
            styles.textInput,
            { color: textColor, fontFamily: fontAr("Regular"), textAlign: isArabic ? "right" : "left" },
          ]}
          editable={!isStreaming}
        />
        <Pressable
          onPress={() => { Keyboard.dismiss(); setTimeout(onModelPress, 100); }}
          style={styles.modelBadge}
          hitSlop={8}
        >
          <Text style={[styles.modelBadgeText, { color: subColor }]}>{modelLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onSend}
          disabled={isStreaming || (value.trim() === "" && !attachedFile && !attachedImage)}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: (isStreaming || (value.trim() === "" && !attachedFile && !attachedImage))
                ? (isDark ? "#333" : "#ddd")
                : sendActive,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          hitSlop={4}
        >
          {isStreaming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="arrow-up" size={16} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Streaming helper ────────────────────────────────────────────────────────

function streamChat(
  url: string,
  body: object,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
  onStatus?: (status: string, query?: string) => void
): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  let processedLen = 0;

  xhr.onreadystatechange = () => {
    if (xhr.readyState >= 3 && xhr.responseText) {
      const newText = xhr.responseText.slice(processedLen);
      processedLen = xhr.responseText.length;
      const lines = newText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (!raw) continue;
        try {
          const data = JSON.parse(raw);
          if (data.status && onStatus) onStatus(data.status, data.query);
          if (data.content) onChunk(data.content);
          if (data.done) onDone();
          if (data.error) onError(data.error);
        } catch {}
      }
    }
    if (xhr.readyState === 4 && xhr.status !== 200) {
      onError(`Network error: ${xhr.status}`);
    }
  };

  xhr.send(JSON.stringify(body));
  return xhr;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function AiScreen({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, t, fontAr, isDark, isArabic, deviceUdid } = useSettings();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64?: string } | null>(null);
  const [customAvatarSrc, setCustomAvatarSrc] = useState<ImageSourcePropType | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  const bg = isDark ? "#000" : "#F0F2F5";
  const headerBg = isDark ? "#000" : "#F0F2F5";
  const textColor = isDark ? "#fff" : "#1a1a1a";
  const subColor = isDark ? "#aaa" : "#666";
  const headerBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const domain = process.env.EXPO_PUBLIC_DOMAIN || "app.mismari.com";
  const apiUrl = `https://${domain}/api/ai/chat`;

  // Fetch custom AI avatar from appearance settings
  useEffect(() => {
    fetch(`https://${domain}/api/appearance`)
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        const url = isDark
          ? data.appearance_ai_avatar_dark_url
          : data.appearance_ai_avatar_light_url;
        if (url) {
          setCustomAvatarSrc({ uri: `https://${domain}${url}` });
        }
      })
      .catch(() => { /* use local fallback */ });
  }, [domain, isDark]);

  // Load conversations
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setConversations(JSON.parse(raw));
    });
  }, []);

  const saveConversations = useCallback((convs: Conversation[]) => {
    setConversations(convs);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  }, []);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const newConversation = useCallback(() => {
    setCurrentConvId(null);
    setMessages([]);
    setInput("");
    setAttachedFile(null);
  }, []);

  const loadConversation = useCallback((convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (conv) {
      setCurrentConvId(convId);
      setMessages(conv.messages);
    }
  }, [conversations]);

  const persistMessages = useCallback((msgs: ChatMessage[], convId: string, model: string) => {
    const title = msgs.find(m => m.role === "user")?.content.slice(0, 40) || "محادثة جديدة";
    setConversations(prev => {
      const existing = prev.find(c => c.id === convId);
      let updated: Conversation[];
      if (existing) {
        updated = prev.map(c => c.id === convId ? { ...c, messages: msgs } : c);
      } else {
        updated = [{ id: convId, title, messages: msgs, createdAt: Date.now(), model }, ...prev];
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && !attachedFile && !attachedImage) return;
    if (isStreaming) return;

    let fullText = trimmed;
    if (attachedFile) {
      fullText += `\n\n📎 **${attachedFile.name}**:\n\`\`\`\n${attachedFile.content.slice(0, 8000)}\n\`\`\``;
      setAttachedFile(null);
    }

    // Capture and compress image before clearing
    let imageBase64: string | null = null;
    let capturedImageUri: string | undefined;
    if (attachedImage) {
      capturedImageUri = attachedImage.uri;
      if (!fullText.trim()) fullText = isArabic ? "حلل هذه الصورة" : "Analyze this image";
      setAttachedImage(null);
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          attachedImage.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        imageBase64 = compressed.base64 || null;
      } catch {
        imageBase64 = attachedImage.base64 || null;
      }
    }

    const userMsg: ChatMessage = { id: genId(), role: "user", content: fullText, imageUri: capturedImageUri };
    const aiMsgId = genId();
    const aiMsg: ChatMessage = { id: aiMsgId, role: "assistant", content: "", isStreaming: true };

    const convId = currentConvId ?? genId();
    if (!currentConvId) setCurrentConvId(convId);

    const newMessages = [...messages, userMsg, aiMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    streamingIdRef.current = aiMsgId;

    const contextMsgs = newMessages
      .filter(m => !m.isStreaming)
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    let accumulated = "";

    const xhr = streamChat(
      apiUrl,
      {
        messages: contextMsgs,
        model: selectedModel,
        deviceInfo: { udid: deviceUdid || undefined },
        ...(imageBase64 ? { imageBase64, imageMime: "image/jpeg" } : {}),
      },
      (chunk) => {
        setIsSearching(false);
        accumulated += chunk;
        setMessages(prev =>
          prev.map(m =>
            m.id === aiMsgId ? { ...m, content: accumulated } : m
          )
        );
      },
      () => {
        setIsStreaming(false);
        setIsSearching(false);
        const finalMsgs = newMessages.map(m =>
          m.id === aiMsgId ? { ...m, content: accumulated, isStreaming: false } : m
        );
        setMessages(finalMsgs.filter(m => !m.isStreaming || m.id !== aiMsgId ? true : accumulated !== ""));
        persistMessages(
          finalMsgs.map(m => ({ ...m, isStreaming: undefined })) as ChatMessage[],
          convId,
          selectedModel
        );
        streamingIdRef.current = null;
      },
      (err) => {
        setIsStreaming(false);
        setIsSearching(false);
        const errMsg = isArabic ? `❌ ${err}` : `❌ Error: ${err}`;
        setMessages(prev =>
          prev.map(m => m.id === aiMsgId ? { ...m, content: errMsg, isStreaming: false } : m)
        );
        streamingIdRef.current = null;
      },
      (status, query) => {
        if (status === "searching") {
          setIsSearching(true);
          setSearchQuery(query || "");
        }
      }
    );
    xhrRef.current = xhr;
  }, [messages, currentConvId, selectedModel, deviceUdid, isArabic, isStreaming, attachedFile, attachedImage, apiUrl, persistMessages]);

  useEffect(() => { scrollToBottom(); }, [messages.length]);

  const handleBack = () => {
    if (xhrRef.current) xhrRef.current.abort();
    if (onClose) {
      onClose();
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleFilePick = (name: string, content: string) => {
    setAttachedFile({ name, content });
  };

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <MessageView msg={item} isDark={isDark} isArabic={isArabic} fontAr={fontAr} avatarSrc={customAvatarSrc ?? undefined} />
  ), [isDark, isArabic, fontAr, customAvatarSrc]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder, paddingTop: insets.top }]}>
        {isArabic ? (
          <Pressable onPress={() => setShowSidebar(true)} style={styles.headerBtn} hitSlop={12}>
            <Feather name="menu" size={22} color={textColor} />
          </Pressable>
        ) : (
          <Pressable onPress={handleBack} style={styles.headerBtn} hitSlop={12}>
            <Feather name="home" size={20} color={textColor} />
          </Pressable>
        )}
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: textColor, fontFamily: fontAr("SemiBold") }]}>
            Mismari AI
          </Text>
        </View>
        {isArabic ? (
          <Pressable onPress={handleBack} style={styles.headerBtn} hitSlop={12}>
            <Feather name="home" size={20} color={textColor} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setShowSidebar(true)} style={styles.headerBtn} hitSlop={12}>
            <Feather name="menu" size={22} color={textColor} />
          </Pressable>
        )}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <WelcomeScreen
            onSuggestion={sendMessage}
            isArabic={isArabic}
            isDark={isDark}
            fontAr={fontAr}
            avatarSrc={customAvatarSrc ?? undefined}
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          />
        )}

        {/* Web Search Indicator */}
        {isSearching && (
          <View style={[styles.searchIndicator, { backgroundColor: isDark ? "#0f1628" : "#e8eeff" }]}>
            <ActivityIndicator size="small" color="#9fbcff" style={{ marginRight: 8 }} />
            <Feather name="search" size={14} color="#9fbcff" style={{ marginRight: 6 }} />
            <Text style={[styles.searchIndicatorText, { fontFamily: fontAr("Medium") }]}>
              {isArabic ? `جاري البحث: "${searchQuery}"` : `Searching: "${searchQuery}"`}
            </Text>
          </View>
        )}

        <InputBar
          value={input}
          onChange={setInput}
          onSend={() => sendMessage(input)}
          onAttach={() => setShowAttach(true)}
          onModelPress={() => setShowModelPicker(true)}
          isStreaming={isStreaming}
          isDark={isDark}
          isArabic={isArabic}
          fontAr={fontAr}
          model={selectedModel}
          attachedFile={attachedFile}
          attachedImage={attachedImage}
          onRemoveFile={() => setAttachedFile(null)}
          onRemoveImage={() => setAttachedImage(null)}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>

      {/* Sidebar */}
      {showSidebar && (
        <ChatSidebar
          conversations={conversations}
          currentId={currentConvId}
          onSelect={loadConversation}
          onNew={() => { newConversation(); setShowSidebar(false); }}
          onClose={() => setShowSidebar(false)}
          isDark={isDark}
          isArabic={isArabic}
          fontAr={fontAr}
        />
      )}

      {/* Model Picker */}
      {showModelPicker && (
        <ModelPicker
          current={selectedModel}
          onChange={setSelectedModel}
          onClose={() => setShowModelPicker(false)}
          isDark={isDark}
          isArabic={isArabic}
          fontAr={fontAr}
        />
      )}

      {/* Attach Picker */}
      {showAttach && (
        <AttachPicker
          onFilePick={handleFilePick}
          onImagePick={(uri, base64) => {
            setAttachedImage({ uri, base64 });
            setShowAttach(false);
          }}
          onClose={() => setShowAttach(false)}
          isDark={isDark}
          isArabic={isArabic}
          fontAr={fontAr}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, letterSpacing: -0.3 },
  welcomeContainer: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 40 },
  welcomeTop: { marginBottom: 32 },
  aiAvatarLarge: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  aiAvatarLargeImg: { width: 36, height: 36 },
  greetSmall: { fontSize: 15, marginBottom: 4 },
  greetBig: { fontSize: 24, lineHeight: 32 },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 8,
    width: "47%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  chipIcon: { fontSize: 17 },
  chipText: { fontSize: 13, flex: 1, lineHeight: 18 },
  messageList: { paddingVertical: 16, paddingHorizontal: 12, gap: 12 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  userBubble: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { color: "#fff", fontSize: 15, lineHeight: 22 },
  msgImage: { width: 220, height: 220, borderRadius: 16, borderBottomRightRadius: 4 },
  aiAvatarSmall: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginBottom: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  aiAvatarSmallImg: { width: 18, height: 18 },
  aiBubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  aiText: { fontSize: 15, lineHeight: 24 },
  typingDots: { flexDirection: "row", gap: 4, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  streamCursor: { width: 2, height: 16, borderRadius: 1, marginTop: 2, marginLeft: 2 },
  codeWrapper: { borderRadius: 10, overflow: "hidden", marginVertical: 4 },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  codeLang: { color: "#888", fontSize: 11, fontFamily: "Courier" },
  codeActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyText: { fontSize: 11 },
  codeText: {
    color: "#d4d4d4",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
  },
  shortcutsBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  shortcutChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    flexShrink: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  shortcutIcon: { fontSize: 14 },
  shortcutText: { fontSize: 12, maxWidth: 130 },
  attachPreviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 4, paddingBottom: 8 },
  attachThumbWrapper: { width: 64, height: 64, borderRadius: 10, overflow: "visible" },
  attachThumb: { width: 64, height: 64, borderRadius: 10 },
  attachThumbX: {
    position: "absolute", top: -6, right: -6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#333",
    alignItems: "center", justifyContent: "center",
  },
  attachFileChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12,
    maxWidth: 200,
  },
  attachFileChipText: { fontSize: 12, flex: 1 },
  inputBar: { paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  inputIconBtn: { padding: 6 },
  textInput: { flex: 1, fontSize: 15, maxHeight: 120, paddingVertical: 4 },
  modelBadge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 10 },
  modelBadgeText: { fontSize: 11 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sidebarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sidebar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 300,
  },
  sidebarHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  sidebarSearchBar: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  sidebarSearchInput: { flex: 1, fontSize: 14 },
  newChatBtn: { padding: 8 },
  sidebarSectionTitle: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  sidebarItem: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, marginHorizontal: 8, marginBottom: 2 },
  sidebarItemText: { fontSize: 14 },
  modelSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 16,
    gap: 10,
  },
  modelHandle: { width: 36, height: 4, backgroundColor: "#888", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modelSheetTitle: { fontSize: 16, marginBottom: 6 },
  modelItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, gap: 12 },
  modelName: { fontSize: 15 },
  modelDesc: { fontSize: 12, marginTop: 2 },
  attachSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  attachItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 14 },
  attachLabel: { fontSize: 15 },

  // Web Search Indicator
  searchIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  searchIndicatorText: {
    fontSize: 13,
    color: "#9fbcff",
    flexShrink: 1,
  },

  // HTML Preview Modal
  previewModal: { flex: 1 },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  previewTitle: { fontSize: 16, fontWeight: "600" },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  previewWebViewContainer: { flex: 1 },
});
