import { useEffect, useRef, useState, useCallback } from "react";
import { X, Square } from "lucide-react";
import { useTranscribeAudio } from "@workspace/api-client-react";

interface VoiceRecorderProps {
  onTranscribe: (text: string) => void;
  onSend: (text: string) => void;
  onCancel: () => void;
}

const BAR_COUNT = 40;
const UPDATE_INTERVAL_MS = 80;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string | null;
      if (!result) {
        reject(new Error("Failed to read audio blob"));
        return;
      }
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function detectFormat(blob: Blob): string {
  const type = blob.type;
  if (type.includes("wav")) return "wav";
  if (type.includes("mp3") || type.includes("mpeg")) return "mp3";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("webm")) return "webm";
  return "webm";
}

export default function VoiceRecorder({
  onTranscribe,
  onSend,
  onCancel,
}: VoiceRecorderProps) {
  const [volumes, setVolumes] = useState<number[]>(
    Array.from({ length: BAR_COUNT }, () => 0.05),
  );
  const [status, setStatus] = useState<"recording" | "processing" | "error">(
    "recording",
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  const transcribe = useTranscribeAudio();

  const stopRecording = useCallback(
    async (action: "fill" | "send") => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;

      setStatus("processing");

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());

      try {
        await audioContextRef.current?.close();
      } catch {
        // Ignore close errors.
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        if (audioChunksRef.current.length === 0) {
          onCancel();
          return;
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        if (!recorder || recorder.state === "inactive") {
          const chunks = audioChunksRef.current;
          if (chunks.length === 0) {
            resolve(null);
            return;
          }
          resolve(new Blob(chunks, { type: chunks[0].type }));
          return;
        }

        recorder.onstop = () => {
          const chunks = audioChunksRef.current;
          if (chunks.length === 0) {
            resolve(null);
            return;
          }
          resolve(new Blob(chunks, { type: chunks[0].type }));
        };
        recorder.stop();
      });

      if (!blob || blob.size === 0) {
        onCancel();
        return;
      }

      try {
        const base64 = await blobToBase64(blob);
        const format = detectFormat(blob);
        const result = await transcribe.mutateAsync({
          data: { audio: base64, format },
        });

        if (action === "send") {
          onSend(result.text);
        } else {
          onTranscribe(result.text);
        }
      } catch (err) {
        setStatus("error");
        setErrorText(err instanceof Error ? err.message : "语音识别失败");
      }
    },
    [onCancel, onSend, onTranscribe, transcribe],
  );

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        analyserRef.current = analyser;

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
        };

        mediaRecorder.start(100);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        intervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const average = sum / dataArray.length / 255;
          const volume = Math.max(0.05, Math.min(1, average * 2.5));
          // New samples appear on the left so the waveform scrolls to the right.
          setVolumes((prev) => [volume, ...prev.slice(0, -1)]);
        }, UPDATE_INTERVAL_MS);

        timerRef.current = setInterval(() => {
          setElapsed((e) => e + 1);
        }, 1000);
      } catch (err) {
        setStatus("error");
        setErrorText(
          err instanceof Error ? err.message : "无法访问麦克风",
        );
      }
    }

    start();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleCancel = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
    mediaRecorderRef.current?.stop();

    onCancel();
  }, [onCancel]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flex: 1,
      }}
    >
      <button
        onClick={handleCancel}
        disabled={status === "processing"}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: status === "processing" ? "default" : "pointer",
          color: "hsl(220 15% 35%)",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <X size={21} strokeWidth={1.8} />
      </button>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          overflow: "hidden",
          gap: 8,
          height: 32,
        }}
      >
        {status === "error" ? (
          <span
            style={{
              fontSize: 14,
              color: "hsl(0 70% 55%)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {errorText}
          </span>
        ) : status === "processing" ? (
          <span style={{ fontSize: 14, color: "hsl(220 9% 55%)" }}>
            识别中…
          </span>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              width: "100%",
              overflow: "hidden",
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            {volumes.map((v, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: `${8 + v * 24}px`,
                  minHeight: 4,
                  borderRadius: 2,
                  background: "hsl(220 15% 40%)",
                  flexShrink: 0,
                  transition: "height 60ms linear",
                }}
              />
            ))}
          </div>
        )}
        <span
          style={{
            fontSize: 12,
            color: "hsl(220 9% 55%)",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
            minWidth: 36,
            textAlign: "right",
          }}
        >
          {formatTime(elapsed)}
        </span>
      </div>

      <button
        onClick={() => stopRecording("fill")}
        disabled={status !== "recording"}
        style={{
          background: "hsl(220 14% 92%)",
          border: "none",
          borderRadius: "50%",
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: status !== "recording" ? "default" : "pointer",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <Square
          size={16}
          strokeWidth={2.5}
          style={{ color: "hsl(220 15% 20%)" }}
        />
      </button>

      <button
        onClick={() => stopRecording("send")}
        disabled={status !== "recording"}
        style={{
          background: "hsl(142 72% 36%)",
          border: "none",
          borderRadius: "50%",
          width: 38,
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: status !== "recording" ? "default" : "pointer",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 19V5M12 5L5 12M12 5L19 12"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
