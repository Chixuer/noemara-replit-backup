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

function buildPayload(
  model: string,
  config: ModelConfig,
  messages: unknown,
  thinking: boolean | undefined,
  temperature: number | undefined,
  topP: number | undefined,
  stream: boolean,
): Record<string, unknown> {
  const effectiveModel =
    thinking && config.thinkingModel ? config.thinkingModel : model;

  const payload: Record<string, unknown> = {
    model: effectiveModel,
    messages,
    stream,
  };

  if (thinking && config.thinkingParam) {
    Object.assign(payload, config.thinkingParam);
  }

  const resolvedTemp = resolveTemperature(model, temperature);
  if (resolvedTemp !== undefined) payload.temperature = resolvedTemp;

  const resolvedTopP = resolveTopP(model, topP);
  if (resolvedTopP !== undefined) payload.top_p = resolvedTopP;

  return payload;
}

function validateRequest(
  model: string,
  config: ModelConfig | undefined,
  caps: ReturnType<typeof getCapabilities>,
  providerKey: string | undefined,
  temperature: number | undefined,
  topP: number | undefined,
  log: { warn: (obj: object, msg: string) => void; error: (msg: string) => void },
): string | null {
  if (!config) return "Unsupported model";
  if (!caps) return "Model capabilities not found";
  if (!providerKey) {
    log.error(`${config.provider.toUpperCase()}_API_KEY is not configured`);
    return `${config.provider} API key is not configured on the server`;
  }
  if (temperature !== undefined && !caps.supportsTemperature) {
    log.warn({ model, temperature }, "Client sent temperature for a model that does not support it — ignoring");
  }
  if (topP !== undefined && !caps.supportsTopP) {
    log.warn({ model, topP }, "Client sent topP for a model that does not support it — ignoring");
  }
  return null;
}

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

// ─── Non-streaming endpoint ───────────────────────────────────────────────────

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatCompletionsBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid chat request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { model, messages, thinking, temperature, topP } = parsed.data;
  const config = MODELS[model];
  const caps = getCapabilities(model);
  const providerConfig = PROVIDER_CONFIGS[config?.provider as Provider] ?? { url: "", key: undefined };

  const validationError = validateRequest(model, config, caps, providerConfig.key, temperature, topP, req.log);
  if (validationError) {
    res.status(config && caps ? 500 : 400).json({ error: validationError });
    return;
  }

  const payload = buildPayload(model, config, messages, thinking, temperature, topP, false);

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

// ─── Streaming endpoint (SSE) ─────────────────────────────────────────────────

router.post("/chat/stream", async (req, res): Promise<void> => {
  const parsed = ChatCompletionsBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid chat/stream request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { model, messages, thinking, temperature, topP } = parsed.data;
  const config = MODELS[model];
  const caps = getCapabilities(model);
  const providerConfig = PROVIDER_CONFIGS[config?.provider as Provider] ?? { url: "", key: undefined };

  const validationError = validateRequest(model, config, caps, providerConfig.key, temperature, topP, req.log);
  if (validationError) {
    res.status(config && caps ? 500 : 400).json({ error: validationError });
    return;
  }

  const payload = buildPayload(model, config, messages, thinking, temperature, topP, true);

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const response = await fetch(providerConfig.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerConfig.key}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      let errorMsg = "Chat completion failed";
      try {
        const raw = JSON.parse(bodyText) as Record<string, unknown>;
        if (typeof raw.error === "string") errorMsg = raw.error;
        else if (raw.error) errorMsg = JSON.stringify(raw.error);
      } catch { /* ignore */ }
      req.log.error({ status: response.status }, `${config.provider} streaming error`);
      sendEvent({ type: "error", message: errorMsg });
      res.end();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      sendEvent({ type: "error", message: "No response body from provider" });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finishReason: string | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;

          let chunk: Record<string, unknown>;
          try {
            chunk = JSON.parse(data) as Record<string, unknown>;
          } catch {
            continue;
          }

          const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
          if (!choices?.length) continue;

          const choice = choices[0] as Record<string, unknown>;
          const delta = choice.delta as Record<string, unknown> | undefined;
          const fr = choice.finish_reason as string | null | undefined;
          if (fr) finishReason = fr;

          if (typeof delta?.reasoning_content === "string" && delta.reasoning_content) {
            sendEvent({ type: "thinking", delta: delta.reasoning_content });
          }
          if (typeof delta?.content === "string" && delta.content) {
            sendEvent({ type: "text", delta: delta.content });
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    sendEvent({ type: "done", truncated: finishReason === "length" });
  } catch (err) {
    req.log.error({ err }, "Chat streaming request failed");
    if (!res.writableEnded) {
      sendEvent({ type: "error", message: "Chat streaming failed" });
    }
  } finally {
    res.end();
  }
});

export default router;
