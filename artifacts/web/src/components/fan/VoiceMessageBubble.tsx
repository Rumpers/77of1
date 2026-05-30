import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * VoiceMessageBubble — audio playback bubble for AI twin voice replies (mp3).
 *
 * Audio source: signed HMAC proxy URL (/api/voice/:jobId?exp=...&token=...)
 * Content-Type: audio/mpeg (mp3 per 03-01 contract and proxy Content-Type).
 *
 * Features:
 * - Native HTML5 <audio> with <source type="audio/mpeg"> pointing at the proxy URL.
 * - Transcript <details>/<summary> a11y fallback — screen-reader accessible.
 * - SB 243 AI disclosure footer (required per COMPLY-01).
 * - onError 409 retry: if job not yet ready, retries every 2s up to MAX_RETRIES.
 *   After MAX_RETRIES, shows "Voice unavailable — see transcript above".
 *
 * Styling matches existing fan-page bubble components (Tailwind v4 + same
 * bg/rounded conventions as MessageBubble.tsx "ai" role).
 */

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

export interface VoiceMessageBubbleProps {
  voiceUrl: string;
  transcript: string;
  /** AI disclosure footer text (SB 243 — required for visibility) */
  disclosure: string;
}

export function VoiceMessageBubble({
  voiceUrl,
  transcript,
  disclosure,
}: VoiceMessageBubbleProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // audioKey forces React to re-mount the <audio> element on each retry.
  const [audioKey, setAudioKey] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleError = useCallback(async () => {
    if (retryCount >= MAX_RETRIES) {
      setUnavailable(true);
      setRetrying(false);
      return;
    }

    // Check if the error is "job not ready" (409) or a network issue.
    // We can't read the HTTP status from an <audio> onerror event directly —
    // we infer it: if retries haven't exceeded the limit, retry optimistically
    // (the proxy returns 409 while the voice worker is still generating).
    setRetrying(true);
    retryTimerRef.current = setTimeout(() => {
      setRetryCount((prev) => prev + 1);
      setAudioKey((prev) => prev + 1); // re-mount <audio>
      setRetrying(false);
    }, RETRY_DELAY_MS);
  }, [retryCount]);

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 mt-1",
      )}
    >
      {/* Audio player */}
      <div className="max-w-[80%] px-3.5 py-2.5 rounded-[16px_16px_16px_4px] bg-[#2a2a2a]">
        {unavailable ? (
          <p className="text-[0.8125rem] text-[#888] m-0">
            Voice unavailable — see transcript above.
          </p>
        ) : retrying ? (
          <p className="text-[0.8125rem] text-[#888] m-0 animate-pulse">
            Generating voice…
          </p>
        ) : (
          <audio
            key={audioKey}
            controls
            preload="metadata"
            onError={handleError}
            className="w-full max-w-[280px] h-[36px]"
            aria-label={`Voice message: ${transcript.slice(0, 60)}${transcript.length > 60 ? "…" : ""}`}
          >
            {/* audio/mpeg = mp3 — matches proxy Content-Type and 03-01 contract */}
            <source src={voiceUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        )}

        {/* Transcript a11y fallback */}
        <details className="mt-1.5">
          <summary className="text-[0.6875rem] text-[#666] cursor-pointer select-none">
            Transcript
          </summary>
          <p className="text-[0.8125rem] text-[#bbb] mt-1 mb-0 leading-snug">
            {transcript}
          </p>
        </details>

        {/* SB 243 AI disclosure footer */}
        <p className="text-[0.6875rem] text-[#555] mt-1 mb-0">
          — {disclosure}
        </p>
      </div>
    </div>
  );
}
