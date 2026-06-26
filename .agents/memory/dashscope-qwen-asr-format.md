---
name: DashScope Qwen ASR payload format
description: How to call the qwen3-asr-flash ASR model through DashScope, including the correct endpoint and audio payload shape.
---

# DashScope Qwen ASR payload format

## Rule

Call `qwen3-asr-flash` for short-audio transcription through the **OpenAI-compatible chat completions endpoint**, not the native DashScope `/services/audio/asr/transcription` endpoint.

- Endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- Model: `qwen3-asr-flash`
- Audio is sent as a data URI inside the `input_audio` content item of a `messages` payload.

## Why

The native `/api/v1/services/audio/asr/transcription` endpoint returns `InvalidParameter: url error, please check url` for this model. The sync ASR docs on Qwen Cloud explicitly show the chat-completions-style request with `input_audio`.

## How to apply

```json
{
  "model": "qwen3-asr-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_audio",
          "input_audio": {
            "data": "data:audio/wav;base64,<base64-audio>"
          }
        }
      ]
    }
  ],
  "stream": false,
  "asr_options": {
    "enable_itn": false
  }
}
```

The transcription result is in `choices[0].message.content` of the chat completion response.

## Hotwords / corpus

Use `asr_options.corpus.text` to pass a string of hotwords for ASR, instead of a standalone `hotwords` field.

```json
"asr_options": {
  "enable_itn": false,
  "corpus": {
    "text": "DeepSeek, Qwen, Kimi, LaTeX, 函数, 导数, 椭圆, 抛物线, 化学方程式"
  }
}
```

## Important distinction

Keep `qwen3-asr-flash` (the ASR model) separate from the Qwen chat model that will be added later for AI dialogue. They use the same chat-completions endpoint shape but are different `model` values and different product concerns.
