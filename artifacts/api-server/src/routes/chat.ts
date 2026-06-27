import { Router, type IRouter } from "express";
import {
  ChatCompletionsBody,
  ChatCompletionsResponse,
} from "@workspace/api-zod";
import {
  getCapabilities,
  resolveTemperature,
  resolveTopP,
} from "@workspace/model-capabilities";

type Provider = "deepseek" | "qwen" | "kimi";

interface ModelConfig {
  provider: Provider;
  thinkingModel?: string;
  thinkingParam?: Record<string, unknown>;
}

const MODELS: Record<string, ModelConfig> = {
  "deepseek-v4-flash": {
    provider: "deepseek",
    thinkingModel:
      process.env.DEEPSEEK_THINKING_MODEL ?? "deepseek-reasoner",
  },
  "qwen3.7-plus": {
    provider: "qwen",
    thinkingParam: { enable_thinking: true },
  },
  "kimi-k2.7-code": {
    provider: "kimi",
  },
  "kimi-k2.7-code-highspeed": {
    provider: "kimi",
  },
};

const PROVIDER_CONFIGS: Record<
  Provider,
  { url: string; key: string | undefined }
> = {
  deepseek: {
    url: process.env.DEEPSEEK_API_URL ?? "https://api.deepseek.com/v1/chat/completions",
    key: process.env.DEEPSEEK_API_KEY,
  },
  qwen: {
    url: process.env.QWEN_API_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    key: process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY,
  },
  kimi: {
    url: process.env.KIMI_API_URL ?? "https://api.moonshot.cn/v1/chat/completions",
    key: process.env.KIMI_API_KEY,
  },
};

function extractText(raw: unknown): string {
  if (typeof raw !== "object" || raw == null) return "";
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.choices)) {
    const first = r.choices[0];
    if (first && typeof first.message === "object" && first.message != null) {
      const message = first.message as Record<string, unknown>;
      if (typeof message.content === "string") return message.content;
      if (typeof message.reasoning_content === "string")
        return message.reasoning_content;
    }
  }
  return "";
}

function extractFinishReason(raw: unknown): string | undefined {
  if (typeof raw !== "object" || raw == null) return undefined;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.choices)) {
    const first = r.choices[0] as Record<string, unknown> | undefined;
    if (first && typeof first.finish_reason === "string") {
      return first.finish_reason;
    }
  }
  return undefined;
}

const router: IRouter = Router();

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatCompletionsBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid chat request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { model, messages, thinking, temperature, topP } = parsed.data;
  const config = MODELS[model];
  if (!config) {
    res.status(400).json({ error: "Unsupported model" });
    return;
  }

  // Validate parameters against model capabilities
  const caps = getCapabilities(model);
  if (!caps) {
    res.status(400).json({ error: "Model capabilities not found" });
    return;
  }

  const providerConfig = PROVIDER_CONFIGS[config.provider];
  if (!providerConfig.key) {
    req.log.error(`${config.provider.toUpperCase()}_API_KEY is not configured`);
    res.status(500).json({
      error: `${config.provider} API key is not configured on the server`,
    });
    return;
  }

  // Validate temperature: reject if model doesn't support it and user explicitly set it
  if (temperature !== undefined && !caps.supportsTemperature) {
    req.log.warn(
      { model, temperature },
      "Client sent temperature for a model that does not support it — ignoring"
    );
  }

  // Validate topP: same check
  if (topP !== undefined && !caps.supportsTopP) {
    req.log.warn(
      { model, topP },
      "Client sent topP for a model that does not support it — ignoring"
    );
  }

  const effectiveModel =
    thinking && config.thinkingModel ? config.thinkingModel : model;

  const payload: Record<string, unknown> = {
    model: effectiveModel,
    messages,
    stream: false,
  };

  // Apply thinking params
  if (thinking && config.thinkingParam) {
    Object.assign(payload, config.thinkingParam);
  }

  // Apply temperature only if model supports it
  const resolvedTemp = resolveTemperature(model, temperature);
  if (resolvedTemp !== undefined) {
    payload.temperature = resolvedTemp;
  }

  // Apply topP only if model supports it
  const resolvedTopP = resolveTopP(model, topP);
  if (resolvedTopP !== undefined) {
    payload.top_p = resolvedTopP;
  }

  try {
    const response = await fetch(providerConfig.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerConfig.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text();
    let raw: unknown;
    try {
      raw = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      raw = { error: bodyText };
    }

    if (!response.ok) {
      req.log.error(
        { status: response.status, raw },
        `${config.provider} provider returned error`,
      );
      res.status(500).json({
        error: "Chat completion failed",
        details:
          typeof raw === "object" &&
          raw != null &&
          "error" in (raw as Record<string, unknown>)
            ? String((raw as Record<string, unknown>).error)
            : bodyText || undefined,
      });
      return;
    }

    const text = extractText(raw);
    const finishReason = extractFinishReason(raw);
    const truncated = finishReason === "length";

    res.json(
      ChatCompletionsResponse.parse({
        text,
        model,
        thinking: config.provider === "kimi" ? true : thinking,
        truncated,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Chat request failed");
    res.status(500).json({ error: "Chat request failed" });
  }
});

export default router;
