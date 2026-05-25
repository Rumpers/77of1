'use client';
// OF-133 / HID-033: Re-acceptance gate for material policy changes.
// Shown on next authenticated page load when pending policy versions exist.
// Fails open (does not block render) if the /api/policies/pending fetch fails.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type PolicyVersion = {
  id: string;
  policy_type: 'tos' | 'privacy_policy';
  version_num: number;
  is_material_change: boolean;
  effective_at: string;
};

type Locale = 'en' | 'ja' | 'zh-TW';

const I18N: Record<Locale, {
  title_material: string;
  title_new: string;
  body_material: string;
  body_new: string;
  tos_label: string;
  privacy_label: string;
  legal_note: string;
  accept_button: string;
  accepting: string;
}> = {
  en: {
    title_material: 'Updated Policies',
    title_new: 'Please Review Our Policies',
    body_material:
      'We have made material changes to our policies. Please review and accept the updated versions to continue.',
    body_new:
      'Before continuing, please review and accept our policies.',
    tos_label: 'Terms of Service',
    privacy_label: 'Privacy Policy',
    legal_note:
      'By clicking "I Accept", you agree to the listed policies. Your acceptance is recorded with a timestamp.',
    accept_button: 'I Accept',
    accepting: 'Saving…',
  },
  ja: {
    title_material: 'ポリシーの更新',
    title_new: 'ポリシーをご確認ください',
    body_material:
      'ポリシーに重要な変更が加えられました。続行するには最新版をご確認のうえ、同意してください。',
    body_new: '続行する前に、ポリシーをご確認のうえ、同意してください。',
    tos_label: '利用規約',
    privacy_label: 'プライバシーポリシー',
    legal_note:
      '「同意する」をクリックすることで、上記ポリシーに同意したことになります。同意はタイムスタンプとともに記録されます。',
    accept_button: '同意する',
    accepting: '保存中…',
  },
  'zh-TW': {
    title_material: '政策已更新',
    title_new: '請審閱我們的政策',
    body_material: '我們的政策已有重大變更。請審閱並接受更新版本以繼續使用。',
    body_new: '繼續前，請審閱並接受我們的政策。',
    tos_label: '服務條款',
    privacy_label: '隱私政策',
    legal_note: '點擊「我同意」即表示您同意上列政策。您的同意將記錄時間戳記。',
    accept_button: '我同意',
    accepting: '儲存中…',
  },
};

const VALID_LOCALES: Locale[] = ['en', 'ja', 'zh-TW'];

function resolveLocale(candidate: unknown): Locale {
  if (typeof candidate === 'string' && VALID_LOCALES.includes(candidate as Locale)) {
    return candidate as Locale;
  }
  return 'en';
}

type Props = {
  userType: 'creator' | 'fan';
  children: React.ReactNode;
};

export function PolicyAcceptanceGate({ userType, children }: Props) {
  const params = useParams();
  const locale = resolveLocale(params?.locale);
  const t = I18N[locale];

  const [pending, setPending] = useState<PolicyVersion[] | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/policies/pending?user_type=${userType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { pending?: PolicyVersion[] } | null) => {
        if (!cancelled) setPending(data?.pending ?? []);
      })
      .catch(() => {
        if (!cancelled) setPending([]); // fail-open
      });
    return () => { cancelled = true; };
  }, [userType]);

  async function handleAccept() {
    if (!pending || pending.length === 0) return;
    setAccepting(true);
    try {
      const res = await fetch('/api/policies/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_version_ids: pending.map((p) => p.id),
          user_type: userType,
        }),
      });
      if (res.ok) {
        setAccepted(true);
        setPending([]);
      }
    } catch {
      // fail-open: record failure but do not permanently block the user
      setAccepted(true);
      setPending([]);
    } finally {
      setAccepting(false);
    }
  }

  // Still loading — don't block render
  if (pending === null) return <>{children}</>;

  // No pending or already accepted — pass through
  if (pending.length === 0 || accepted) return <>{children}</>;

  const isMaterial = pending.some((p) => p.is_material_change);

  return (
    <>
      <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="policy-gate-title">
        <div style={modalStyle}>
          <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.75rem' }}>
            📋
          </div>
          <h2 id="policy-gate-title" style={titleStyle}>
            {isMaterial ? t.title_material : t.title_new}
          </h2>
          <p style={bodyStyle}>
            {isMaterial ? t.body_material : t.body_new}
          </p>

          <ul style={listStyle}>
            {pending.map((p) => (
              <li key={p.id} style={listItemStyle}>
                <span style={{ marginRight: '0.5rem' }}>•</span>
                <span>
                  {p.policy_type === 'tos' ? t.tos_label : t.privacy_label}{' '}
                  <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>v{p.version_num}</span>
                </span>
              </li>
            ))}
          </ul>

          <p style={legalNoteStyle}>{t.legal_note}</p>

          <button
            style={{ ...btnStyle, opacity: accepting ? 0.65 : 1, cursor: accepting ? 'not-allowed' : 'pointer' }}
            disabled={accepting}
            onClick={handleAccept}
          >
            {accepting ? t.accepting : t.accept_button}
          </button>
        </div>
      </div>
      {children}
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
};

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '16px',
  padding: '1.75rem 1.5rem',
  maxWidth: '440px',
  width: '100%',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 700,
  margin: '0 0 0.75rem',
  textAlign: 'center',
  color: '#111827',
};

const bodyStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#374151',
  lineHeight: 1.55,
  margin: '0 0 1rem',
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0 0 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const listItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  fontSize: '0.9rem',
  fontWeight: 600,
  color: '#1F2937',
};

const legalNoteStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#9CA3AF',
  lineHeight: 1.5,
  marginBottom: '1.25rem',
};

const btnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.875rem',
  background: '#7C3AED',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  fontSize: '1rem',
  fontWeight: 700,
};
