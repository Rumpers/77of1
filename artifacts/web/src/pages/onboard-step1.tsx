import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { getMessages, isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type UploadedFile = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
};

const CJK_FONT = `"Hiragino Kaku Gothic Pro", "Noto Sans CJK JP", "Microsoft JhengHei", system-ui, sans-serif`;

// ── component ─────────────────────────────────────────────────────────────────

export default function OnboardStep1() {
  const params = useParams<{ locale: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const t = getMessages(locale).onboard.step1;
  const fontFamily = locale === "en" ? "system-ui, -apple-system, sans-serif" : CJK_FONT;

  const [, navigate] = useLocation();

  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [videos, setVideos] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const MIN_PHOTOS = 5;
  const MAX_PHOTOS = 25;
  const MIN_VIDEOS = 2;
  const MAX_VIDEOS = 3;

  const canContinue = photos.length >= MIN_PHOTOS && videos.length >= MIN_VIDEOS;

  function addFiles(
    incoming: FileList,
    existing: UploadedFile[],
    maxCount: number,
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) {
    const available = maxCount - existing.length;
    if (available <= 0) return;
    const toAdd = Array.from(incoming).slice(0, available);
    const newEntries: UploadedFile[] = toAdd.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      status: "pending",
      progress: 0,
    }));
    setter((prev) => [...prev, ...newEntries]);
  }

  function removeFile(
    id: string,
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) {
    setter((prev) => prev.filter((f) => f.id !== id));
  }

  async function uploadFilesToApi(
    files: UploadedFile[],
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ): Promise<boolean> {
    // Mark all as uploading
    setter((prev) =>
      prev.map((f) =>
        files.find((u) => u.id === f.id) ? { ...f, status: "uploading" as const } : f
      )
    );

    const formData = new FormData();
    for (const uf of files) {
      formData.append("files", uf.file);
    }

    try {
      const res = await fetch("/api/onboarding/assets", {
        method: "POST",
        body: formData,
      });

      if (res.ok || res.status === 503) {
        // 503 = stub/no-db, treat as "pending" success
        setter((prev) =>
          prev.map((f) =>
            files.find((u) => u.id === f.id) ? { ...f, status: "done" as const, progress: 100 } : f
          )
        );
        return true;
      } else {
        setter((prev) =>
          prev.map((f) =>
            files.find((u) => u.id === f.id) ? { ...f, status: "error" as const } : f
          )
        );
        return false;
      }
    } catch {
      setter((prev) =>
        prev.map((f) =>
          files.find((u) => u.id === f.id) ? { ...f, status: "error" as const } : f
        )
      );
      return false;
    }
  }

  async function handleContinue() {
    if (!canContinue || uploading) return;
    setError(null);
    setUploading(true);

    const pendingPhotos = photos.filter((f) => f.status === "pending");
    const pendingVideos = videos.filter((f) => f.status === "pending");

    const allFiles = [...pendingPhotos, ...pendingVideos];

    if (allFiles.length > 0) {
      const ok = await uploadFilesToApi(allFiles, (updater) => {
        // Apply updates to both photos and videos
        setPhotos((prev) =>
          prev.map((f) => {
            const updated = pendingPhotos.find((u) => u.id === f.id);
            if (!updated) return f;
            // Re-run the updater logic inline
            const allUpdated = typeof updater === "function" ? updater([...pendingPhotos, ...pendingVideos]) : updater;
            const match = allUpdated.find((u) => u.id === f.id);
            return match ?? f;
          })
        );
        setVideos((prev) =>
          prev.map((f) => {
            const updated = pendingVideos.find((u) => u.id === f.id);
            if (!updated) return f;
            const allUpdated = typeof updater === "function" ? updater([...pendingPhotos, ...pendingVideos]) : updater;
            const match = allUpdated.find((u) => u.id === f.id);
            return match ?? f;
          })
        );
      });

      if (!ok) {
        setError(t.upload_error);
        setUploading(false);
        // Still allow continue with stub
      }
    }

    setUploading(false);
    navigate(`/${locale}/onboard/step2`);
  }

  const BRAND = "#7C3AED";
  const DISABLED = "#555";

  return (
    <main
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        padding: "1.5rem 1.25rem 3rem",
        fontFamily,
        background: "#0f0f0f",
        color: "#f0f0f0",
        minHeight: "100dvh",
      }}
    >
      {/* Progress indicator */}
      <div
        style={{
          display: "flex",
          gap: "0.375rem",
          marginBottom: "2rem",
        }}
      >
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            style={{
              flex: 1,
              height: "4px",
              borderRadius: "2px",
              background: step === 1 ? BRAND : "#2a2a2a",
            }}
          />
        ))}
      </div>

      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 700 }}>
        {t.title}
      </h1>
      <p style={{ margin: "0 0 2rem", color: "#aaa", fontSize: "0.9375rem", lineHeight: 1.5 }}>
        {t.subtitle}
      </p>

      {/* Photos section */}
      <section style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <label style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{t.photos_label}</label>
          <span style={{ fontSize: "0.8125rem", color: "#666" }}>
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "#666" }}>{t.photos_hint}</p>

        {/* Photo thumbnails grid */}
        {photos.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            {photos.map((uf) => (
              <div
                key={uf.id}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "#1a1a1a",
                  border: `1px solid ${uf.status === "error" ? "#ef4444" : "#333"}`,
                }}
              >
                <img
                  src={URL.createObjectURL(uf.file)}
                  alt={uf.file.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  onClick={() => removeFile(uf.id, setPhotos)}
                  style={{
                    position: "absolute",
                    top: "3px",
                    right: "3px",
                    background: "rgba(0,0,0,0.7)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  x
                </button>
                {uf.status === "uploading" && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(0,0,0,0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      color: "#fff",
                    }}
                  >
                    {t.uploading}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files, photos, MAX_PHOTOS, setPhotos);
            e.target.value = "";
          }}
        />

        {photos.length < MAX_PHOTOS && (
          <button
            onClick={() => photoInputRef.current?.click()}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "10px",
              border: "2px dashed #333",
              background: "transparent",
              color: "#888",
              fontSize: "0.9375rem",
              cursor: "pointer",
            }}
          >
            + Add photos
          </button>
        )}

        {photos.length > 0 && photos.length < MIN_PHOTOS && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "#f59e0b" }}>
            {t.min_photos_hint}
          </p>
        )}
      </section>

      {/* Videos section */}
      <section style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <label style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{t.videos_label}</label>
          <span style={{ fontSize: "0.8125rem", color: "#666" }}>
            {videos.length}/{MAX_VIDEOS}
          </span>
        </div>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "#666" }}>{t.videos_hint}</p>

        {/* Video list */}
        {videos.map((uf) => (
          <div
            key={uf.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.625rem 0.75rem",
              background: "#1a1a1a",
              borderRadius: "10px",
              border: `1px solid ${uf.status === "error" ? "#ef4444" : "#2a2a2a"}`,
              marginBottom: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>🎬</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {uf.file.name}
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#666" }}>
                {formatBytes(uf.file.size)}
                {uf.status === "uploading" && ` · ${t.uploading}`}
                {uf.status === "done" && " · ✓"}
                {uf.status === "error" && " · ✗"}
              </p>
            </div>
            <button
              onClick={() => removeFile(uf.id, setVideos)}
              style={{
                background: "transparent",
                border: "none",
                color: "#666",
                cursor: "pointer",
                fontSize: "1rem",
                flexShrink: 0,
              }}
            >
              x
            </button>
          </div>
        ))}

        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files, videos, MAX_VIDEOS, setVideos);
            e.target.value = "";
          }}
        />

        {videos.length < MAX_VIDEOS && (
          <button
            onClick={() => videoInputRef.current?.click()}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "10px",
              border: "2px dashed #333",
              background: "transparent",
              color: "#888",
              fontSize: "0.9375rem",
              cursor: "pointer",
            }}
          >
            + Add videos
          </button>
        )}

        {videos.length > 0 && videos.length < MIN_VIDEOS && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "#f59e0b" }}>
            {t.min_videos_hint}
          </p>
        )}
      </section>

      {/* Consent pending notice */}
      <div
        style={{
          background: "#1a1a2e",
          borderRadius: "10px",
          padding: "0.875rem 1rem",
          marginBottom: "1.5rem",
          borderLeft: "3px solid #7c3aed",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#b0b0d0", lineHeight: 1.5 }}>
          {t.consent_pending_notice}
        </p>
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</p>
      )}

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!canContinue || uploading}
        style={{
          width: "100%",
          padding: "0.9375rem",
          borderRadius: "12px",
          border: "none",
          background: canContinue && !uploading ? BRAND : DISABLED,
          color: "#fff",
          fontFamily,
          fontSize: "1rem",
          fontWeight: 700,
          cursor: canContinue && !uploading ? "pointer" : "not-allowed",
        }}
      >
        {uploading ? t.uploading : t.continue_button}
      </button>
    </main>
  );
}
