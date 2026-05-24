import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { getMessages, isValidLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const CJK_FONT = `"Hiragino Kaku Gothic Pro", "Noto Sans CJK JP", "Microsoft JhengHei", system-ui, sans-serif`;

const SCENARIO_PROMPTS: Record<Locale, string[]> = {
  en: [
    "A fan says: 'You're so beautiful! How do you stay so confident?' — How do you reply?",
    "A fan asks: 'What's your favorite thing to do on a day off?' — How do you reply?",
    "A fan says: 'I've been following you for years and you changed my life' — How do you reply?",
    "A fan asks: 'Can you give me advice about a personal problem?' — How do you reply?",
    "A fan says: 'I love your content so much! Do you ever get lonely?' — How do you reply?",
    "A fan asks: 'What do you think about [controversial topic]?' — How do you reply?",
    "A fan says: 'I dream about you every night' — How do you reply?",
    "A fan asks: 'Would you ever meet fans in person?' — How do you reply?",
    "A fan says: 'Your content helped me through a really hard time' — How do you reply?",
    "A fan asks: 'What's something your fans don't know about you?' — How do you reply?",
  ],
  ja: [
    "ファンが「あなたは本当に綺麗！どうやって自信を保っているの？」と言います。どう返しますか？",
    "ファンが「休日に一番好きなことは何？」と聞きます。どう返しますか？",
    "ファンが「何年もずっと応援してます。あなたのおかげで人生が変わりました」と言います。どう返しますか？",
    "ファンが「個人的な悩みについてアドバイスください」と聞きます。どう返しますか？",
    "ファンが「コンテンツ大好き！孤独を感じることありますか？」と言います。どう返しますか？",
    "ファンが「[論争的な話題]についてどう思う？」と聞きます。どう返しますか？",
    "ファンが「毎晩夢に出てきます」と言います。どう返しますか？",
    "ファンが「ファンに直接会うことはありますか？」と聞きます。どう返しますか？",
    "ファンが「あなたのコンテンツに辛い時期を乗り越えさせてもらいました」と言います。どう返しますか？",
    "ファンが「ファンが知らないこと何かありますか？」と聞きます。どう返しますか？",
  ],
  "zh-TW": [
    "粉絲說：「你真的好漂亮！你是怎麼保持自信的？」你怎麼回覆？",
    "粉絲問：「你休假最喜歡做什麼？」你怎麼回覆？",
    "粉絲說：「我追蹤你好幾年了，你改變了我的生命」你怎麼回覆？",
    "粉絲問：「你能給我一些個人問題的建議嗎？」你怎麼回覆？",
    "粉絲說：「我超喜歡你的內容！你會感到孤獨嗎？」你怎麼回覆？",
    "粉絲問：「你對[爭議話題]有什麼看法？」你怎麼回覆？",
    "粉絲說：「我每晚都夢到你」你怎麼回覆？",
    "粉絲問：「你會親自見粉絲嗎？」你怎麼回覆？",
    "粉絲說：「你的內容幫我度過了很艱難的時期」你怎麼回覆？",
    "粉絲問：「有什麼粉絲不知道的事嗎？」你怎麼回覆？",
  ],
};

type ScenarioResponse = {
  prompt: string;
  answer: string;
};

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export default function OnboardStep2() {
  const params = useParams<{ locale: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const t = getMessages(locale).onboard.step2;
  const fontFamily = locale === "en" ? "system-ui, -apple-system, sans-serif" : CJK_FONT;

  const [, navigate] = useLocation();

  const prompts = SCENARIO_PROMPTS[locale] ?? SCENARIO_PROMPTS.en;
  const TOTAL = prompts.length;
  const MIN_REQUIRED = 8;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, ScenarioResponse>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = Object.keys(responses).length;
  const canContinue = answeredCount >= MIN_REQUIRED;
  const isLastScenario = currentIndex >= TOTAL - 1;

  const BRAND = "#7C3AED";
  const DISABLED = "#555";

  function saveCurrentAndAdvance() {
    if (currentAnswer.trim()) {
      setResponses((prev) => ({
        ...prev,
        [currentIndex]: { prompt: prompts[currentIndex], answer: currentAnswer.trim() },
      }));
    }
    setCurrentAnswer("");
    if (!isLastScenario) {
      setCurrentIndex((i) => i + 1);
    }
  }

  function skipCurrent() {
    setCurrentAnswer("");
    if (!isLastScenario) {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function handleContinue() {
    if (!canContinue || submitting) return;

    // Save current answer if non-empty before submit
    const finalResponses = { ...responses };
    if (currentAnswer.trim()) {
      finalResponses[currentIndex] = {
        prompt: prompts[currentIndex],
        answer: currentAnswer.trim(),
      };
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      responses: Object.values(finalResponses),
    };

    try {
      const res = await fetch("/api/onboarding/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok || res.status === 503) {
        // 503 = no DB (Slice 1 stub) — continue anyway
        navigate(`/${locale}/onboard/step3`);
      } else {
        setError("Submission failed. Please try again.");
      }
    } catch {
      // Network error — still proceed (graceful stub)
      navigate(`/${locale}/onboard/step3`);
    } finally {
      setSubmitting(false);
    }
  }

  const progressPct = (answeredCount / TOTAL) * 100;

  const scenarioLabelText = interpolate(t.scenario_label, {
    n: currentIndex + 1,
    total: TOTAL,
  });

  const remainingNeeded = Math.max(0, MIN_REQUIRED - answeredCount);

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
      {/* Step progress bar */}
      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "2rem" }}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            style={{
              flex: 1,
              height: "4px",
              borderRadius: "2px",
              background: step <= 2 ? BRAND : "#2a2a2a",
            }}
          />
        ))}
      </div>

      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 700 }}>
        {t.title}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "#aaa", fontSize: "0.9375rem", lineHeight: 1.5 }}>
        {t.subtitle}
      </p>

      {/* Progress indicator */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.375rem",
          }}
        >
          <span style={{ fontSize: "0.8125rem", color: "#888" }}>
            {interpolate(t.scenarios_done, { n: answeredCount, total: TOTAL })}
          </span>
          <span style={{ fontSize: "0.8125rem", color: "#888" }}>
            {scenarioLabelText}
          </span>
        </div>
        <div
          style={{
            height: "6px",
            background: "#1a1a1a",
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: BRAND,
              borderRadius: "3px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Scenario card */}
      <div
        style={{
          background: "#161616",
          borderRadius: "14px",
          padding: "1.25rem",
          marginBottom: "1.25rem",
          border: "1px solid #2a2a2a",
        }}
      >
        <p
          style={{
            margin: "0 0 1rem",
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            color: "#e0e0e0",
            fontStyle: "italic",
          }}
        >
          {prompts[currentIndex]}
        </p>

        <label
          style={{
            display: "block",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#999",
            marginBottom: "0.5rem",
          }}
        >
          {t.your_response}
        </label>
        <textarea
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          placeholder={t.response_placeholder}
          rows={4}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "10px",
            color: "#f0f0f0",
            padding: "0.625rem 0.75rem",
            fontSize: "0.9375rem",
            fontFamily,
            resize: "vertical",
            outline: "none",
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Next scenario / skip buttons */}
      <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1.5rem" }}>
        {!isLastScenario && (
          <button
            onClick={saveCurrentAndAdvance}
            disabled={!currentAnswer.trim()}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "10px",
              border: "none",
              background: currentAnswer.trim() ? BRAND : DISABLED,
              color: "#fff",
              fontFamily,
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: currentAnswer.trim() ? "pointer" : "not-allowed",
            }}
          >
            Next →
          </button>
        )}
        <button
          onClick={skipCurrent}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            border: "1px solid #333",
            background: "transparent",
            color: "#888",
            fontFamily,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          {t.skip_label}
        </button>
      </div>

      {/* Min required hint */}
      {!canContinue && answeredCount > 0 && (
        <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "#888", marginBottom: "1rem" }}>
          {interpolate(t.min_scenarios_hint, { n: remainingNeeded })}
        </p>
      )}

      {/* Error */}
      {error && (
        <p style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</p>
      )}

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!canContinue || submitting}
        style={{
          width: "100%",
          padding: "0.9375rem",
          borderRadius: "12px",
          border: "none",
          background: canContinue && !submitting ? BRAND : DISABLED,
          color: "#fff",
          fontFamily,
          fontSize: "1rem",
          fontWeight: 700,
          cursor: canContinue && !submitting ? "pointer" : "not-allowed",
        }}
      >
        {submitting ? "Submitting…" : t.continue_button}
      </button>
    </main>
  );
}
