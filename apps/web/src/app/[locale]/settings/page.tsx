'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PolicyAcceptanceGate } from '@/components/PolicyAcceptanceGate';

const BRAND = '#7C3AED';
const DANGER = '#DC2626';
const DANGER_LIGHT = '#FEF2F2';

const I18N: Record<string, Record<string, string>> = {
  en: {
    title: 'Account Settings',
    subtitle: 'Manage your fan account preferences.',
    danger_zone: 'Danger Zone',
    delete_account: 'Delete Account',
    delete_desc:
      'Permanently delete your account and all associated data, including conversation history and credits. This action cannot be undone after the 7-day grace window.',
    delete_button: 'Request Account Deletion',
    back: '← Back',
  },
  ja: {
    title: 'アカウント設定',
    subtitle: 'ファンアカウントの設定を管理します。',
    danger_zone: '危険な操作',
    delete_account: 'アカウント削除',
    delete_desc:
      'アカウントと関連するすべてのデータ（会話履歴やクレジットを含む）が完全に削除されます。7日間の猶予期間が終了すると取り消しできません。',
    delete_button: 'アカウント削除を申請する',
    back: '← 戻る',
  },
  'zh-TW': {
    title: '帳號設定',
    subtitle: '管理您的粉絲帳號偏好設定。',
    danger_zone: '危險區域',
    delete_account: '刪除帳號',
    delete_desc:
      '永久刪除您的帳號及所有相關資料，包括對話記錄和點數。在 7 天寬限期結束後，此操作無法撤銷。',
    delete_button: '申請刪除帳號',
    back: '← 返回',
  },
};

export default function FanSettingsPage() {
  const params = useParams<{ locale: string }>();
  const locale = (params?.locale ?? 'en') as string;
  const t = I18N[locale] ?? I18N['en'];
  const router = useRouter();
  const [searchParams] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });
  const creatorId = searchParams.get('creatorId') ?? '';

  return (
    <PolicyAcceptanceGate userType="fan">
    <main style={pageStyle}>
      <div style={cardStyle}>
        <button style={backButtonStyle} onClick={() => router.back()}>
          {t.back}
        </button>

        <h1 style={h1Style}>{t.title}</h1>
        <p style={subtitleStyle}>{t.subtitle}</p>

        <div style={sectionDividerStyle} />

        <div style={dangerSectionStyle}>
          <h2 style={dangerTitleStyle}>{t.danger_zone}</h2>
          <div style={dangerCardStyle}>
            <div>
              <p style={dangerLabelStyle}>{t.delete_account}</p>
              <p style={dangerDescStyle}>{t.delete_desc}</p>
            </div>
            <button
              style={dangerButtonStyle}
              onClick={() => {
                const path = `/${locale}/settings/delete-account${creatorId ? `?creatorId=${encodeURIComponent(creatorId)}` : ''}`;
                router.push(path);
              }}
            >
              {t.delete_button}
            </button>
          </div>
        </div>
      </div>
    </main>
    </PolicyAcceptanceGate>
  );
}

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
  margin: '0.75rem 0 0.5rem',
  color: '#111827',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#6B7280',
  margin: 0,
};

const sectionDividerStyle: React.CSSProperties = {
  height: '1px',
  background: '#E5E7EB',
  margin: '1.5rem 0',
};

const dangerSectionStyle: React.CSSProperties = {};

const dangerTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: DANGER,
  margin: '0 0 0.75rem',
};

const dangerCardStyle: React.CSSProperties = {
  background: DANGER_LIGHT,
  border: `1px solid #FECACA`,
  borderRadius: '12px',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const dangerLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.95rem',
  color: '#111827',
  margin: 0,
};

const dangerDescStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#6B7280',
  margin: '0.25rem 0 0',
  lineHeight: 1.55,
};

const dangerButtonStyle: React.CSSProperties = {
  background: DANGER,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '0.65rem 1rem',
  fontWeight: 700,
  fontSize: '0.9rem',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

const backButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: BRAND,
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  padding: 0,
};
