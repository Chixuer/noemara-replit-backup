/**
 * Advanced settings types, storage helpers, and preset definitions.
 * All state is persisted to localStorage per model.
 */

export const CONTEXT_LIMIT_OPTIONS = [
  { value: 4,        label: "最近 4 条消息" },
  { value: 8,        label: "最近 8 条消息" },
  { value: 16,       label: "最近 16 条消息" },
  { value: -1,       label: "当前全部消息" },
  { value: "manual", label: "手动选择" },
] as const;

export type ContextLimitValue = -1 | 4 | 8 | 16 | "manual";

export const SYSTEM_PRESETS = [
  { id: "none", label: "默认", rule: "" },
  {
    id: "concise",
    label: "极简直接",
    rule: "直接回答核心问题，不重复题目，不写多余铺垫。",
  },
  {
    id: "rigorous",
    label: "严谨讲解",
    rule: "先给结论，再说明依据、限制条件和必要步骤。",
  },
  {
    id: "tutor",
    label: "教学辅导",
    rule: "用清晰、循序渐进的方式解释，避免跳步，必要时给简短例子。",
  },
  {
    id: "code_review",
    label: "代码审查",
    rule: '按"问题定位、风险等级、修改建议、涉及文件、验证步骤"输出。',
  },
  {
    id: "product",
    label: "产品设计",
    rule: '按"目标用户、核心问题、功能方案、交互流程、风险点、下一步"输出。',
  },
  {
    id: "creative",
    label: "创意策划",
    rule: "提供多个不同方向，突出差异，不要只给同义改写。",
  },
  { id: "custom", label: "自定义规则", rule: "" },
] as const;

export type SystemPresetId = (typeof SYSTEM_PRESETS)[number]["id"];

export interface AdvancedSettings {
  /** User-selected temperature. undefined = use model default */
  temperature: number | undefined;
  /** Whether the user has enabled Top P editing */
  topPEnabled: boolean;
  /** User-selected top_p. undefined = use model default */
  topP: number | undefined;
  /** System preset ID */
  systemPresetId: SystemPresetId;
  /** Custom system rule text (used when systemPresetId === 'custom') */
  customSystemRule: string;
  /** How many recent messages to include (-1 = all, "manual" = manualContextIds) */
  contextLimit: ContextLimitValue;
  /** Message IDs to include when contextLimit === "manual" */
  manualContextIds: string[];
}

const DEFAULT_SETTINGS: AdvancedSettings = {
  temperature: undefined,
  topPEnabled: false,
  topP: undefined,
  systemPresetId: "none",
  customSystemRule: "",
  contextLimit: 8,
  manualContextIds: [],
};

function storageKey(modelId: string): string {
  return `noemara_adv_${modelId}`;
}

export function loadSettings(modelId: string): AdvancedSettings {
  try {
    const raw = localStorage.getItem(storageKey(modelId));
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AdvancedSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(
  modelId: string,
  settings: AdvancedSettings
): void {
  try {
    localStorage.setItem(storageKey(modelId), JSON.stringify(settings));
  } catch {
    // ignore localStorage errors in environments where it's unavailable
  }
}

/** Get the system rule text for the current preset */
export function getSystemRule(settings: AdvancedSettings): string {
  if (settings.systemPresetId === "none") return "";
  if (settings.systemPresetId === "custom") {
    return settings.customSystemRule.trim().slice(0, 2000);
  }
  const preset = SYSTEM_PRESETS.find((p) => p.id === settings.systemPresetId);
  return preset?.rule ?? "";
}

/** Get display label for the active preset (null if none) */
export function getActivePresetLabel(
  settings: AdvancedSettings
): string | null {
  if (settings.systemPresetId === "none") return null;
  const preset = SYSTEM_PRESETS.find((p) => p.id === settings.systemPresetId);
  return preset?.label ?? null;
}

/**
 * Apply context limit to a messages array.
 * Keeps the last `limit` messages in chronological order.
 * -1 means keep all messages. "manual" means caller handles filtering — returns all.
 */
export function applyContextLimit<T>(messages: T[], limit: ContextLimitValue): T[] {
  if (limit === -1 || limit === "manual") return messages;
  if (messages.length <= (limit as number)) return messages;
  return messages.slice(-(limit as number));
}

/** Rough token estimation: ~4 chars per token */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Sum estimated tokens across a list of {role, content} messages */
export function estimateMessagesTokens(
  messages: Array<{ content: string }>
): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}
