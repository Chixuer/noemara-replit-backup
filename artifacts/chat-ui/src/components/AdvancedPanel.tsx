import { useState, useEffect } from "react";
import { X, ChevronDown, Lock } from "lucide-react";
import {
  getCapabilities,
} from "@workspace/model-capabilities";
import {
  SYSTEM_PRESETS,
  CONTEXT_LIMIT_OPTIONS,
  type AdvancedSettings,
  type ContextLimitValue,
  type SystemPresetId,
  getSystemRule,
  estimateMessagesTokens,
  estimateTokens,
} from "../lib/advanced-settings";

interface AdvancedPanelProps {
  open: boolean;
  onClose: () => void;
  modelId: string;
  settings: AdvancedSettings;
  onSettingsChange: (s: AdvancedSettings) => void;
  /** Recent messages for preview token estimation */
  apiMessages?: Array<{ role: string; content: string }>;
  thinking?: boolean;
  hasImage?: boolean;
  /** Whether multi-answer mode is currently enabled (for preview) */
  multiAnswerEnabled?: boolean;
  /** Callback to open the manual message selector modal */
  onOpenMessageSelector?: () => void;
}

const TEMP_PRESETS = [
  { label: "精确", value: 0.2 },
  { label: "平衡", value: 0.7 },
  { label: "灵感", value: 1.1 },
  { label: "发散", value: 1.4 },
  { label: "自定义", value: null },
] as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "hsl(220 9% 50%)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid hsl(0 0% 92%)", paddingTop: 14, marginBottom: 14 }}>
      <button
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          marginBottom: open ? 14 : 0,
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "hsl(220 15% 18%)",
          }}
        >
          {title}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          style={{
            color: "hsl(220 9% 50%)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>
      {open && children}
    </div>
  );
}

