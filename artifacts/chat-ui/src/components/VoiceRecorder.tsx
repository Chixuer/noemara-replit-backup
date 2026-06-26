import { useEffect, useRef, useState, useCallback } from "react";
import { X, Square } from "lucide-react";
import { useTranscribeAudio } from "@workspace/api-client-react";

interface VoiceRecorderProps {
  onTranscribe: (text: string) => void;
  onSend: (text: string) => void;
  onCancel: () => void;
}

const BAR_COUNT = 36;
const UPDATE_INTERVAL_MS = 65;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string | null;
      if (!result) { reject(new Error("Failed to read audio blob")); return; }
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
  return "webm";
}

export default function VoiceRecorder({ onTranscribe, onSend, onCancel }: VoiceRecorderProps) {
  const [volumes, setVolumes] = useState<number[]>(
    Array.from({ length: BAR_COUNT }, () => 0.06)
  );
  const [status, setStatus] = useState<"recording" | "processing" | "error">("recording");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);
  // Smoothing: keep a running average of the last few volume readings
  const smoothVolumeRef = useRef(0.06);

  const transcribe = useTranscribeAudio();

  const stopRecording = useCallback(
    async (action: "fill" | "send") => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;

      setStatus("processing");

      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      try { await audioContextRef.current?.close(); } catch { /* ignore */ }

      const recorder = mediaRecorderRef.current;

      const blob = await new Promise<Blob | null>((resolve) => {
        if (!recorder || recorder.state === "inactive") {
          const chunks = audioChunksRef.current;
          resolve(chunks.length === 0 ? null : new Blob(chunks, { type: chunks[0]?.type ?? "audio/webm" }));
          return;
        }
        recorder.onstop = () => {
          const chunks = audioChunksRef.current;
          resolve(chunks.length === 0 ? null : new Blob(chunks, { type: chunks[0]?.type ?? "audio/webm" }));
        };
        recorder.stop();
      });

      if (!blob || blob.size === 0) { onCancel(); return; }

      try {
        const base64 = await blobToBase64(blob);
        const format = detectFormat(blob);
        const result = await transcribe.mutateAsync({ data: { audio: base64, format } });
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
    [onCancel, onSend, onTranscribe, transcribe]
  );

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);

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
          // Use a weighted RMS of the lower 2/3 of frequency bins (speech range)
          const speechBins = dataArray.slice(0, Math.floor(dataArray.length * 0.65));
          const rms = Math.sqrt(
            speechBins.reduce((sum, v) => sum + (v / 255) ** 2, 0) / speechBins.length
          );
          const raw = Math.max(0.06, Math.min(1, rms * 3.2));
          // Exponential moving average for smoothing
          smoothVolumeRef.current = smoothVolumeRef.current * 0.55 + raw * 0.45;
          const v = smoothVolumeRef.current;
          // Add slight random jitter so bars look alive even in silence
          setVolumes((prev) => {
            const jitter = () => Math.max(0.04, Math.min(1, v + (Math.random() - 0.5) * 0.06));
            return [jitter(), ...prev.slice(0, -1)];
          });
        }, UPDATE_INTERVAL_MS);

        timerRef.current = setInterval(() => {
          setElapsed((e) => e + 1);
        }, 1000);
      } catch (err) {
        setStatus("error");
        setErrorText(err instanceof Error ? err.message : "无法访问麦克风");
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
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleCancel = useCallback(() => {
    if (status === "error") { onCancel(); return; }
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
    mediaRecorderRef.current?.stop();
    onCancel();
  }, [onCancel, status]);

  return (
    <div className="anim-voice-enter" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
      {/* Cancel */}
      <button
        className="btn-circle"
        onClick={handleCancel}
        disabled={status === "processing"}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: status === "processing" ? "default" : "pointer",
          color: "hsl(220 15% 38%)",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          opacity: status === "processing" ? 0.4 : 1,
          transition: "opacity 0.2s ease",
        }}
      >
        <X size={21} strokeWidth={1.8} />
      </button>

      {/* Middle: waveform / status */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          overflow: "hidden",
          gap: 8,
          height: 34,
        }}
      >
        {status === "error" ? (
          <span
            style={{
              fontSize: 14,
              color: "hsl(0 70% 52%)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              animation: "fadeInUp 0.25s var(--ease-out) both",
            }}
          >
            {errorText}
          </span>
        ) : status === "processing" ? (
          <span
            style={{
              fontSize: 14,
              color: "hsl(220 9% 50%)",
              flex: 1,
              animation: "fadeInUp 0.25s var(--ease-out) both",
            }}
          >
            识别中…
          </span>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2.5,
              flex: 1,
              overflow: "hidden",
              maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
            }}
          >
            {volumes.map((v, i) => (
              <div
                key={i}
                className="wave-bar"
                style={{
                  height: `${5 + v * 26}px`,
                  opacity: 0.7 + v * 0.3,
                }}
              />
            ))}
          </div>
        )}

        <span
          style={{
            fontSize: 12,
            color: "hsl(220 9% 52%)",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
            minWidth: 36,
            textAlign: "right",
            transition: "opacity 0.3s ease",
            opacity: status === "error" ? 0 : 1,
          }}
        >
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Stop → fill input */}
      <button
        className="btn-circle"
        onClick={() => stopRecording("fill")}
        disabled={status !== "recording"}
        style={{
          background: status !== "recording" ? "hsl(220 14% 88%)" : "hsl(220 14% 92%)",
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
          transition: "background 0.2s ease, opacity 0.2s ease",
          opacity: status !== "recording" ? 0.45 : 1,
        }}
      >
        <Square size={15} strokeWidth={2.5} style={{ color: "hsl(220 15% 22%)" }} />
      </button>

      {/* Send directly */}
      <button
        className="btn-circle"
        onClick={() => stopRecording("send")}
        disabled={status !== "recording"}
        style={{
          background: status !== "recording" ? "hsl(142 55% 44%)" : "hsl(142 72% 36%)",
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
          transition: "background 0.2s ease, opacity 0.2s ease",
          opacity: status !== "recording" ? 0.5 : 1,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
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
