/**
 * Unified model capability definitions.
 * This is the single source of truth for what each model supports.
 * Backend and frontend both import from here — parameters must
 * never be hardcoded or scattered in components.
 */

export type ModelId =
  | "deepseek-v4-flash"
  | "qwen3.7-plus"
  | "kimi-k2.7-code"
  | "kimi-k2.7-code-highspeed";

export type Provider = "deepseek" | "qwen" | "kimi";

/** How thinking/reasoning mode works for this model */
export type ThinkingMode =
  | "supported"   // user can toggle on/off
  | "always_on"   // model always uses deep thinking, no toggle
  | "fixed"       // thinking disabled, user cannot change
  | "unsupported";

export interface ModelCapabilities {
  modelId: ModelId;
  provider: Provider;
  displayName: string;

  // Temperature
  supportsTemperature: boolean;
  temperatureMin?: number;
  temperatureMax?: number;
  defaultTemperature?: number;
  /** If !supportsTemperature, this is the fixed value the provider uses */
  fixedTemperature?: number;

  // Top P
  supportsTopP: boolean;
  topPMin?: number;
  topPMax?: number;
  defaultTopP?: number;
  /** If !supportsTopP, this is the fixed value the provider uses */
  fixedTopP?: number;

  // Thinking / reasoning
  thinkingMode: ThinkingMode;

  // Whether multi-answer (temperature sweep) is allowed
  supportsMultiAnswer: boolean;
}

export const MODEL_CAPABILITIES: Record<ModelId, ModelCapabilities> = {
  "deepseek-v4-flash": {
    modelId: "deepseek-v4-flash",
    provider: "deepseek",
    displayName: "deepseek-v4-flash",
    supportsTemperature: true,
    temperatureMin: 0,
    temperatureMax: 2,
    defaultTemperature: 1.0,
    supportsTopP: true,
    topPMin: 0,
    topPMax: 1,
    defaultTopP: 1.0,
    thinkingMode: "supported",
    supportsMultiAnswer: true,
  },
  "qwen3.7-plus": {
    modelId: "qwen3.7-plus",
    provider: "qwen",
    displayName: "qwen3.7-plus",
    supportsTemperature: true,
    temperatureMin: 0,
    temperatureMax: 2,
    defaultTemperature: 0.7,
    supportsTopP: true,
    topPMin: 0,
    topPMax: 1,
    defaultTopP: 1.0,
    thinkingMode: "supported",
    supportsMultiAnswer: true,
  },
  "kimi-k2.7-code": {
    modelId: "kimi-k2.7-code",
    provider: "kimi",
    displayName: "kimi-k2.7-code",
    supportsTemperature: false,
    fixedTemperature: 1.0,
    supportsTopP: false,
    fixedTopP: 1.0,
    thinkingMode: "always_on",
    supportsMultiAnswer: false,
  },
  "kimi-k2.7-code-highspeed": {
    modelId: "kimi-k2.7-code-highspeed",
    provider: "kimi",
    displayName: "kimi-k2.7-code-highspeed",
    supportsTemperature: false,
    fixedTemperature: 1.0,
    supportsTopP: false,
    fixedTopP: 1.0,
    thinkingMode: "always_on",
    supportsMultiAnswer: false,
  },
};

export function getCapabilities(modelId: string): ModelCapabilities | undefined {
  return MODEL_CAPABILITIES[modelId as ModelId];
}

/**
 * Resolve effective temperature for a model.
 * Returns undefined if the model doesn't support temperature (caller should omit it).
 * Returns fixed value if supportsTemperature is false (should still not be sent to API).
 * Clamps the user-requested value to the model's allowed range.
 */
export function resolveTemperature(
  modelId: string,
  requested: number | undefined
): number | undefined {
  const caps = getCapabilities(modelId);
  if (!caps || !caps.supportsTemperature) return undefined;
  const value = requested ?? caps.defaultTemperature ?? 1.0;
  const min = caps.temperatureMin ?? 0;
  const max = caps.temperatureMax ?? 2;
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolve effective top_p for a model.
 * Returns undefined if the model doesn't support top_p.
 */
export function resolveTopP(
  modelId: string,
  requested: number | undefined
): number | undefined {
  const caps = getCapabilities(modelId);
  if (!caps || !caps.supportsTopP) return undefined;
  const value = requested ?? caps.defaultTopP ?? 1.0;
  const min = caps.topPMin ?? 0;
  const max = caps.topPMax ?? 1;
  return Math.min(max, Math.max(min, value));
}

/** List all model IDs */
export const ALL_MODEL_IDS: ModelId[] = [
  "deepseek-v4-flash",
  "qwen3.7-plus",
  "kimi-k2.7-code",
  "kimi-k2.7-code-highspeed",
];