export default function AdvancedPanel({
  open,
  onClose,
  modelId,
  settings,
  onSettingsChange,
  apiMessages = [],
  thinking = false,
  hasImage = false,
  multiAnswerEnabled = false,
  onOpenMessageSelector,
}: AdvancedPanelProps) {
  const caps = getCapabilities(modelId);
  const [topPWarning, setTopPWarning] = useState(false);

  // Detect if current temp matches a preset
  const activePreset = TEMP_PRESETS.find(
    (p) => p.value !== null && p.value === settings.temperature
  );
  const isCustomTemp = settings.temperature !== undefined && !activePreset;

  const update = (partial: Partial<AdvancedSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  // Show top-p warning when user enables custom topP
  useEffect(() => {
    if (settings.topPEnabled && settings.topP !== undefined) {
      setTopPWarning(true);
    } else {
      setTopPWarning(false);
    }
  }, [settings.topPEnabled, settings.topP]);

  // Preview calculations
  const systemRule = getSystemRule(settings);
  const systemRuleTokens = systemRule ? estimateTokens(systemRule) : 0;
  const historyTokens = estimateMessagesTokens(apiMessages);
  const totalEstimated = systemRuleTokens + historyTokens;
  const contextCount =
    settings.contextLimit === -1
      ? apiMessages.length
      : settings.contextLimit === "manual"
        ? settings.manualContextIds.length
        : Math.min(apiMessages.length, settings.contextLimit as number);

  const activePresetObj = SYSTEM_PRESETS.find(
    (p) => p.id === settings.systemPresetId
  );

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 30,
          background: "rgba(0,0,0,0.18)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 31,
          background: "hsl(0 0% 100%)",
          borderRadius: "22px 22px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.10)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Handle bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 10px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "hsl(220 15% 10%)",
            }}
          >
            高级设置
          </span>
          <button
            style={{
              background: "hsl(0 0% 95%)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
            onClick={onClose}
          >
            <X size={16} strokeWidth={2.2} style={{ color: "hsl(220 9% 40%)" }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            padding: "8px 20px 32px",
          }}
        >
          {/* ── Temperature ── */}
          <Section title="随机度 Temperature">
            {caps?.supportsTemperature ? (
              <>
                {/* Preset chips */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  {TEMP_PRESETS.map((p) => {
                    const isActive =
                      p.value === null
                        ? isCustomTemp
                        : settings.temperature === p.value;
                    return (
                      <button
                        key={p.label}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 20,
                          border: `1.5px solid ${isActive ? "hsl(220 80% 55%)" : "hsl(0 0% 88%)"}`,
                          background: isActive
                            ? "hsl(220 80% 55%)"
                            : "hsl(0 0% 100%)",
                          color: isActive
                            ? "#fff"
                            : "hsl(220 15% 20%)",
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 400,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onClick={() => {
                          if (p.value === null) {
                            // Switch to custom: keep current value or default
                            update({
                              temperature:
                                settings.temperature ??
                                (caps.defaultTemperature ?? 1.0),
                            });
                          } else {
                            update({ temperature: p.value });
                          }
                        }}
                      >
                        {p.label}
                        {p.value !== null && (
                          <span
                            style={{
                              marginLeft: 4,
                              opacity: 0.65,
                              fontSize: 11,
                            }}
                          >
                            {p.value}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom slider — shown when Custom preset active or any value not matching presets */}
                {(isCustomTemp ||
                  TEMP_PRESETS.find(
                    (p) => p.label === "自定义" && isCustomTemp
                  )) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="range"
                      min={caps.temperatureMin ?? 0}
                      max={caps.temperatureMax ?? 2}
                      step={0.05}
                      value={settings.temperature ?? (caps.defaultTemperature ?? 1.0)}
                      style={{ flex: 1, accentColor: "hsl(220 80% 55%)" }}
                      onChange={(e) =>
                        update({ temperature: parseFloat(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      min={caps.temperatureMin ?? 0}
                      max={caps.temperatureMax ?? 2}
                      step={0.05}
                      value={
                        settings.temperature !== undefined
                          ? settings.temperature.toFixed(2)
                          : (caps.defaultTemperature ?? 1.0).toFixed(2)
                      }
                      style={{
                        width: 60,
                        padding: "4px 8px",
                        border: "1.5px solid hsl(0 0% 88%)",
                        borderRadius: 8,
                        fontSize: 13,
                        textAlign: "center",
                        outline: "none",
                      }}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) update({ temperature: v });
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    fontSize: 12,
                    color: "hsl(220 9% 55%)",
                    marginTop: 6,
                  }}
                >
                  当前值：
                  <strong>
                    {settings.temperature !== undefined
                      ? settings.temperature
                      : `默认 (${caps.defaultTemperature ?? 1.0})`}
                  </strong>
                  　范围 {caps.temperatureMin ?? 0} – {caps.temperatureMax ?? 2}
                </div>
              </>
            ) : (
              /* Locked display for models that don't support temperature */
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: "hsl(220 14% 96%)",
                  borderRadius: 12,
                }}
              >
                <Lock size={15} strokeWidth={2} style={{ color: "hsl(220 9% 50%)", flexShrink: 0 }} />
                <div>
                  <div
                    style={{ fontSize: 14, fontWeight: 600, color: "hsl(220 15% 18%)" }}
                  >
                    Temperature：{caps?.fixedTemperature ?? 1.0} 🔒
                  </div>
                  <div style={{ fontSize: 12, color: "hsl(220 9% 55%)" }}>
                    当前模型固定，无法调整
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* ── Style presets ── */}
          <Section title="回答模式">
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {SYSTEM_PRESETS.filter((p) => p.id !== "custom").map((preset) => {
                const isActive = settings.systemPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: `1.5px solid ${isActive ? "hsl(142 60% 42%)" : "hsl(0 0% 88%)"}`,
                      background: isActive
                        ? "hsl(142 60% 42%)"
                        : "hsl(0 0% 100%)",
                      color: isActive ? "#fff" : "hsl(220 15% 20%)",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() =>
                      update({
                        systemPresetId: preset.id as SystemPresetId,
                      })
                    }
                  >
                    {preset.label}
                  </button>
                );
              })}
              {/* Custom */}
              <button
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `1.5px solid ${settings.systemPresetId === "custom" ? "hsl(142 60% 42%)" : "hsl(0 0% 88%)"}`,
                  background:
                    settings.systemPresetId === "custom"
                      ? "hsl(142 60% 42%)"
                      : "hsl(0 0% 100%)",
                  color:
                    settings.systemPresetId === "custom"
                      ? "#fff"
                      : "hsl(220 15% 20%)",
                  fontSize: 13,
                  fontWeight: settings.systemPresetId === "custom" ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => update({ systemPresetId: "custom" })}
              >
                自定义规则
              </button>
            </div>

            {/* Preset description */}
            {activePresetObj && activePresetObj.id !== "none" && activePresetObj.rule && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "hsl(220 14% 96%)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "hsl(220 9% 45%)",
                  lineHeight: 1.5,
                }}
              >
                {activePresetObj.rule}
              </div>
            )}

            {/* Custom rule textarea */}
            {settings.systemPresetId === "custom" && (
              <textarea
                value={settings.customSystemRule}
                onChange={(e) =>
                  update({ customSystemRule: e.target.value.slice(0, 2000) })
                }
                placeholder="输入你的自定义系统规则（最多 2000 字符）"
                style={{
                  marginTop: 10,
                  width: "100%",
                  minHeight: 90,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1.5px solid hsl(0 0% 88%)",
                  fontSize: 13,
                  color: "hsl(220 15% 12%)",
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            )}
            {settings.systemPresetId === "custom" && (
              <div
                style={{
                  fontSize: 11,
                  color: "hsl(220 9% 60%)",
                  textAlign: "right",
                  marginTop: 4,
                }}
              >
                {settings.customSystemRule.length} / 2000
              </div>
            )}
          </Section>

          {/* ── Context limit ── */}
          <Section title="上下文范围">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CONTEXT_LIMIT_OPTIONS.map((opt) => {
                const isActive = settings.contextLimit === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: `1.5px solid ${isActive ? "hsl(35 85% 52%)" : "hsl(0 0% 88%)"}`,
                      background: isActive ? "hsl(35 85% 52%)" : "hsl(0 0% 100%)",
                      color: isActive ? "#fff" : "hsl(220 15% 20%)",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() =>
                      update({ contextLimit: opt.value as ContextLimitValue })
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {/* Manual selector trigger */}
            {settings.contextLimit === "manual" && (
              <button
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 12,
                  border: "1.5px solid hsl(220 80% 60%)",
                  background: "hsl(220 80% 97%)",
                  color: "hsl(220 60% 40%)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "100%",
                  justifyContent: "center",
                }}
                onClick={onOpenMessageSelector}
              >
                {settings.manualContextIds.length > 0
                  ? `已选 ${settings.manualContextIds.length} 条消息 — 点击修改`
                  : "选择要带入的消息…"}
              </button>
            )}
            <div style={{ fontSize: 12, color: "hsl(220 9% 55%)", marginTop: 8 }}>
              目标是让你在"连续深入讨论"和"节省 token、减少旧上下文干扰"之间自由选择。
            </div>
          </Section>

          {/* ── Advanced: Top P ── */}
          <CollapsibleSection title="高级参数">
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "hsl(220 15% 18%)",
                  }}
                >
                  Top P
                </span>
                {caps?.supportsTopP ? (
                  <button
                    style={{
                      background: settings.topPEnabled
                        ? "hsl(220 80% 55%)"
                        : "hsl(0 0% 88%)",
                      border: "none",
                      borderRadius: 20,
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: settings.topPEnabled ? "#fff" : "hsl(220 15% 30%)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() =>
                      update({ topPEnabled: !settings.topPEnabled })
                    }
                  >
                    {settings.topPEnabled ? "已开启" : "开启自定义"}
                  </button>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      color: "hsl(220 9% 55%)",
                    }}
                  >
                    <Lock size={12} />
                    {caps?.fixedTopP ?? 1.0} 🔒
                  </div>
                )}
              </div>

              {caps?.supportsTopP && settings.topPEnabled && (
                <>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <input
                      type="range"
                      min={caps.topPMin ?? 0}
                      max={caps.topPMax ?? 1}
                      step={0.01}
                      value={settings.topP ?? (caps.defaultTopP ?? 1.0)}
                      style={{ flex: 1, accentColor: "hsl(220 80% 55%)" }}
                      onChange={(e) =>
                        update({ topP: parseFloat(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={
                        settings.topP !== undefined
                          ? settings.topP.toFixed(2)
                          : (caps.defaultTopP ?? 1.0).toFixed(2)
                      }
                      style={{
                        width: 60,
                        padding: "4px 8px",
                        border: "1.5px solid hsl(0 0% 88%)",
                        borderRadius: 8,
                        fontSize: 13,
                        textAlign: "center",
                        outline: "none",
                      }}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) update({ topP: v });
                      }}
                    />
                  </div>
                  {topPWarning && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "8px 12px",
                        background: "hsl(35 85% 96%)",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "hsl(35 60% 35%)",
                        lineHeight: 1.5,
                      }}
                    >
                      ⚠️ 建议一次只调节 Temperature 或 Top P 其中一个，以避免结果不可预测。
                    </div>
                  )}
                </>
              )}

              {!caps?.supportsTopP && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "hsl(220 14% 96%)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "hsl(220 9% 50%)",
                  }}
                >
                  当前模型 Top P 固定为 {caps?.fixedTopP ?? 1.0}，无法调整。
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* ── Request preview ── */}
          <CollapsibleSection title="本次请求预览">
            <div
              style={{
                background: "hsl(220 14% 97%)",
                borderRadius: 12,
                padding: "12px 14px",
                fontSize: 12,
                color: "hsl(220 15% 25%)",
                lineHeight: 1.8,
              }}
            >
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>模型：</span>
                {modelId}
              </div>
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>回答模式：</span>
                {activePresetObj?.label ?? "默认"}
              </div>
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>Temperature：</span>
                {caps?.supportsTemperature
                  ? settings.temperature !== undefined
                    ? settings.temperature
                    : `${caps.defaultTemperature ?? 1.0}（默认）`
                  : `${caps?.fixedTemperature ?? 1.0} 🔒`}
              </div>
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>Top P：</span>
                {caps?.supportsTopP
                  ? settings.topPEnabled && settings.topP !== undefined
                    ? settings.topP
                    : `${caps.defaultTopP ?? 1.0}（默认）`
                  : `${caps?.fixedTopP ?? 1.0} 🔒`}
              </div>
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>思考模式：</span>
                {caps?.thinkingMode === "always_on"
                  ? "始终开启"
                  : thinking
                    ? "开启"
                    : "关闭"}
              </div>
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>上下文：</span>
                {settings.contextLimit === -1
                  ? `全部消息（${apiMessages.length} 条）`
                  : settings.contextLimit === "manual"
                    ? `手动选择（${contextCount} 条）`
                    : `最近 ${settings.contextLimit} 条（实际 ${contextCount} 条）`}
              </div>
              {hasImage && (
                <div>
                  <span style={{ color: "hsl(220 9% 55%)" }}>包含图片：</span>
                  是
                </div>
              )}
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>预估输入 token：</span>
                约 {totalEstimated}
              </div>
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>最大输出 token：</span>
                {caps?.maxOutputTokens
                  ? `${caps.maxOutputTokens.toLocaleString()} tokens`
                  : "模型默认"}
              </div>
              <div>
                <span style={{ color: "hsl(220 9% 55%)" }}>同题多答：</span>
                {multiAnswerEnabled ? "是" : "否"}
              </div>
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: "1px solid hsl(0 0% 90%)",
                  fontSize: 11,
                  color: "hsl(220 9% 60%)",
                }}
              >
                Token 估算基于字符数，仅供参考。不含 API Key 等敏感数据。
              </div>
            </div>
          </CollapsibleSection>

          {/* Reset button */}
          <button
            style={{
              width: "100%",
              marginTop: 8,
              padding: "10px 0",
              background: "none",
              border: "1.5px solid hsl(0 0% 88%)",
              borderRadius: 14,
              fontSize: 13,
              color: "hsl(220 9% 50%)",
              cursor: "pointer",
            }}
            onClick={() =>
              onSettingsChange({
                temperature: undefined,
                topPEnabled: false,
                topP: undefined,
                systemPresetId: "none",
                customSystemRule: "",
                contextLimit: 8,
                manualContextIds: [],
              })
            }
          >
            恢复默认
          </button>
        </div>
      </div>
    </>
  );
}
