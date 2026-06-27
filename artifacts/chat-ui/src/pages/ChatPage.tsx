import { useState, useRef, useEffect, useCallback } from "react";
import {
  AlignLeft,
  ChevronRight,
  SquarePen,
  MoreHorizontal,
  Plus,
  Mic,
  Copy,
  X,
  Trash2,
  Check,
  GitBranch,
  RotateCcw,
  Pin,
  PinOff,
  Circle,
  Search,
  Sparkles,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  BookmarkCheck,
} from "lucide-react";
import VoiceRecorder from "../components/VoiceRecorder";
import AdvancedPanel from "../components/AdvancedPanel";
import {
  useChatCompletions,
  useListConversations,
  useCreateConversation,
  useUpdateConversation,
  useDeleteConversation,
  useAddMessages,
  useSearchConversations,
  getSearchConversationsQueryKey,
} from "@workspace/api-client-react";
import type { ChatMessage, ChatCompletionInputModel } from "@workspace/api-client-react";
import {
  loadSettings,
  saveSettings,
  getSystemRule,
  getActivePresetLabel,
  applyContextLimit,
  type AdvancedSettings,
} from "../lib/advanced-settings";

interface MultiAnswerVersion {
  label: string;
  temperature: number;
  text: string;
  error?: string;
  bookmarked?: boolean;
}

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  thinking?: boolean;
  multiAnswer?: MultiAnswerVersion[];
  multiAnswerActiveIdx?: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ChatModel {
  id: string;
  name: string;
  provider: "deepseek" | "qwen" | "kimi";
  supportsThinking: boolean;
}

const CHAT_MODELS: ChatModel[] = [
  { id: "deepseek-v4-flash", name: "deepseek-v4-flash", provider: "deepseek", supportsThinking: true },
  { id: "qwen3.7-plus", name: "qwen3.7-plus", provider: "qwen", supportsThinking: true },
  { id: "kimi-k2.7-code", name: "kimi-k2.7-code", provider: "kimi", supportsThinking: false },
  { id: "kimi-k2.7-code-highspeed", name: "kimi-k2.7-code-highspeed", provider: "kimi", supportsThinking: false },
];

const DEFAULT_MODEL_ID = "deepseek-v4-flash";

const MULTI_ANSWER_VERSIONS = [
  { id: "precise", label: "稳定版", temperature: 0.2 },
  { id: "balanced", label: "平衡版", temperature: 0.7 },
  { id: "creative", label: "创意版", temperature: 1.2 },
];

function isThinkingModel(modelId: string) {
  return CHAT_MODELS.find((m) => m.id === modelId)?.supportsThinking ?? false;
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 8);
}

function formatTime() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  return `Today, ${h}:${m}`;
}

