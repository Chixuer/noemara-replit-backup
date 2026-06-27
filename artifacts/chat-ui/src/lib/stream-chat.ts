/**
 * streamChat — consume the /api/chat/stream SSE endpoint and surface
 * content deltas as they arrive.
 *
 * Events emitted by the server:
 *   {"type":"thinking","delta":"..."}  — reasoning content (hidden from user)
 *   {"type":"text","delta":"..."}      — main answer content
 *   {"type":"done","truncated":bool}   — stream finished
 *   {"type":"error","message":"..."}   — server-side error
 */

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

export interface StreamChatOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  thinking: boolean;
  temperature?: number;
  topP?: number;
  /** Called for each content delta. isThinking=true means reasoning content. */
  onChunk: (delta: string, isThinking: boolean) => void;
  /** Called once when the stream ends normally. */
  onDone: (truncated: boolean) => void;
  /** Called on error (network, server, or parse error). */
  onError: (message: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        thinking: opts.thinking,
        temperature: opts.temperature,
        topP: opts.topP,
      }),
      signal: opts.signal,
    });
  } catch (err) {
    opts.onError(err instanceof Error ? err.message : "网络请求失败");
    return;
  }

  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch { /* ignore */ }
    opts.onError(message);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    opts.onError("无法读取响应流");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let doneSeen = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          continue;
        }

        switch (event.type) {
          case "thinking":
            if (typeof event.delta === "string") opts.onChunk(event.delta, true);
            break;
          case "text":
            if (typeof event.delta === "string") opts.onChunk(event.delta, false);
            break;
          case "done":
            doneSeen = true;
            opts.onDone(event.truncated === true);
            break;
          case "error":
            opts.onError(typeof event.message === "string" ? event.message : "未知错误");
            return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!doneSeen) {
    // Stream ended without a done event — treat as complete
    opts.onDone(false);
  }
}
