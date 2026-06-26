import {
  AlignLeft,
  ChevronRight,
  SquarePen,
  MoreHorizontal,
  Plus,
  Mic,
  Copy,
  Volume2,
  Share,
} from "lucide-react";

export default function ChatPage() {
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
        {/* Left: hamburger + title */}
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

        {/* Right: edit + more */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
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
          >
            <MoreHorizontal size={22} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div
        style={{
          flex: 1,
          padding: "8px 18px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          overflowY: "auto",
        }}
      >
        {/* User bubble - right aligned */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
            哈喽
          </div>
        </div>

        {/* AI response block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          >
            哈喽，Chi Xu！👋 今天想搞学习、做应用，还是聊点别的？
          </p>

          {/* Action icons row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginTop: 4,
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
              }}
            >
              <Copy size={18} strokeWidth={1.7} />
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
            >
              <Volume2 size={18} strokeWidth={1.7} />
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
            >
              <Share size={18} strokeWidth={1.7} />
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
            >
              <MoreHorizontal size={18} strokeWidth={1.7} />
            </button>
          </div>
        </div>
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
          {/* Plus button */}
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

          {/* Text placeholder */}
          <span
            style={{
              flex: 1,
              fontSize: 15.5,
              color: "hsl(220 9% 65%)",
              userSelect: "none",
              letterSpacing: 0.1,
            }}
          >
            Ask ChatGPT
          </span>

          {/* Mic icon */}
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

          {/* Green voice button */}
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
            }}
          >
            {/* Waveform icon */}
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
          </button>
        </div>
      </div>
    </div>
  );
}