function createNewConversation(title?: string): Conversation {
  const id = generateId();
  return {
    id,
    title: title || "新对话",
    messages: [],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeTitleFromMessage(msg: string): string {
  if (!msg) return "新对话";
  const trimmed = msg.trim();
  if (trimmed.length <= 12) return trimmed;
  return trimmed.slice(0, 12) + "...";
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "hsl(45 100% 75%)", color: "inherit", padding: 0, borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function ChatPage() {
  const initialConv = createNewConversation();

  const [conversations, setConversations] = useState<Conversation[]>([initialConv]);
  const [activeId, setActiveId] = useState<string>(initialConv.id);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [thinking, setThinking] = useState(false);
  const chatMutation = useChatCompletions();
  const createConvMutation = useCreateConversation();
  const updateConvMutation = useUpdateConversation();
  const deleteConvMutation = useDeleteConversation();
  const addMessagesMutation = useAddMessages();

  const { data: convListData } = useListConversations();
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);
  const [toast, setToast] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [advancedPanelOpen, setAdvancedPanelOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(
    () => loadSettings(DEFAULT_MODEL_ID)
  );
  const [multiAnswerOpen, setMultiAnswerOpen] = useState(false);
  const [multiAnswerPending, setMultiAnswerPending] = useState(false);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>(["balanced"]);
  const [sendDropdownOpen, setSendDropdownOpen] = useState(false);
  // voiceMounted: whether VoiceRecorder is in the DOM (includes exit-animation window)
  const [voiceMounted, setVoiceMounted] = useState(false);
  // voiceActive: opacity target — true = recorder visible, false = input visible
  const [voiceActive, setVoiceActive] = useState(false);
  const voiceExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) || conversations[0];
  const messages = activeConv?.messages || [];

  const pinnedConvs = conversations.filter((c) => c.pinned);
  const recentConvs = conversations.filter((c) => !c.pinned);

  const { data: searchData, isFetching: searchFetching } = useSearchConversations(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.trim().length > 0, queryKey: getSearchConversationsQueryKey({ q: debouncedQuery }) } }
  );

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, replying, scrollToBottom]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Debounce search query by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Load conversations from DB on mount
  useEffect(() => {
    if (!convListData || dbLoaded) return;
    const dbConvs = convListData.conversations;
    if (dbConvs.length > 0) {
      const mapped: Conversation[] = dbConvs.map((c) => ({
        id: c.id,
        title: c.title,
        messages: [],
        pinned: c.pinned,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
      setConversations(mapped);
      setActiveId(mapped[0].id);
    }
    setDbLoaded(true);
  }, [convListData, dbLoaded]);

  // Reload saved settings when model changes
  useEffect(() => {
    setAdvancedSettings(loadSettings(modelId));
  }, [modelId]);

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    saveSettings(modelId, advancedSettings);
  }, [modelId, advancedSettings]);

  const updateActiveMessages = (msgs: Message[]) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: msgs, updatedAt: Date.now() }
          : c
      )
    );
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    const now = Date.now();
    const userMsg: Message = { id: generateId(), role: "user", text };
    const newMessages = [...messages, userMsg];
    updateActiveMessages(newMessages);

    const isNewTitle = activeConv?.title === "新对话";
    const newTitle = isNewTitle ? makeTitleFromMessage(text) : undefined;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && isNewTitle
          ? { ...c, title: newTitle!, updatedAt: now }
          : c.id === activeId
            ? { ...c, updatedAt: now }
            : c
      )
    );

    setInputText("");
    setReplying(true);

    // Ensure conversation exists in DB (create if missing)
    const convExists = convListData?.conversations.some((c) => c.id === activeId);
    if (!convExists) {
      await createConvMutation.mutateAsync({
        data: {
          id: activeId,
          title: newTitle ?? activeConv?.title ?? "新对话",
          modelId,
          pinned: activeConv?.pinned ?? false,
          createdAt: activeConv?.createdAt ?? now,
          updatedAt: now,
        },
      }).catch(() => {});
    } else if (newTitle) {
      updateConvMutation.mutate({ id: activeId, data: { title: newTitle, updatedAt: now } });
    }

    try {
      const rawMessages: ChatMessage[] = newMessages.map((m) => ({
        role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
        content: m.text,
      }));
      const limitedMessages = applyContextLimit(rawMessages, advancedSettings.contextLimit);
      const systemRule = getSystemRule(advancedSettings);
      const apiMessages: ChatMessage[] = systemRule
        ? [{ role: "system" as const, content: systemRule }, ...limitedMessages]
        : limitedMessages;

      const result = await chatMutation.mutateAsync({
        data: {
          model: modelId as ChatCompletionInputModel,
          messages: apiMessages,
          thinking,
          temperature: advancedSettings.temperature,
          topP: advancedSettings.topPEnabled ? advancedSettings.topP : undefined,
        },
      });
      const aiMsg: Message = {
        id: generateId(),
        role: "ai",
        text: result.text,
        thinking: result.thinking,
      };
      updateActiveMessages([...newMessages, aiMsg]);
      addMessagesMutation.mutate({
        id: activeId,
        data: {
          messages: [
            { id: userMsg.id, role: "user", text: userMsg.text, thinking: false, createdAt: now },
            { id: aiMsg.id, role: "ai", text: aiMsg.text, thinking: aiMsg.thinking ?? false, createdAt: Date.now() },
          ],
        },
      });
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "请求失败";
      const aiMsg: Message = {
        id: generateId(),
        role: "ai",
        text: `出错了：${errorText}`,
      };
      updateActiveMessages([...newMessages, aiMsg]);
      addMessagesMutation.mutate({
        id: activeId,
        data: {
          messages: [
            { id: userMsg.id, role: "user", text: userMsg.text, thinking: false, createdAt: now },
            { id: aiMsg.id, role: "ai", text: aiMsg.text, thinking: false, createdAt: Date.now() },
          ],
        },
      });
    } finally {
      setReplying(false);
    }
  };


  const handleCopy = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedMsgId(msgId);
    setToast(true);
    setTimeout(() => {
      setCopiedMsgId(null);
    }, 2200);
  };

  const handleNewChat = () => {
    const conv = createNewConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setTopMenuOpen(false);
    setSidebarOpen(false);
  };

  const handleSelectConv = async (id: string) => {
    // Load messages for this conversation if not yet loaded
    const conv = conversations.find((c) => c.id === id);
    if (conv && conv.messages.length === 0 && convListData?.conversations.some((c) => c.id === id)) {
      try {
        const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
        const resp = await fetch(`${BASE}/api/conversations/${id}`);
        if (resp.ok) {
          const data = await resp.json() as {
            messages: Array<{ id: string; role: string; text: string; thinking: boolean; multiAnswer?: unknown; multiAnswerActiveIdx?: number; createdAt: number }>;
          };
          const loaded: Message[] = data.messages.map((m) => ({
            id: m.id,
            role: m.role === "user" ? "user" : "ai",
            text: m.text,
            thinking: m.thinking,
            multiAnswer: m.multiAnswer as Message["multiAnswer"],
            multiAnswerActiveIdx: m.multiAnswerActiveIdx,
          }));
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, messages: loaded } : c))
          );
        }
      } catch {
        // silently ignore
      }
    }
    setActiveId(id);
    setSidebarOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handlePinConv = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    const newPinned = !(conv?.pinned ?? false);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: newPinned } : c))
    );
    if (convListData?.conversations.some((c) => c.id === id)) {
      updateConvMutation.mutate({ id, data: { pinned: newPinned, updatedAt: Date.now() } });
    }
  };

  const handleDeleteConv = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
      } else {
        const newConv = createNewConversation();
        setConversations([newConv]);
        setActiveId(newConv.id);
      }
    }
    if (convListData?.conversations.some((c) => c.id === id)) {
      deleteConvMutation.mutate({ id });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Start recording: mount immediately, then on next frame activate so CSS transition fires
  const startVoice = useCallback(() => {
    if (voiceExitTimer.current) clearTimeout(voiceExitTimer.current);
    setVoiceMounted(true);
    setIsRecording(true);
    // Activate on next frame so VoiceRecorder renders at opacity 0 first, then transitions in
    requestAnimationFrame(() => setVoiceActive(true));
  }, []);

  // Stop recording: deactivate (triggers CSS transition out), then unmount after transition
  const stopVoice = useCallback(() => {
    setVoiceActive(false);
    setIsRecording(false);
    voiceExitTimer.current = setTimeout(() => {
      setVoiceMounted(false);
    }, 260);
  }, []);

  useEffect(() => {
    return () => { if (voiceExitTimer.current) clearTimeout(voiceExitTimer.current); };
  }, []);

  const handleVoiceTranscribe = (text: string) => {
    stopVoice();
    setInputText(text);
  };

  const handleVoiceSend = async (text: string) => {
    stopVoice();
    if (!text.trim()) return;

    const now = Date.now();
    const userMsg: Message = { id: generateId(), role: "user", text };
    const newMessages = [...messages, userMsg];
    updateActiveMessages(newMessages);

    const isNewTitle = activeConv?.title === "新对话";
    const newTitle = isNewTitle ? makeTitleFromMessage(text) : undefined;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && isNewTitle
          ? { ...c, title: newTitle!, updatedAt: now }
          : c.id === activeId
            ? { ...c, updatedAt: now }
            : c,
      ),
    );

    setReplying(true);

    const convExists = convListData?.conversations.some((c) => c.id === activeId);
    if (!convExists) {
      await createConvMutation.mutateAsync({
        data: {
          id: activeId,
          title: newTitle ?? activeConv?.title ?? "新对话",
          modelId,
          pinned: activeConv?.pinned ?? false,
          createdAt: activeConv?.createdAt ?? now,
          updatedAt: now,
        },
      }).catch(() => {});
    } else if (newTitle) {
      updateConvMutation.mutate({ id: activeId, data: { title: newTitle, updatedAt: now } });
    }

    try {
      const rawMessages: ChatMessage[] = newMessages.map((m) => ({
        role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
        content: m.text,
      }));
      const limitedMessages = applyContextLimit(rawMessages, advancedSettings.contextLimit);
      const systemRule = getSystemRule(advancedSettings);
      const apiMessages: ChatMessage[] = systemRule
        ? [{ role: "system" as const, content: systemRule }, ...limitedMessages]
        : limitedMessages;

      const result = await chatMutation.mutateAsync({
        data: {
          model: modelId as ChatCompletionInputModel,
          messages: apiMessages,
          thinking,
          temperature: advancedSettings.temperature,
          topP: advancedSettings.topPEnabled ? advancedSettings.topP : undefined,
        },
      });
      const aiMsg: Message = {
        id: generateId(),
        role: "ai",
        text: result.text,
        thinking: result.thinking,
      };
      updateActiveMessages([...newMessages, aiMsg]);
      addMessagesMutation.mutate({
        id: activeId,
        data: {
          messages: [
            { id: userMsg.id, role: "user", text: userMsg.text, thinking: false, createdAt: now },
            { id: aiMsg.id, role: "ai", text: aiMsg.text, thinking: aiMsg.thinking ?? false, createdAt: Date.now() },
          ],
        },
      });
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "请求失败";
      const aiMsg: Message = {
        id: generateId(),
        role: "ai",
        text: `出错了：${errorText}`,
      };
      updateActiveMessages([...newMessages, aiMsg]);
      addMessagesMutation.mutate({
        id: activeId,
        data: {
          messages: [
            { id: userMsg.id, role: "user", text: userMsg.text, thinking: false, createdAt: now },
            { id: aiMsg.id, role: "ai", text: aiMsg.text, thinking: false, createdAt: Date.now() },
          ],
        },
      });
    } finally {
      setReplying(false);
    }
  };

  const handleVoiceCancel = () => {
    stopVoice();
  };

  /** Multi-version generation: sends the same prompt with different temperatures in parallel */
  const handleSendMultiAnswer = async (versionIds: string[]) => {
    const text = inputText.trim();
    if (!text || versionIds.length === 0) return;

    const selectedVers = MULTI_ANSWER_VERSIONS.filter((v) => versionIds.includes(v.id));
    if (selectedVers.length === 0) return;

    const now = Date.now();
    const userMsg: Message = { id: generateId(), role: "user", text };
    const newMessages = [...messages, userMsg];
    updateActiveMessages(newMessages);

    const isNewTitle = activeConv?.title === "新对话";
    const newTitle = isNewTitle ? makeTitleFromMessage(text) : undefined;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && isNewTitle
          ? { ...c, title: newTitle!, updatedAt: now }
          : c.id === activeId
            ? { ...c, updatedAt: now }
            : c
      )
    );

    setInputText("");
    setMultiAnswerOpen(false);
    setMultiAnswerPending(true);
    setReplying(true);

    const convExists = convListData?.conversations.some((c) => c.id === activeId);
    if (!convExists) {
      await createConvMutation.mutateAsync({
        data: {
          id: activeId,
          title: newTitle ?? activeConv?.title ?? "新对话",
          modelId,
          pinned: activeConv?.pinned ?? false,
          createdAt: activeConv?.createdAt ?? now,
          updatedAt: now,
        },
      }).catch(() => {});
    } else if (newTitle) {
      updateConvMutation.mutate({ id: activeId, data: { title: newTitle, updatedAt: now } });
    }

    const rawMessages: ChatMessage[] = newMessages.map((m) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.text,
    }));
    const limitedMessages = applyContextLimit(rawMessages, advancedSettings.contextLimit);
    const systemRule = getSystemRule(advancedSettings);
    const apiMessages: ChatMessage[] = systemRule
      ? [{ role: "system" as const, content: systemRule }, ...limitedMessages]
      : limitedMessages;

    try {
      const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
      const response = await fetch(`${BASE}/api/multi-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: apiMessages,
          thinking,
          versions: selectedVers.map((v) => ({
            label: v.label,
            temperature: v.temperature,
          })),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "请求失败" })) as { error?: string };
        throw new Error(err.error ?? "Multi-answer request failed");
      }
      const data = await response.json() as {
        results: Array<{ label: string; temperature: number; text: string; error?: string }>;
      };
      const versions: MultiAnswerVersion[] = data.results.map((r) => ({
        label: r.label,
        temperature: r.temperature,
        text: r.text || r.error || "",
        error: r.error,
      }));

      const aiMsg: Message = {
        id: generateId(),
        role: "ai",
        text: versions[0]?.text ?? "",
        thinking: true,
        multiAnswer: versions,
        multiAnswerActiveIdx: 0,
      };
      updateActiveMessages([...newMessages, aiMsg]);
      addMessagesMutation.mutate({
        id: activeId,
        data: {
          messages: [
            { id: userMsg.id, role: "user", text: userMsg.text, thinking: false, createdAt: now },
            { id: aiMsg.id, role: "ai", text: aiMsg.text, thinking: true, multiAnswer: versions, multiAnswerActiveIdx: 0, createdAt: Date.now() },
          ],
        },
      });
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "请求失败";
      const aiMsg: Message = {
        id: generateId(),
        role: "ai",
        text: `同题多答失败：${errorText}`,
      };
      updateActiveMessages([...newMessages, aiMsg]);
      addMessagesMutation.mutate({
        id: activeId,
        data: {
          messages: [
            { id: userMsg.id, role: "user", text: userMsg.text, thinking: false, createdAt: now },
            { id: aiMsg.id, role: "ai", text: aiMsg.text, thinking: false, createdAt: Date.now() },
          ],
        },
      });
    } finally {
      setReplying(false);
      setMultiAnswerPending(false);
    }
  };

  /** Toggle bookmark on a multi-answer version */
  const handleBookmarkVersion = (msgId: string, versionIdx: number) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId && m.multiAnswer
                  ? {
                      ...m,
                      multiAnswer: m.multiAnswer.map((v, i) =>
                        i === versionIdx ? { ...v, bookmarked: !v.bookmarked } : v
                      ),
                    }
                  : m
              ),
            }
          : c
      )
    );
  };

  /** Convert a multi-answer version into a normal AI message */
  const handleExpandVersion = (msgId: string, versionIdx: number) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId && m.multiAnswer
                  ? {
                      ...m,
                      text: m.multiAnswer[versionIdx]?.text ?? m.text,
                      multiAnswer: undefined,
                      multiAnswerActiveIdx: undefined,
                    }
                  : m
              ),
            }
          : c
      )
    );
  };

  /** Switch active tab in multi-answer comparison */
  const handleSetActiveVersion = (msgId: string, idx: number) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId ? { ...m, multiAnswerActiveIdx: idx } : m
              ),
            }
          : c
      )
    );
  };

  return (
    <div
      style={{
        background: "linear-gradient(to bottom, #ffffff 0%, #ffffff 45%, #c9dff0 100%)",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* ===== SIDEBAR (fixed behind, visible when main slides) ===== */}
      <div
        className="sidebar-normal-wrap"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 320,
          maxWidth: "85vw",
          zIndex: searchOpen ? 60 : 1,
          background: "hsl(0 0% 100%)",
          display: "flex",
          flexDirection: "column",
          padding: searchOpen ? "0" : "24px 0",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Normal sidebar view */}
        <div className="sidebar-normal" style={{ flexShrink: 0 }}>
          {/* Title + Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px 20px",
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "hsl(220 15% 10%)",
                letterSpacing: -0.5,
              }}
            >
              Noemara
            </span>
            <button
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "hsl(220 15% 20%)",
                display: "flex",
                alignItems: "center",
              }}
              onClick={() => {
                setSearchOpen(true);
              }}
            >
              <Search size={20} strokeWidth={1.8} />
            </button>
          </div>

          {/* Pinned */}
          {pinnedConvs.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  padding: "0 20px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "hsl(220 9% 55%)",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Pinned
              </div>
              {pinnedConvs.map((c) => (
                <button
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 20px",
                    background: activeId === c.id ? "hsl(220 14% 92%)" : "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 15,
                    color: "hsl(220 15% 12%)",
                    fontWeight: 500,
                    textAlign: "left",
                    borderRadius: 0,
                  }}
                  onClick={() => handleSelectConv(c.id)}
                >
                  <Pin size={16} strokeWidth={1.8} style={{ color: "hsl(220 9% 55%)", flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Recents */}
          {recentConvs.length > 0 && (
            <div>
              <div
                style={{
                  padding: "0 20px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "hsl(220 9% 55%)",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Recents
              </div>
              {recentConvs.map((c) => (
                <button
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 20px",
                    background: activeId === c.id ? "hsl(220 14% 92%)" : "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 15,
                    color: "hsl(220 15% 12%)",
                    fontWeight: 500,
                    textAlign: "left",
                    borderRadius: 0,
                  }}
                  onClick={() => handleSelectConv(c.id)}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ===== FULL-SCREEN SEARCH OVERLAY ===== */}
      <div
        className={searchOpen ? "app-search-overlay app-search-overlay-active" : "app-search-overlay"}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          background: "hsl(0 0% 100%)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          visibility: searchOpen ? "visible" : "hidden",
          opacity: searchOpen ? 1 : 0,
          transform: searchOpen ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
          pointerEvents: searchOpen ? "auto" : "none",
        }}
      >
        {/* Search input bar — full width */}
        <div
          className="app-search-overlay-bar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 20px",
            borderBottom: "1px solid hsl(0 0% 92%)",
            flexShrink: 0,
          }}
        >
          <Search size={18} strokeWidth={1.8} style={{ color: "hsl(220 9% 55%)", flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            style={{
              flex: 1,
              fontSize: 16,
              color: "hsl(220 15% 12%)",
              border: "none",
              outline: "none",
              background: "transparent",
              padding: "6px 0",
              letterSpacing: 0.1,
            }}
          />
          <button
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "hsl(220 9% 55%)",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </div>

        {/* All conversations list */}
        <div className="app-search-overlay-list" style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {searchQuery.trim() ? (
            searchFetching ? (
              <div style={{ color: "hsl(220 9% 55%)", fontSize: 14, textAlign: "center", padding: 40 }}>
                搜索中…
              </div>
            ) : !searchData || searchData.results.length === 0 ? (
              <div style={{ color: "hsl(220 9% 55%)", fontSize: 14, textAlign: "center", padding: 40 }}>
                未找到匹配的对话或消息
              </div>
            ) : (
              searchData.results.map((r) => (
                <button
                  key={r.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 4,
                    width: "100%",
                    padding: "12px 20px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid hsl(0 0% 95%)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onClick={() => handleSelectConv(r.id)}
                >
                  {/* Conversation title */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                    <Circle size={13} strokeWidth={1.6} style={{ color: "hsl(220 9% 55%)", flexShrink: 0 }} />
                    <span style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: 600,
                      color: "hsl(220 15% 12%)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {highlightMatch(r.title, debouncedQuery)}
                    </span>
                  </div>
                  {/* Matching message snippets */}
                  {r.matchingMessages.slice(0, 2).map((m) => (
                    <div key={m.id} style={{
                      paddingLeft: 23,
                      fontSize: 13,
                      color: "hsl(220 9% 50%)",
                      lineHeight: 1.45,
                      width: "100%",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      <span style={{ fontWeight: 500, color: m.role === "user" ? "hsl(142 55% 38%)" : "hsl(220 9% 45%)", marginRight: 4 }}>
                        {m.role === "user" ? "你" : "AI"}:
                      </span>
                      {highlightMatch(m.text, debouncedQuery)}
                    </div>
                  ))}
                </button>
              ))
            )
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  padding: "14px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "hsl(220 15% 12%)",
                  fontWeight: 500,
                  textAlign: "left",
                }}
                onClick={() => handleSelectConv(c.id)}
              >
                <Circle size={14} strokeWidth={1.6} style={{ color: "hsl(220 9% 55%)", flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ===== MAIN CONTENT (slides right when sidebar opens) ===== */}
      <div
        className={searchOpen ? "main-slide main-content-search-active" : "main-slide"}
        style={{
          position: "relative",
          zIndex: 2,
          background: "linear-gradient(to bottom, #ffffff 0%, #ffffff 45%, #c9dff0 100%)",
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          transform: sidebarOpen ? "translateX(300px)" : "translateX(0)",
          transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: sidebarOpen ? "-4px 0 24px rgba(0,0,0,0.08)" : "none",
        }}
        onClick={() => {
          if (sidebarOpen) setSidebarOpen(false);
        }}
      >
        {/* Overlay dim when sidebar or search open */}
        {(sidebarOpen || searchOpen) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 50,
              background: "rgba(0,0,0,0.08)",
              pointerEvents: "auto",
            }}
            onClick={() => {
              if (sidebarOpen) setSidebarOpen(false);
              if (searchOpen) {
                setSearchOpen(false);
                setSearchQuery("");
              }
            }}
          />
        )}

        {/* Toast: Message copied */}
        {toast && (
          <div
            className="anim-toast-in"
            style={{
              position: "fixed",
              top: 56,
              left: 18,
              right: 18,
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "hsl(0 0% 100%)",
              borderRadius: 24,
              padding: "10px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
              maxWidth: 430,
              margin: "0 auto",
            }}
          >
            <button
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "hsl(220 9% 55%)",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
              onClick={() => setToast(false)}
            >
              <X size={16} strokeWidth={2.2} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 500, color: "hsl(220 15% 10%)" }}>
              Message copied
            </span>
          </div>
        )}

        {/* Model Selector Overlay */}
        {modelOpen && (
          <div
            className="anim-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(0,0,0,0.12)",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              paddingTop: 72,
            }}
            onClick={() => setModelOpen(false)}
          >
            <div
              className="anim-slide-down"
              style={{
                background: "hsl(0 0% 100%)",
                borderRadius: 22,
                padding: "14px 0",
                width: 280,
                boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with current model */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 20px 10px",
                  borderBottom: "1px solid hsl(0 0% 92%)",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13, color: "hsl(220 9% 55%)", fontWeight: 500 }}>
                  当前模型
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "hsl(220 15% 10%)" }}>
                    {CHAT_MODELS.find((m) => m.id === modelId)?.name ?? modelId}
                  </span>
                  {thinking && (
                    <Sparkles size={14} strokeWidth={1.8} style={{ color: "hsl(142 72% 36%)" }} />
                  )}
                </div>
              </div>

              {/* Model list */}
              {CHAT_MODELS.map((m) => (
                <button
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "12px 20px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: modelId === m.id ? 600 : 400,
                    color: modelId === m.id ? "hsl(220 15% 10%)" : "hsl(220 15% 25%)",
                    transition: "background 0.15s ease",
                  }}
                  onClick={() => {
                    setModelId(m.id);
                    if (!m.supportsThinking) setThinking(true);
                    setModelOpen(false);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background:
                          m.provider === "deepseek"
                            ? "hsl(220 90% 60%)"
                            : m.provider === "qwen"
                              ? "hsl(35 90% 55%)"
                              : "hsl(260 80% 65%)",
                      }}
                    />
                    <span>{m.name}</span>
                  </div>
                  {modelId === m.id && (
                    <Check size={18} strokeWidth={2.5} style={{ color: "hsl(142 72% 36%)" }} />
                  )}
                </button>
              ))}

              {/* Deep thinking toggle — only for models that support it */}
              {isThinkingModel(modelId) && (
                <div
                  style={{
                    margin: "8px 20px 0",
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "hsl(220 14% 96%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 13, color: "hsl(220 15% 25%)", fontWeight: 500 }}>
                    深度思考
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "hsl(0 0% 100%)",
                      borderRadius: 20,
                      padding: 2,
                      boxShadow: "inset 0 0 0 1px hsl(220 14% 88%)",
                    }}
                  >
                    <button
                      style={{
                        border: "none",
                        borderRadius: 18,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: thinking ? "transparent" : "hsl(220 14% 92%)",
                        color: thinking ? "hsl(220 9% 55%)" : "hsl(220 15% 15%)",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      onClick={() => setThinking(false)}
                    >
                      <Zap size={12} strokeWidth={2} /> Flash
                    </button>
                    <button
                      style={{
                        border: "none",
                        borderRadius: 18,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: thinking ? "hsl(220 14% 92%)" : "transparent",
                        color: thinking ? "hsl(220 15% 15%)" : "hsl(220 9% 55%)",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      onClick={() => setThinking(true)}
                    >
                      <Sparkles size={12} strokeWidth={2} /> Thinking
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px 10px",
            background: "hsl(60 8% 96%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "hsl(220 15% 20%)",
                display: "flex",
                alignItems: "center",
              }}
              onClick={() => setSidebarOpen(true)}
            >
              <AlignLeft size={22} strokeWidth={1.8} />
            </button>

            <button
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onClick={() => setModelOpen(true)}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "hsl(220 15% 12%)",
                  letterSpacing: -0.3,
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {CHAT_MODELS.find((m) => m.id === modelId)?.name ?? modelId}
              </span>
              <ChevronRight
                size={16}
                strokeWidth={2.2}
                style={{ color: "hsl(220 15% 40%)", marginTop: 1, flexShrink: 0 }}
              />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
            {(activeConv?.messages.length ?? 0) > 0 && (
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "hsl(220 15% 20%)",
                  display: "flex",
                  alignItems: "center",
                }}
                onClick={handleNewChat}
              >
                <SquarePen size={21} strokeWidth={1.8} />
              </button>
            )}
            <button
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "hsl(220 15% 20%)",
                display: "flex",
                alignItems: "center",
              }}
              onClick={() => setTopMenuOpen(!topMenuOpen)}
            >
              <MoreHorizontal size={22} strokeWidth={1.8} />
            </button>

            {/* Top-right menu popup */}
            {topMenuOpen && (
              <div
                className="anim-fade-in-scale"
                style={{
                  position: "absolute",
                  top: 36,
                  right: -6,
                  zIndex: 40,
                  background: "hsl(0 0% 100%)",
                  borderRadius: 18,
                  padding: "10px 0",
                  width: 200,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                }}
              >
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 15,
                    color: "hsl(220 15% 10%)",
                    fontWeight: 500,
                    textAlign: "left",
                  }}
                  onClick={() => {
                    handlePinConv(activeId);
                    setTopMenuOpen(false);
                  }}
                >
                  {activeConv.pinned ? <PinOff size={18} strokeWidth={1.8} /> : <Pin size={18} strokeWidth={1.8} />}
                  {activeConv.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "10px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 15,
                    color: "hsl(0 70% 55%)",
                    fontWeight: 500,
                    textAlign: "left",
                  }}
                  onClick={() => {
                    setTopMenuOpen(false);
                    handleDeleteConv(activeId);
                  }}
                >
                  <Trash2 size={18} strokeWidth={1.8} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div
          ref={chatRef}
          style={{
            flex: 1,
            padding: "8px 18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            overflowY: "auto",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 24px",
                textAlign: "center",
              }}
            >
              {/* Sparkle icon */}
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="hsl(220 9% 55%)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 20, opacity: 0.55 }}
              >
                <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />
              </svg>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 550,
                  color: "hsl(220 15% 18%)",
                  letterSpacing: 0.8,
                  lineHeight: 1.4,
                  marginBottom: 12,
                }}
              >
                让未曾落笔的思绪，在此慢慢成诗。
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  color: "hsl(220 9% 55%)",
                  letterSpacing: 0.3,
                  lineHeight: 1.5,
                }}
              >
                从一个问题、一张图片，或一段尚未说完的话开始。
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div
                    key={msg.id}
                    className="msg-bubble-user"
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        background: "hsl(142 55% 72%)",
                        color: "hsl(142 40% 15%)",
                        borderRadius: "20px 20px 6px 20px",
                        padding: "10px 16px",
                        fontSize: 16,
                        fontWeight: 500,
                        maxWidth: "70%",
                        letterSpacing: 0.1,
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              }

              // ── Multi-answer comparison card ──
              if (msg.multiAnswer && msg.multiAnswer.length > 0) {
                const activeIdx = msg.multiAnswerActiveIdx ?? 0;
                const activeVersion = msg.multiAnswer[activeIdx];
                return (
                  <div
                    key={msg.id}
                    className="msg-bubble-ai anim-fade-in"
                    style={{ display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    {/* Version tabs */}
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <Layers size={13} strokeWidth={1.8} style={{ color: "hsl(220 9% 55%)", flexShrink: 0 }} />
                      {msg.multiAnswer.map((v, i) => (
                        <button
                          key={i}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 16,
                            border: `1.5px solid ${activeIdx === i ? "hsl(220 80% 55%)" : "hsl(0 0% 88%)"}`,
                            background: activeIdx === i ? "hsl(220 80% 55%)" : "hsl(0 0% 100%)",
                            color: activeIdx === i ? "#fff" : "hsl(220 15% 25%)",
                            fontSize: 12,
                            fontWeight: activeIdx === i ? 600 : 400,
                            cursor: "pointer",
                          }}
                          onClick={() => handleSetActiveVersion(msg.id, i)}
                        >
                          {v.label}
                          <span style={{ marginLeft: 4, opacity: 0.65 }}>T={v.temperature}</span>
                          {v.bookmarked && " ★"}
                        </button>
                      ))}
                    </div>
                    {/* Active version text */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: 16,
                        color: activeVersion?.error ? "hsl(0 65% 45%)" : "hsl(220 15% 12%)",
                        lineHeight: 1.6,
                        letterSpacing: 0.1,
                      }}
                    >
                      {activeVersion?.error
                        ? `⚠️ ${activeVersion.error}`
                        : (activeVersion?.text ?? "")}
                    </p>
                    {/* Action row */}
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 2 }}>
                      <button
                        style={{
                          background: "none", border: "none", padding: 0, cursor: "pointer",
                          color: copiedMsgId === msg.id ? "hsl(220 15% 15%)" : "hsl(220 9% 55%)",
                          display: "flex", alignItems: "center",
                        }}
                        onClick={() => handleCopy(msg.id, activeVersion?.text ?? "")}
                      >
                        {copiedMsgId === msg.id ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={1.7} />}
                      </button>
                      <button
                        style={{
                          background: "none", border: "none", padding: 0, cursor: "pointer",
                          color: activeVersion?.bookmarked ? "hsl(45 90% 45%)" : "hsl(220 9% 55%)",
                          display: "flex", alignItems: "center",
                        }}
                        onClick={() => handleBookmarkVersion(msg.id, activeIdx)}
                      >
                        <BookmarkCheck size={16} strokeWidth={1.7} />
                      </button>
                      <button
                        style={{
                          padding: "4px 12px",
                          borderRadius: 14,
                          border: "1.5px solid hsl(142 60% 42%)",
                          background: "none",
                          color: "hsl(142 60% 35%)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        onClick={() => handleExpandVersion(msg.id, activeIdx)}
                      >
                        继续此版本
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className="msg-bubble-ai"
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "hsl(220 9% 60%)",
                      fontStyle: "italic",
                      paddingLeft: 2,
                    }}
                  >
                    Thought for a second
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 16,
                      color: "hsl(220 15% 12%)",
                      lineHeight: 1.6,
                      letterSpacing: 0.1,
                    }}
                  >
                    {msg.text}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      marginTop: 4,
                      position: "relative",
                    }}
                  >
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: copiedMsgId === msg.id ? "hsl(220 15% 15%)" : "hsl(220 9% 55%)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onClick={() => handleCopy(msg.id, msg.text)}
                    >
                      {copiedMsgId === msg.id ? (
                        <Check size={18} strokeWidth={2.5} />
                      ) : (
                        <Copy size={18} strokeWidth={1.7} />
                      )}
                    </button>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "hsl(220 9% 55%)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onClick={() =>
                        setMenuMsgId(menuMsgId === msg.id ? null : msg.id)
                      }
                    >
                      <MoreHorizontal size={18} strokeWidth={1.7} />
                    </button>
                    {menuMsgId === msg.id && (
                      <div
                        className="anim-fade-in-scale"
                        style={{
                          position: "absolute",
                          top: 28,
                          left: 20,
                          zIndex: 10,
                          background: "hsl(0 0% 100%)",
                          borderRadius: 16,
                          padding: "14px 0",
                          width: 240,
                          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                        }}
                      >
                        <div
                          style={{
                            padding: "0 16px 6px",
                            fontSize: 13,
                            color: "hsl(220 9% 55%)",
                            fontWeight: 500,
                            textAlign: "left",
                            letterSpacing: 0.2,
                          }}
                        >
                          {formatTime()}
                        </div>
                        <button
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            width: "100%",
                            padding: "10px 16px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 15,
                            color: "hsl(220 15% 10%)",
                            fontWeight: 500,
                            textAlign: "left",
                          }}
                        >
                          <GitBranch size={18} strokeWidth={1.8} />
                          Branch in new chat
                        </button>
                        <div
                          style={{ height: 1, background: "hsl(0 0% 92%)", margin: "4px 16px" }}
                        />
                        <div
                          style={{
                            padding: "6px 16px",
                            fontSize: 13,
                            color: "hsl(220 9% 55%)",
                            fontWeight: 500,
                            letterSpacing: 0.2,
                          }}
                        >
                          Used 5.5 Thinking
                        </div>
                        <button
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            width: "100%",
                            padding: "10px 16px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 15,
                            color: "hsl(220 15% 10%)",
                            fontWeight: 500,
                            textAlign: "left",
                          }}
                        >
                          <RotateCcw size={18} strokeWidth={1.8} />
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {replying && (
            <div
              className="msg-bubble-ai anim-fade-in"
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <p
                className="anim-thinking-dots"
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "hsl(220 9% 60%)",
                  fontStyle: "italic",
                  paddingLeft: 2,
                }}
              >
                Thinking<span>.</span><span>.</span><span>.</span>
              </p>
            </div>
          )}
        </div>

        {/* Bottom Input Bar */}
        <div
          style={{
            padding: "10px 14px 28px",
            background: "hsl(60 8% 96%)",
          }}
        >
          {/* Active preset label + settings button row */}
          {(() => {
            const presetLabel = getActivePresetLabel(advancedSettings);
            const caps = CHAT_MODELS.find((m) => m.id === modelId);
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  minHeight: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {presetLabel && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 10px",
                        borderRadius: 12,
                        background: "hsl(142 55% 92%)",
                        color: "hsl(142 60% 28%)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span>{presetLabel}</span>
                      <button
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", display: "flex" }}
                        onClick={() =>
                          setAdvancedSettings((s) => ({ ...s, systemPresetId: "none" }))
                        }
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                  {advancedSettings.contextLimit !== 8 && (
                    <div
                      style={{
                        padding: "2px 10px",
                        borderRadius: 12,
                        background: "hsl(35 80% 92%)",
                        color: "hsl(35 60% 30%)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {advancedSettings.contextLimit === -1 ? "全部上下文" : `最近 ${advancedSettings.contextLimit} 条`}
                    </div>
                  )}
                  {advancedSettings.temperature !== undefined && (
                    <div
                      style={{
                        padding: "2px 10px",
                        borderRadius: 12,
                        background: "hsl(220 80% 94%)",
                        color: "hsl(220 60% 35%)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      T={advancedSettings.temperature}
                    </div>
                  )}
                  {!caps && null}
                </div>
                <button
                  style={{
                    background: advancedPanelOpen ? "hsl(220 14% 88%)" : "none",
                    border: "none",
                    borderRadius: 10,
                    padding: "4px 8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: advancedPanelOpen ? "hsl(220 15% 15%)" : "hsl(220 9% 50%)",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={() => setAdvancedPanelOpen((v) => !v)}
                >
                  <SlidersHorizontal size={14} strokeWidth={1.8} />
                  高级设置
                </button>
              </div>
            );
          })()}

          {/* Pill container — two layers cross-fade inside */}
          <div
            style={{
              position: "relative",
              background: "hsl(0 0% 100%)",
              borderRadius: 28,
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
              minHeight: 58,
            }}
          >
            {/* ── Input layer ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px 10px 16px",
                opacity: voiceActive ? 0 : 1,
                transform: voiceActive ? "translateY(5px)" : "translateY(0)",
                pointerEvents: voiceActive ? "none" : "auto",
                transition: "opacity 0.24s cubic-bezier(0.22,1,0.36,1), transform 0.24s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <button
                style={{
                  background: "none", border: "none", padding: 0,
                  cursor: "pointer", color: "hsl(220 15% 35%)",
                  display: "flex", alignItems: "center", flexShrink: 0,
                }}
              >
                <Plus size={22} strokeWidth={2} />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask ChatGPT"
                style={{
                  flex: 1, fontSize: 15.5, color: "hsl(220 15% 12%)",
                  border: "none", outline: "none", background: "transparent",
                  padding: 0, letterSpacing: 0.1,
                }}
              />

              {!inputText && (
                <button
                  className="btn-circle"
                  style={{
                    background: "none", border: "none", padding: 0,
                    cursor: "pointer", color: "hsl(220 15% 35%)",
                    display: "flex", alignItems: "center", flexShrink: 0,
                  }}
                  onClick={startVoice}
                >
                  <Mic size={21} strokeWidth={1.8} />
                </button>
              )}

              {/* Send button + multi-answer dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <button
                  className="btn-circle"
                  style={{
                    background: "hsl(142 72% 36%)", border: "none",
                    borderRadius: "50%", width: 38, height: 38,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                    transition: "background 0.2s ease",
                  }}
                  onClick={handleSend}
                >
                  {inputText ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                      <rect x="0" y="5" width="2.2" height="4" rx="1.1" fill="white" />
                      <rect x="3.2" y="3" width="2.2" height="8" rx="1.1" fill="white" />
                      <rect x="6.4" y="0" width="2.2" height="14" rx="1.1" fill="white" />
                      <rect x="9.6" y="3" width="2.2" height="8" rx="1.1" fill="white" />
                      <rect x="12.8" y="1.5" width="2.2" height="11" rx="1.1" fill="white" />
                      <rect x="16" y="4" width="2.2" height="6" rx="1.1" fill="white" />
                    </svg>
                  )}
                </button>
                {/* Multi-answer dropdown chevron */}
                {inputText && (
                  <div style={{ position: "relative" }}>
                    <button
                      style={{
                        background: "none", border: "none", padding: "2px 2px",
                        cursor: "pointer", color: "hsl(142 60% 32%)",
                        display: "flex", alignItems: "center",
                      }}
                      onClick={() => setSendDropdownOpen((v) => !v)}
                    >
                      <ChevronDown size={15} strokeWidth={2.2} />
                    </button>
                    {sendDropdownOpen && (
                      <div
                        className="anim-fade-in-scale"
                        style={{
                          position: "absolute",
                          bottom: 30,
                          right: 0,
                          background: "hsl(0 0% 100%)",
                          borderRadius: 14,
                          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                          padding: "8px 0",
                          minWidth: 180,
                          zIndex: 100,
                        }}
                      >
                        <button
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            width: "100%", padding: "10px 16px",
                            background: "none", border: "none",
                            cursor: "pointer", fontSize: 14,
                            color: "hsl(220 15% 10%)", fontWeight: 500,
                            textAlign: "left",
                          }}
                          onClick={() => {
                            setSendDropdownOpen(false);
                            setMultiAnswerOpen(true);
                          }}
                        >
                          <Layers size={16} strokeWidth={1.8} />
                          同题多答…
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Voice recorder layer (cross-fades over input) ── */}
            {voiceMounted && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 10px 10px 16px",
                  opacity: voiceActive ? 1 : 0,
                  transform: voiceActive ? "translateY(0)" : "translateY(5px)",
                  pointerEvents: voiceActive ? "auto" : "none",
                  transition: "opacity 0.26s cubic-bezier(0.22,1,0.36,1), transform 0.26s cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <VoiceRecorder
                  onTranscribe={handleVoiceTranscribe}
                  onSend={handleVoiceSend}
                  onCancel={handleVoiceCancel}
                />
              </div>
            )}
          </div>
        </div>

        {/* ─── Advanced Panel (bottom sheet) ─── */}
        <AdvancedPanel
          open={advancedPanelOpen}
          modelId={modelId}
          settings={advancedSettings}
          onClose={() => setAdvancedPanelOpen(false)}
          onSettingsChange={(s) => setAdvancedSettings(s)}
        />

        {/* ─── Multi-answer version selection modal ─── */}
        {multiAnswerOpen && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.35)",
              display: "flex", alignItems: "flex-end",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setMultiAnswerOpen(false);
            }}
          >
            <div
              className="anim-slide-up"
              style={{
                width: "100%", background: "hsl(0 0% 100%)",
                borderRadius: "24px 24px 0 0",
                padding: "24px 20px 40px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Layers size={18} strokeWidth={1.8} style={{ color: "hsl(220 60% 50%)" }} />
                  <span style={{ fontSize: 17, fontWeight: 700, color: "hsl(220 15% 10%)" }}>同题多答</span>
                </div>
                <button
                  style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "hsl(220 9% 50%)" }}
                  onClick={() => setMultiAnswerOpen(false)}
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "hsl(220 9% 50%)", lineHeight: 1.5 }}>
                选择要生成的版本（将并发调用 AI，消耗更多 Token）
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {MULTI_ANSWER_VERSIONS.map((v) => {
                  const selected = selectedVersionIds.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px",
                        borderRadius: 16,
                        border: `1.5px solid ${selected ? "hsl(220 80% 55%)" : "hsl(0 0% 88%)"}`,
                        background: selected ? "hsl(220 80% 97%)" : "hsl(0 0% 100%)",
                        cursor: "pointer", textAlign: "left",
                      }}
                      onClick={() =>
                        setSelectedVersionIds((prev) =>
                          prev.includes(v.id)
                            ? prev.filter((x) => x !== v.id)
                            : [...prev, v.id]
                        )
                      }
                    >
                      <div
                        style={{
                          width: 20, height: 20,
                          borderRadius: 6,
                          border: `2px solid ${selected ? "hsl(220 80% 55%)" : "hsl(0 0% 75%)"}`,
                          background: selected ? "hsl(220 80% 55%)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {selected && <Check size={12} strokeWidth={3} style={{ color: "#fff" }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(220 15% 10%)" }}>
                          {v.label}
                          <span style={{ marginLeft: 8, fontSize: 12, color: "hsl(220 9% 55%)", fontWeight: 400 }}>
                            temperature = {v.temperature}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                disabled={selectedVersionIds.length === 0 || multiAnswerPending}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 20,
                  background: selectedVersionIds.length === 0
                    ? "hsl(0 0% 88%)"
                    : "hsl(220 80% 55%)",
                  color: selectedVersionIds.length === 0 ? "hsl(220 9% 55%)" : "#fff",
                  border: "none",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: selectedVersionIds.length === 0 ? "not-allowed" : "pointer",
                }}
                onClick={() => handleSendMultiAnswer(selectedVersionIds)}
              >
                {multiAnswerPending
                  ? "生成中…"
                  : `生成 ${selectedVersionIds.length} 个版本`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
