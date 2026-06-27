import { useState } from "react";
import { X, Check } from "lucide-react";

export interface SelectorMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

interface MessageSelectorProps {
  open: boolean;
  messages: SelectorMessage[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

export default function MessageSelector({
  open,
  messages,
  selectedIds,
  onConfirm,
  onClose,
}: MessageSelectorProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));

  if (!open) return null;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setChecked(new Set(messages.map((m) => m.id)));
  const clearAll = () => setChecked(new Set());

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 430,
          maxHeight: "72vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 18px 12px",
            borderBottom: "1px solid hsl(0 0% 92%)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "hsl(220 15% 10%)" }}>
              手动选择上下文
            </div>
            <div style={{ fontSize: 12, color: "hsl(220 9% 55%)", marginTop: 2 }}>
              已选 {checked.size} / {messages.length} 条消息
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={{ fontSize: 12, color: "hsl(220 60% 50%)", background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}
              onClick={selectAll}
            >
              全选
            </button>
            <button
              style={{ fontSize: 12, color: "hsl(220 9% 55%)", background: "none", border: "none", cursor: "pointer", padding: "4px 6px" }}
              onClick={clearAll}
            >
              清空
            </button>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "hsl(220 9% 45%)", display: "flex" }}
              onClick={onClose}
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* Message list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "hsl(220 9% 55%)", fontSize: 14 }}>
              暂无历史消息
            </div>
          ) : (
            messages.map((m) => {
              const isChecked = checked.has(m.id);
              const roleLabel = m.role === "user" ? "你" : "AI";
              const roleColor =
                m.role === "user" ? "hsl(142 55% 38%)" : "hsl(220 60% 50%)";
              return (
                <button
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    width: "100%",
                    padding: "10px 18px",
                    background: isChecked ? "hsl(220 80% 97%)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid hsl(0 0% 95%)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.12s ease",
                  }}
                  onClick={() => toggle(m.id)}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: `2px solid ${isChecked ? "hsl(220 80% 55%)" : "hsl(0 0% 78%)"}`,
                      background: isChecked ? "hsl(220 80% 55%)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                      transition: "all 0.12s ease",
                    }}
                  >
                    {isChecked && <Check size={12} strokeWidth={3} style={{ color: "#fff" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: roleColor, marginBottom: 3 }}>
                      {roleLabel}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "hsl(220 15% 20%)",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {m.text || "(空)"}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 18px 28px",
            borderTop: "1px solid hsl(0 0% 92%)",
            display: "flex",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 14,
              border: "1.5px solid hsl(0 0% 85%)",
              background: "none",
              fontSize: 15,
              fontWeight: 600,
              color: "hsl(220 15% 30%)",
              cursor: "pointer",
            }}
            onClick={onClose}
          >
            取消
          </button>
          <button
            style={{
              flex: 2,
              padding: "12px 0",
              borderRadius: 14,
              border: "none",
              background: checked.size === 0 ? "hsl(0 0% 88%)" : "hsl(220 80% 55%)",
              fontSize: 15,
              fontWeight: 600,
              color: checked.size === 0 ? "hsl(220 9% 55%)" : "#fff",
              cursor: checked.size === 0 ? "not-allowed" : "pointer",
              transition: "background 0.15s ease",
            }}
            disabled={checked.size === 0}
            onClick={() => onConfirm(Array.from(checked))}
          >
            确认选择 {checked.size > 0 ? `（${checked.size} 条）` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
