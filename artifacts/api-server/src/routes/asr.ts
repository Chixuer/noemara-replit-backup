import { Router, type IRouter } from "express";
import {
  TranscribeAudioBody,
  TranscribeAudioResponse,
} from "@workspace/api-zod";

const ASR_API_URL =
  process.env.DASHSCOPE_ASR_URL ??
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

const ASR_API_KEY = process.env.DASHSCOPE_API_KEY;

const DEFAULT_HOTWORDS = [
  "DeepSeek",
  "Qwen",
  "Kimi",
  "Knowlapse",
  "知隙",
  "LaTeX",
  "函数",
  "导数",
  "椭圆",
  "抛物线",
  "化学方程式",
  "氧化还原",
  "遗传",
].join(",");

function formatToMimeType(format?: string): string {
  switch (format) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "webm":
    default:
      return "audio/webm";
  }
}

function extractText(raw: unknown): string {
  if (typeof raw !== "object" || raw == null) return "";

  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.choices)) {
    const first = r.choices[0];
    if (first && typeof first.message === "object" && first.message != null) {
      const message = first.message as Record<string, unknown>;
      if (typeof message.content === "string") return message.content;
    }
  }

  if (typeof r.text === "string") return r.text;
  if (typeof r.transcription === "string") return r.transcription;

  if (r.output && typeof r.output === "object") {
    const output = r.output as Record<string, unknown>;
    if (typeof output.text === "string") return output.text;
    if (typeof output.transcription === "string") return output.transcription;
  }

  return "";
}

const router: IRouter = Router();

router.post("/asr/transcribe", async (req, res): Promise<void> => {
  const parsed = TranscribeAudioBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid ASR request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!ASR_API_KEY) {
    req.log.error("DASHSCOPE_API_KEY is not configured");
    res.status(500).json({
      error: "ASR API key is not configured on the server",
    });
    return;
  }

  const { audio, format, hotwords } = parsed.data;

  let audioBuffer: Buffer;
  try {
    audioBuffer = Buffer.from(audio, "base64");
  } catch (err) {
    req.log.warn({ err }, "Failed to decode base64 audio");
    res.status(400).json({ error: "Invalid base64 audio data" });
    return;
  }

  if (audioBuffer.length === 0) {
    res.status(400).json({ error: "Empty audio data" });
    return;
  }

  const mimeType = formatToMimeType(format);
  const dataUri = `data:${mimeType};base64,${audioBuffer.toString("base64")}`;

  const payload: Record<string, unknown> = {
    model: "qwen3-asr-flash",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: dataUri,
            },
          },
        ],
      },
    ],
    stream: false,
    asr_options: {
      enable_itn: false,
      corpus: {
        text: hotwords && hotwords.trim() ? hotwords : DEFAULT_HOTWORDS,
      },
    },
  };

  try {
    const response = await fetch(ASR_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ASR_API_KEY}`,
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
        "ASR provider returned error",
      );
      res.status(500).json({
        error: "Transcription failed",
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

    res.json(TranscribeAudioResponse.parse({ text, raw }));
  } catch (err) {
    req.log.error({ err }, "ASR request failed");
    res.status(500).json({ error: "Transcription request failed" });
  }
});

export default router;
