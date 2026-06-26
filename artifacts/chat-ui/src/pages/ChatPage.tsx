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
} from "lucide-react";
import VoiceRecorder from "../components/VoiceRecorder";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

const AI_RESPONSE = "哈喽，Chi Xu！👋 今天想搞学习、做应用，还是聊点别的？";

const MODELS = [
  { label: "Flash", value: "flash" },
  { label: "Thinking", value: "thinking" },
];

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

export default function ChatPage() {
  const initialConv: Conversation = {
    id: generateId(),
    title: "哈喽问候",
    messages: [
      { id: generateId(), role: "user", text: "哈喽" },
      { id: generateId(), role: "ai", text: AI_RESPONSE },
    ],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const [conversations, setConversations] = useState<Conversation[]>([initialConv]);
  const [activeId, setActiveId] = useState<string>(initialConv.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("thinking");
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);
  const [toast, setToast] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
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

  const filteredConvs = searchQuery.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

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

  const updateActiveMessages = (msgs: Message[]) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: msgs, updatedAt: Date.now() }
          : c
      )
    );
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    const userMsg: Message = { id: generateId(), role: "user", text };
    const newMessages = [...messages, userMsg];
    updateActiveMessages(newMessages);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && c.title === "新对话"
          ? { ...c, title: makeTitleFromMessage(text), updatedAt: Date.now() }
          : c.id === activeId
            ? { ...c, updatedAt: Date.now() }
            : c
      )
    );

    setInputText("");
    setReplying(true);
    setIsThinking(true);

    setTimeout(() => {
      setIsThinking(false);
      const aiMsg: Message = { id: generateId(), role: "ai", text: AI_RESPONSE };
      updateActiveMessages([...newMessages, aiMsg]);
      setReplying(false);
    }, 1200);
  };

  const handleDelete = (msgId: string) => {
    const filtered = messages.filter((m) => m.id !== msgId);
    updateActiveMessages(filtered);
    setActiveMsgId(null);
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

  const handleSelectConv = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handlePinConv = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
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

  const handleVoiceSend = (text: string) => {
    stopVoice();
    if (!text.trim()) return;

    const userMsg: Message = { id: generateId(), role: "user", text };
    const newMessages = [...messages, userMsg];
    updateActiveMessages(newMessages);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && c.title === "新对话"
          ? { ...c, title: makeTitleFromMessage(text), updatedAt: Date.now() }
          : c.id === activeId
            ? { ...c, updatedAt: Date.now() }
            : c,
      ),
    );

    setReplying(true);
    setIsThinking(true);

    setTimeout(() => {
      setIsThinking(false);
      const aiMsg: Message = { id: generateId(), role: "ai", text: AI_RESPONSE };
      updateActiveMessages([...newMessages, aiMsg]);
      setReplying(false);
    }, 1200);
  };

  const handleVoiceCancel = () => {
    stopVoice();
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
            filteredConvs.length === 0 ? (
              <div style={{ color: "hsl(220 9% 55%)", fontSize: 14, textAlign: "center", padding: 40 }}>
                未找到匹配的对话
              </div>
            ) : (
              filteredConvs.map((c) => (
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
                borderRadius: 20,
                padding: "18px 0",
                width: 260,
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "0 20px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderBottom: "1px solid hsl(0 0% 92%)",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "hsl(220 15% 10%)",
                  letterSpacing: -0.3,
                }}
              >
                <span>GPT-5.5</span>
                <ChevronRight size={16} strokeWidth={2.2} style={{ color: "hsl(220 9% 55%)" }} />
              </button>
              <div
                style={{
                  padding: "12px 20px 6px",
                  fontSize: 13,
                  color: "hsl(220 9% 55%)",
                  fontWeight: 500,
                  letterSpacing: 0.2,
                }}
              >
                Intelligence
              </div>
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "10px 20px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: selectedModel === m.value ? 600 : 400,
                    color: selectedModel === m.value ? "hsl(220 15% 10%)" : "hsl(220 15% 25%)",
                  }}
                  onClick={() => {
                    setSelectedModel(m.value);
                    setModelOpen(false);
                  }}
                >
                  <span>{m.label}</span>
                  {selectedModel === m.value && (
                    <Check size={18} strokeWidth={2.5} style={{ color: "hsl(220 15% 15%)" }} />
                  )}
                </button>
              ))}
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
                gap: 2,
              }}
              onClick={() => setModelOpen(true)}
            >
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "hsl(220 15% 12%)",
                  letterSpacing: -0.3,
                }}
              >
                Thinking
              </span>
              <ChevronRight
                size={16}
                strokeWidth={2.2}
                style={{ color: "hsl(220 15% 40%)", marginTop: 1 }}
              />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
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
                      position: "relative",
                    }}
                    onClick={() =>
                      setActiveMsgId(activeMsgId === msg.id ? null : msg.id)
                    }
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
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      {msg.text}
                    </div>
                    {activeMsgId === msg.id && (
                      <div
                        className="anim-fade-in-scale"
                        style={{
                          position: "absolute",
                          top: -34,
                          right: 0,
                          display: "flex",
                          gap: 6,
                        }}
                      >
                        <button
                          style={{
                            background: "hsl(0 0% 20%)",
                            border: "none",
                            borderRadius: 18,
                            padding: "6px 12px",
                            color: "#fff",
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(msg.id);
                          }}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                          删除
                        </button>
                        <button
                          style={{
                            background: "hsl(0 0% 20%)",
                            border: "none",
                            borderRadius: "50%",
                            width: 28,
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: "#fff",
                            padding: 0,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMsgId(null);
                          }}
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
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
                    onClick={() =>
                      setActiveMsgId(activeMsgId === msg.id ? null : msg.id)
                    }
                  >
                    {msg.text}
                  </p>
                  {activeMsgId === msg.id && (
                    <div className="anim-fade-in-scale" style={{ display: "flex", gap: 6, marginTop: -6 }}>
                      <button
                        style={{
                          background: "hsl(0 0% 20%)",
                          border: "none",
                          borderRadius: 18,
                          padding: "6px 12px",
                          color: "#fff",
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(msg.id);
                        }}
                      >
                        <Trash2 size={13} strokeWidth={2} />
                        删除
                      </button>
                      <button
                        style={{
                          background: "hsl(0 0% 20%)",
                          border: "none",
                          borderRadius: "50%",
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#fff",
                          padding: 0,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMsgId(null);
                        }}
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
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
        </div>

        {/* Bottom Input Bar */}
        <div
          style={{
            padding: "10px 14px 28px",
            background: "hsl(60 8% 96%)",
          }}
        >
          {/* Pill container — two layers cross-fade inside */}
          <div
            style={{
              position: "relative",
              background: "hsl(0 0% 100%)",
              borderRadius: 28,
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
              minHeight: 58,
              overflow: "hidden",
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

              <button
                className="btn-circle"
                style={{
                  background: "hsl(142 72% 36%)", border: "none",
                  borderRadius: "50%", width: 38, height: 38,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0, padding: 0,
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
      </div>
    </div>
  );
}
