---
name: Streaming chat implementation
description: How SSE streaming is wired between the API server and chat UI
---

## Architecture

**Backend** (`artifacts/api-server/src/routes/chat.ts`):
- `POST /api/chat/stream` — new SSE endpoint alongside the non-streaming `POST /api/chat`
- Sets `Content-Type: text/event-stream`, `X-Accel-Buffering: no`
- Calls provider with `stream: true`, reads SSE chunks via `response.body.getReader()`
- Emits `data: {"type":"thinking","delta":"..."}` for `delta.reasoning_content`
- Emits `data: {"type":"text","delta":"..."}` for `delta.content`
- Emits `data: {"type":"done","truncated":bool}` on finish
- Emits `data: {"type":"error","message":"..."}` on error

**Frontend helper** (`artifacts/chat-ui/src/lib/stream-chat.ts`):
- `streamChat(opts)` — fetch + ReadableStream consumer, parses SSE lines, calls `onChunk/onDone/onError` callbacks

**Frontend page** (`artifacts/chat-ui/src/pages/ChatPage.tsx`):
- `doStreamCall(newMessages, userMsgId, userMsgText, convId, now)` — shared async helper used by handleSend, handleVoiceSend
- Creates placeholder `{id, role:"ai", text:"", streaming:true, thinking}` immediately
- Updates `text` on each non-thinking chunk via `setConversations` functional update
- Finalises message with `streaming:false` after stream ends
- `handleContinueGeneration` uses `streamChat` directly (appends to existing message)

**Message display** (`ChatPage.tsx` render):
- `msg.thinking && !msg.streaming` → "Thought for a second" label
- `msg.streaming && msg.thinking && !msg.text` → "思考中…" placeholder  
- Otherwise → `{msg.text}{msg.streaming && <span>▌</span>}` (cursor when streaming)
- Loading dots bubble hidden when any message has `streaming:true`

**Why:** DeepSeek v4-flash sends `reasoning_content` chunks even without thinking mode toggled — these are filtered on the frontend (`onChunk` ignores `isThinking=true` when `useThinking=false`).
