'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type ConsentGrantType = 'persona_text' | 'voice' | 'image' | 'talking_video' | 'fullbody_video';

const GRANT_TYPES: ConsentGrantType[] = [
  'persona_text',
  'voice',
  'image',
  'talking_video',
  'fullbody_video',
];

type Answers = Partial<Record<ConsentGrantType, boolean>>;
type Screen = 'checklist' | 'summary' | 'success';

const BRAND = '#7C3AED';
const BRAND_LIGHT = '#F5F3FF';
const REQUIRED_COLOR = '#DC2626';
const OPTIONAL_COLOR = '#6B7280';
const GRANTED_COLOR = '#059669';
const DENIED_COLOR = '#6B7280';

export default function ConsentStep3() {
  const t = useTranslations('onboard.step3');

  const [answers, setAnswers] = useState<Answers>({});
  const [expanded, setExpanded] = useState<Partial<Record<ConsentGrantType, boolean>>>({});
  const [screen, setScreen] = useState<Screen>('checklist');
  const [loading, setLoading] = useState(false);
  const [personaGranted, setPersonaGranted] = useState(false);

  const allAnswered = GRANT_TYPES.every((gt) => gt in answers);

  function toggleAnswer(gt: ConsentGrantType, granted: boolean) {
    setAnswers((prev) => ({ ...prev, [gt]: granted }));
  }

  function toggleExpanded(gt: ConsentGrantType) {
    setExpanded((prev) => ({ ...prev, [gt]: !prev[gt] }));
  }

  async function handleConfirm() {
    if (!allAnswered) return;
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok: boolean; persona_text_granted: boolean };
      setPersonaGranted(data.persona_text_granted);
      setScreen('success');
    } catch (err) {
      console.error('[consent-step3] submit failed', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (screen === 'success') {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ ...h1Style, color: GRANTED_COLOR }}>{t('success.title')}</h1>
          <p style={bodyStyle}>
            {personaGranted
              ? t('success.body_with_persona')
              : t('success.body_no_persona')}
          </p>
        </div>
      </main>
    );
  }

  if (screen === 'summary') {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={h1Style}>{t('summary.title')}</h1>
          <p style={subtitleStyle}>{t('summary.subtitle')}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1.5rem 0' }}>
            {GRANT_TYPES.map((gt) => {
              const granted = answers[gt];
              return (
                <div key={gt} style={summaryRowStyle}>
                  <span style={{ fontSize: '1.2rem' }}>{t(`items.${gt}.emoji`)}</span>
                  <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500 }}>
                    {t(`items.${gt}.label`)}
                  </span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: granted ? GRANTED_COLOR : DENIED_COLOR,
                    }}
                  >
                    {granted ? t('summary.granted') : t('summary.denied')}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            style={primaryButtonStyle}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? '…' : t('summary.confirm_button')}
          </button>

          <button
            style={secondaryButtonStyle}
            onClick={() => setScreen('checklist')}
            disabled={loading}
          >
            {t('summary.back_button')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={h1Style}>{t('title')}</h1>
        <p style={subtitleStyle}>{t('subtitle')}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
          {GRANT_TYPES.map((gt) => {
            const isRequired = gt === 'persona_text';
            const answer = answers[gt];
            const isOpen = expanded[gt];

            return (
              <div key={gt} style={itemCardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{t(`items.${gt}.emoji`)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {t(`items.${gt}.label`)}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '9999px',
                          background: isRequired ? '#FEE2E2' : '#F3F4F6',
                          color: isRequired ? REQUIRED_COLOR : OPTIONAL_COLOR,
                        }}
                      >
                        {isRequired ? t('required_badge') : t('optional_badge')}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#374151', margin: '0.3rem 0 0' }}>
                      {t(`items.${gt}.description`)}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: isRequired ? REQUIRED_COLOR : OPTIONAL_COLOR, margin: '0.2rem 0 0', fontStyle: 'italic' }}>
                      {t(`items.${gt}.required_note`)}
                    </p>

                    <button
                      style={legalToggleStyle}
                      onClick={() => toggleExpanded(gt)}
                    >
                      {isOpen ? `▲ ${t('legal_collapse')}` : `▼ ${t('legal_expand')}`}
                    </button>

                    {isOpen && (
                      <p style={legalTextStyle}>{t(`items.${gt}.legal`)}</p>
                    )}
                  </div>
                </div>

                <div style={toggleRowStyle}>
                  <button
                    style={{
                      ...toggleButtonStyle,
                      background: answer === true ? GRANTED_COLOR : '#F3F4F6',
                      color: answer === true ? '#fff' : '#374151',
                      border: answer === true ? `2px solid ${GRANTED_COLOR}` : '2px solid #D1D5DB',
                    }}
                    onClick={() => toggleAnswer(gt, true)}
                  >
                    {t('yes_label')}
                  </button>
                  <button
                    style={{
                      ...toggleButtonStyle,
                      background: answer === false ? '#6B7280' : '#F3F4F6',
                      color: answer === false ? '#fff' : '#374151',
                      border: answer === false ? '2px solid #6B7280' : '2px solid #D1D5DB',
                    }}
                    onClick={() => toggleAnswer(gt, false)}
                  >
                    {t('no_label')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          style={{
            ...primaryButtonStyle,
            opacity: allAnswered ? 1 : 0.45,
            cursor: allAnswered ? 'pointer' : 'not-allowed',
          }}
          disabled={!allAnswered}
          onClick={() => setScreen('summary')}
        >
          {t('continue_button')}
        </button>

        {!allAnswered && (
          <p style={{ fontSize: '0.8rem', color: '#9CA3AF', textAlign: 'center', marginTop: '0.5rem' }}>
            {t('continue_disabled_hint')}
          </p>
        )}
      </div>
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  minHeight: '100vh',
  background: '#F9FAFB',
  padding: '1rem',
};

const cardStyle: React.CSSProperties = {
  maxWidth: '480px',
  margin: '0 auto',
  background: '#fff',
  borderRadius: '16px',
  padding: '1.5rem',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};

const h1Style: React.CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 700,
  margin: '0 0 0.5rem',
  color: '#111827',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#6B7280',
  margin: 0,
};

const bodyStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: '#374151',
  lineHeight: 1.6,
};

const itemCardStyle: React.CSSProperties = {
  background: '#FAFAFA',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
};

const toggleButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.55rem 0',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const legalToggleStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0.25rem 0',
  cursor: 'pointer',
  fontSize: '0.78rem',
  color: '#6B7280',
  textDecoration: 'underline',
  marginTop: '0.4rem',
};

const legalTextStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#6B7280',
  lineHeight: 1.55,
  marginTop: '0.4rem',
  padding: '0.75rem',
  background: '#F9FAFB',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
};

const summaryRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem',
  background: '#FAFAFA',
  borderRadius: '10px',
  border: '1px solid #E5E7EB',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.875rem',
  background: BRAND,
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: '0.5rem',
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.75rem',
  background: 'none',
  color: '#6B7280',
  border: '1.5px solid #D1D5DB',
  borderRadius: '10px',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: '0.75rem',
};
