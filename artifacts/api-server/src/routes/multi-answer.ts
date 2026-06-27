/**
 * /api/multi-answer — parallel multi-version generation.
 * Sends the same prompt to the same model with different temperature values
 * and returns all results. Each version is independent; they only differ in temperature.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  getCapabilities,
  resolveTemperature,
} from "@workspace/model-capabilities";

const MultiAnswerRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
  thinking: z.boolean().default(false),
  versions: z
    .array(
      z.object({
        label: z.string().min(1),
        temperature: z.number().min(0).max(2),
      })
    )
    .min(1)
    .max(4),
});

type Provider = "deepseek" | "qwen" | "kimi";

interface ProviderConfig {
  url: string;
  key: string | undefined;
}

const PROVIDER_URLS: Record<Provider, ProviderConfig> = {
  deepseek: {
    url:
      process.env.DEEPSEEK_API_URL ??
      "https://api.deepseek.com/v1/chat/completions",
    key: process.env.DEEPSEEK_API_KEY,
  },
  qwen: {
    url:
      process.env.QWEN_API_URL ??
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    key: process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY,
  },
  kimi: {
    url:
      process.env.KIMI_API_URL ??
      "https://api.moonshot.cn/v1/chat/completions",
    key: process.env.KIMI_API_KEY,
  },
};

const MODEL_PROVIDER_MAP: Record<string, Provider> = {
  "deepseek-v4-flash": "deepseek",
  "qwen3.7-plus": "qwen",
  "kimi-k2.7-code": "kimi",
  "kimi-k2.7-code-highspeed": "kimi",
};

function extractText(raw: unknown): string {
  if (typeof raw !== "object" || raw == null) return "";
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.choices)) {
    const first = r.choices[0] as Record<string, unknown> | undefined;
    if (first && typeof first.message === "object" && first.message != null) {
      const msg = first.message as Record<string, unknown>;
      if (typeof msg.content === "string") return msg.content;
      if (typeof msg.reasoning_content === "string")
        return msg.reasoning_content;
    }
  }
  return "";
}

async function callModel(
  provider: Provider,
  payload: Record<string, unknown>
): Promise<{ text: string; error?: string }> {
  const cfg = PROVIDER_URLS[provider];
  if (!cfg.key) {
    return { text: "", error: `${provider} API key not configured` };
  }
  try {
    const resp = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const bodyText = await resp.text();
    let raw: unknown;
    try {
      raw = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      raw = { error: bodyText };
    }
    if (!resp.ok) {
      const errMsg =
        raw != null &&
        typeof raw === "object" &&
        "error" in (raw as Record<string, unknown>)
          ? String((raw as Record<string, unknown>).error)
          : bodyText || "Unknown error";
      return { text: "", error: errMsg };
    }
    return { text: extractText(raw) };
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : "Request failed" };
  }
}

const router: IRouter = Router();

router.post("/multi-answer", async (req, res): Promise<void> => {
  const parsed = MultiAnswerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { model, messages, thinking, versions } = parsed.data;
  const caps = getCapabilities(model);

  if (!caps) {
    res.status(400).json({ error: "Unsupported model" });
    return;
  }

  if (!caps.supportsMultiAnswer || !caps.supportsTemperature) {
    res.status(400).json({
      error: "当前模型参数固定，无法生成不同随机度版本。",
    });
    return;
  }

  const provider = MODEL_PROVIDER_MAP[model];
  if (!provider) {
    res.status(400).json({ error: "Unknown model provider" });
    return;
  }

  // Build the thinking extra param if needed
  const thinkingParam: Record<string, unknown> = {};
  if (thinking) {
    if (model === "qwen3.7-plus") {
      thinkingParam.enable_thinking = true;
    }
  }

  // Fire all versions in parallel
  const results = await Promise.all(
    versions.map(async (version) => {
      const temperature = resolveTemperature(model, version.temperature);
      const payload: Record<string, unknown> = {
        model,
        messages,
        stream: false,
        ...thinkingParam,
      };
      if (temperature !== undefined) {
        payload.temperature = temperature;
      }

      const { text, error } = await callModel(provider, payload);
      return {
        label: version.label,
        temperature: version.temperature,
        text,
        model,
        error,
      };
    })
  );

  res.json({ results });
});

export default router;
