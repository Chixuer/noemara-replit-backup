# Noemara Chat UI

A mobile-first AI chat interface with real voice-to-text input powered by Qwen ASR.

## Run & Operate

- `pnpm --filter @workspace/chat-ui run dev` — run the Chat UI
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; `DASHSCOPE_API_KEY` — DashScope API key for ASR (server-side only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- UI: React + Vite + Tailwind CSS + shadcn/ui components
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- ASR: DashScope compatible-mode chat completions (`qwen3-asr-flash`)
- Build: esbuild (CJS bundle for API server), Vite build for UI

## Where things live

- API contract: `lib/api-spec/openapi.yaml`
- Generated React Query hooks: `lib/api-client-react/src/generated/`
- Generated Zod schemas: `lib/api-zod/src/generated/`
- API routes: `artifacts/api-server/src/routes/`
- ASR route: `artifacts/api-server/src/routes/asr.ts`
- Chat UI entry: `artifacts/chat-ui/src/App.tsx`
- Chat page: `artifacts/chat-ui/src/pages/ChatPage.tsx`
- Voice recorder component: `artifacts/chat-ui/src/components/VoiceRecorder.tsx`
- Theme / CSS tokens: `artifacts/chat-ui/src/index.css`
- DB schema: `lib/db/src/schema/`

## Architecture decisions

- **Contract-first API:** all backend/frontend interfaces are generated from `lib/api-spec/openapi.yaml` so types and validation stay in sync.
- **Server-side ASR secret:** `DASHSCOPE_API_KEY` is read only in the API server; the frontend never sees the key. Audio is sent to the backend as base64, and the backend forwards it to DashScope.
- **ASR model is separate from chat model:** `qwen3-asr-flash` is used only for speech-to-text, leaving room for a different Qwen model to handle the actual AI dialogue.
- **Voice recorder is self-contained:** recording, waveform animation, transcription, and action callbacks are handled inside `VoiceRecorder.tsx`; the parent only manages the resulting text.
- **Base64 audio transport:** keeps the OpenAPI contract simple (JSON) and avoids multipart complexity in generated clients.

## Product

Noemara is a conversational AI app. Users can type messages or tap the microphone to record voice input. The app visualizes the microphone volume as a scrolling waveform, then transcribes the recording with Qwen ASR and either fills the input box for editing or sends the text directly.

## User preferences

- Voice input uses Qwen ASR (`qwen3-asr-flash`) via the server-side DashScope API key.
- Default ASR hotwords are configured for math/chemistry/academic terms.
- After recording, the transcribed text is placed in the input box by default; the send button can also send it directly.

## Gotchas

- Re-run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change.
- The API server must be restarted for `DASHSCOPE_API_KEY` changes to take effect.
- Voice recording requires microphone permission and HTTPS/localhost; the Replit preview uses HTTPS, so permission prompts should work as expected.
- If you add more ASR models later, keep the ASR model separate from the chat AI model to avoid confusion.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- See the `artifacts` skill for creating new artifacts or changing artifact service configuration.
