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
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
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

function triggerVibrate() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(15);
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: generateId(), role: "user", text: "\u54c8\u55bd" },
    { id: generateId(), role: "ai", text: AI_RESPONSE },
  ]);
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
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, replying, scrollToBottom]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(false), 2200);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    const userMsg: Message = { id: generateId(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setReplying(true);
    setIsThinking(true);

    setTimeout(() => {
      setIsThinking(false);
      const aiMsg: Message = { id: generateId(), role: "ai", text: AI_RESPONSE };
      setMessages((prev) => [...prev, aiMsg]);
      setReplying(false);
    }, 1200);
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setActiveMsgId(null);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    triggerVibrate();
    setCopiedMsgId(id);
    setToast(true);
    setTimeout(() => {
      setCopiedMsgId(null);
    }, 2200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        background: "hsl(60 8% 96%)",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
      }}
    >
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
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "hsl(220 15% 10%)",
            }}
          >
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
            {/* Model title */}
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
              <span>
                GPT-5.5
              </span>
              <ChevronRight
                size={16}
                strokeWidth={2.2}
                style={{ color: "hsl(220 9% 55%)" }}
              />
            </button>

            {/* Intelligence label */}
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

            {/* Model options */}
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
                  <Check
                    size={18}
                    strokeWidth={2.5}
                    style={{ color: "hsl(220 15% 15%)" }}
                  />
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
              {/* Pin */}
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
                <Pin size={18} strokeWidth={1.8} />
                Pin
              </button>

              {/* Delete */}
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
                  setMessages([]);
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
        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div
                key={msg.id}
                className="anim-fade-in"
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

                {/* Delete bubble */}
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

          // AI message
          return (
            <div
              key={msg.id}
              className="anim-fade-in"
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {/* Thinking label */}
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

              {/* AI message text */}
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

              {/* Delete / actions on click message */}
              {activeMsgId === msg.id && (
                <div
                  className="anim-fade-in-scale"
                  style={{ display: "flex", gap: 6, marginTop: -6 }}
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

              {/* Action icons row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  marginTop: 4,
                  position: "relative",
                }}
              >
                {/* Copy button / Checkmark */}
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

                {/* More button */}
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

                {/* Message menu popup */}
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
                    {/* Time label */}
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

                    {/* Branch in new chat */}
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

                    {/* Divider */}
                    <div
                      style={{
                        height: 1,
                        background: "hsl(0 0% 92%)",
                        margin: "4px 16px",
                      }}
                    />

                    {/* Used model info */}
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

                    {/* Retry */}
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
        })}
      </div>

      {/* Bottom Input Bar */}
      <div
        style={{
          padding: "10px 14px 28px",
          background: "hsl(60 8% 96%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "hsl(0 0% 100%)",
            borderRadius: 28,
            padding: "10px 10px 10px 16px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <button
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "hsl(220 15% 35%)",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
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
            placeholder={inputText ? undefined : "Ask ChatGPT"}
            style={{
              flex: 1,
              fontSize: 15.5,
              color: "hsl(220 15% 12%)",
              border: "none",
              outline: "none",
              background: "transparent",
              padding: 0,
              letterSpacing: 0.1,
              caretColor: "hsl(142 72% 36%)",
            }}
          />

          {/* Mic icon — hidden when typing */}
          {!inputText && (
            <button
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "hsl(220 15% 35%)",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <Mic size={21} strokeWidth={1.8} />
            </button>
          )}

          {/* Send button */}
          <button
            style={{
              background: "hsl(142 72% 36%)",
              border: "none",
              borderRadius: "50%",
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
              transition: "all 0.2s ease",
            }}
            onClick={handleSend}
          >
            {inputText ? (
              /* Green up arrow when typing */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              /* Waveform icon when idle */
              <svg
                width="20"
                height="14"
                viewBox="0 0 20 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
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
      </div>
    </div>
  );
}
