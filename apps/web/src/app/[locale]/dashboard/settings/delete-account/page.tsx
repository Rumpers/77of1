'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PolicyAcceptanceGate } from '@/components/PolicyAcceptanceGate';

type Screen = 'reauth' | 'confirm' | 'scheduled' | 'cancelled' | 'error';

const DANGER = '#DC2626';
const BRAND = '#7C3AED';
const SUCCESS = '#059669';
const WARN = '#D97706';

const WHAT_GETS_DELETED = {
  en: [
    'AI Twin persona (text + voice + video models)',
    'RAG knowledge base and LoRA fine-tune',
    'Voice clone and derived audio assets',
    'All fan conversation history',
    'Your creator profile and handle',
    'Pending payouts will follow platform payout schedule',
  ],
  ja: [
    'AIツイン ペルソナ（テキスト・音声・動画モデル）',
    'RAGナレッジベースとLoRAファインチューニング',
    '音声クローンと関連音声アセット',
    'すべてのファンとの会話履歴',
    'クリエイタープロフィールとハンドル名',
    '保留中の支払いはプラットフォームの支払いスケジュールに従います',
  ],
  'zh-TW': [
    'AI 分身角色（文字 + 語音 + 影片模型）',
    'RAG 知識庫和 LoRA 微調',
    '語音複製和衍生音訊資產',
    '所有粉絲對話記錄',
    '您的創作者個人資料和帳號名稱',
    '待付款項將按照平台付款時程處理',
  ],
};

const I18N: Record<string, Record<string, string>> = {
  en: {
    title: 'Delete Creator Account',
    reauth_subtitle:
      'This permanently deletes your AI Twin, all creator assets, and fan conversation data. Your Replit session confirms your identity.',
    reauth_note:
      'Re-authentication: your active Replit session is your identity confirmation. No additional step is required.',
    what_deleted_title: 'The following will be permanently deleted:',
    retained_title: 'Retained for legal compliance (§8.3):',
    retained_note:
      'Consent records, revocation timestamps, and audit trails are retained as required by applicable law.',
    type_confirm: 'Type DELETE to continue',
    type_placeholder: 'DELETE',
    submit_button: 'Delete My Creator Account',
    submitting: 'Submitting…',
    scheduled_title: 'Account Deletion Scheduled',
    scheduled_body:
      'Your creator account and all AI assets are scheduled for deletion. You have a 7-day grace window to cancel.',
    scheduled_cascade:
      'Cascade: persona + RAG + LoRA + voice clone + conversation history + derived assets will be purged within 72 hours of the grace window.',
    cancel_button: 'Cancel Deletion',
    cancelling: 'Cancelling…',
    cancelled_title: 'Deletion Cancelled',
    cancelled_body: 'Your account is safe. The deletion request has been cancelled.',
    grace_ends: 'Grace window ends:',
    back: '← Back to Dashboard',
    back_settings: '← Back',
    error_title: 'Something went wrong',
    error_retry: 'Try Again',
  },
  ja: {
    title: 'クリエイターアカウントを削除する',
    reauth_subtitle:
      'これにより、AIツイン、すべてのクリエイターアセット、ファンの会話データが完全に削除されます。Replitセッションがあなたのアイデンティティを確認します。',
    reauth_note:
      '再認証：アクティブなReplitセッションがあなたのアイデンティティ確認として機能します。追加の手順は必要ありません。',
    what_deleted_title: '以下が完全に削除されます：',
    retained_title: '法的コンプライアンスのために保持（§8.3）：',
    retained_note:
      '適用法の要件により、同意記録、取り消しタイムスタンプ、監査証跡は保持されます。',
    type_confirm: '続行するには「DELETE」と入力してください',
    type_placeholder: 'DELETE',
    submit_button: 'クリエイターアカウントを削除する',
    submitting: '送信中…',
    scheduled_title: 'アカウント削除がスケジュールされました',
    scheduled_body:
      'クリエイターアカウントとすべてのAIアセットの削除がスケジュールされました。7日間の猶予期間中にキャンセルできます。',
    scheduled_cascade:
      'カスケード：ペルソナ + RAG + LoRA + 音声クローン + 会話履歴 + 派生アセットは猶予期間後72時間以内に削除されます。',
    cancel_button: '削除をキャンセルする',
    cancelling: 'キャンセル中…',
    cancelled_title: '削除がキャンセルされました',
    cancelled_body: 'アカウントは安全です。削除リクエストはキャンセルされました。',
    grace_ends: '猶予期間終了：',
    back: '← ダッシュボードに戻る',
    back_settings: '← 戻る',
    error_title: '問題が発生しました',
    error_retry: '再試行',
  },
  'zh-TW': {
    title: '刪除創作者帳號',
    reauth_subtitle:
      '這將永久刪除您的 AI 分身、所有創作者資產和粉絲對話資料。您的 Replit 會話將確認您的身份。',
    reauth_note:
      '重新驗證：您的活躍 Replit 會話即為您的身份確認，無需額外步驟。',
    what_deleted_title: '以下內容將被永久刪除：',
    retained_title: '出於法律合規目的而保留（§8.3）：',
    retained_note:
      '根據適用法律要求，同意記錄、撤銷時間戳和稽核記錄將被保留。',
    type_confirm: '請輸入「DELETE」繼續',
    type_placeholder: 'DELETE',
    submit_button: '刪除我的創作者帳號',
    submitting: '提交中…',
    scheduled_title: '帳號刪除已排程',
    scheduled_body:
      '您的創作者帳號和所有 AI 資產已排程刪除。您有 7 天寬限期可以取消。',
    scheduled_cascade:
      '級聯刪除：角色 + RAG + LoRA + 語音複製 + 對話記錄 + 衍生資產將在寬限期後 72 小時內清除。',
    cancel_button: '取消刪除',
    cancelling: '取消中…',
    cancelled_title: '刪除已取消',
    cancelled_body: '您的帳號安全。刪除請求已取消。',
    grace_ends: '寬限期結束：',
    back: '← 返回儀表板',
    back_settings: '← 返回',
    error_title: '發生錯誤',
    error_retry: '重試',
  },
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(
    locale === 'ja' ? 'ja-JP' : locale === 'zh-TW' ? 'zh-TW' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
}

export default function CreatorDeleteAccountPage() {
  const params = useParams<{ locale: string }>();
  const locale = (params?.locale ?? 'en') as string;
  const t = I18N[locale] ?? I18N['en'];
  const deletedItems =
    WHAT_GETS_DELETED[locale as keyof typeof WHAT_GETS_DELETED] ?? WHAT_GETS_DELETED['en'];
  const router = useRouter();

  const [typeValue, setTypeValue] = useState('');
  const [screen, setScreen] = useState<Screen>('reauth');
  const [loading, setLoading] = useState(false);
  const [cancelToken, setCancelToken] = useState('');
  const [graceEndsAt, setGraceEndsAt] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit() {
    if (typeValue !== 'DELETE') return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/account/creator/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        ok: boolean;
        cancel_token?: string;
        grace_ends_at?: string;
        already_exists?: boolean;
      };
      setCancelToken(data.cancel_token ?? '');
      setGraceEndsAt(data.grace_ends_at ?? '');
      setScreen('scheduled');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setScreen('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!cancelToken) return;
    setCancelLoading(true);
    try {
      const res = await fetch('/api/account/creator/delete/cancel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_token: cancelToken }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setScreen('cancelled');
    } catch {
      setScreen('cancelled');
    } finally {
      setCancelLoading(false);
    }
  }

  if (screen === 'error') {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ ...h1Style, color: DANGER }}>{t.error_title}</h1>
          {errorMsg && <p style={bodyStyle}>{errorMsg}</p>}
          <button style={secondaryButtonStyle} onClick={() => setScreen('reauth')}>
            {t.error_retry}
          </button>
        </div>
      </main>
    );
  }

  if (screen === 'cancelled') {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <h1 style={{ ...h1Style, color: SUCCESS }}>{t.cancelled_title}</h1>
          <p style={bodyStyle}>{t.cancelled_body}</p>
          <button
            style={{ ...secondaryButtonStyle, marginTop: '1.25rem' }}
            onClick={() => router.push(`/${locale}/dashboard`)}
          >
            {t.back}
          </button>
        </div>
      </main>
    );
  }

  if (screen === 'scheduled') {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗑</div>
          <h1 style={{ ...h1Style, color: DANGER }}>{t.scheduled_title}</h1>
          <p style={bodyStyle}>{t.scheduled_body}</p>
          {graceEndsAt && (
            <p style={noteStyle}>
              {t.grace_ends} <strong>{formatDate(graceEndsAt, locale)}</strong>
            </p>
          )}
          <div style={cascadeNoteStyle}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
              {t.scheduled_cascade}
            </p>
          </div>
          <button
            style={{ ...secondaryButtonStyle, borderColor: '#FECACA', color: DANGER, marginTop: '1rem' }}
            onClick={handleCancel}
            disabled={cancelLoading}
          >
            {cancelLoading ? t.cancelling : t.cancel_button}
          </button>
        </div>
      </main>
    );
  }

  const canSubmit = typeValue === 'DELETE';

  return (
    <PolicyAcceptanceGate userType="creator">
    <main style={pageStyle}>
      <div style={cardStyle}>
        <button style={backButtonStyle} onClick={() => router.back()}>
          {t.back_settings}
        </button>

        <h1 style={{ ...h1Style, color: DANGER, marginTop: '0.75rem' }}>{t.title}</h1>
        <p style={subtitleStyle}>{t.reauth_subtitle}</p>

        <div style={reauthNoteStyle}>
          <span style={{ fontSize: '1rem', marginRight: '0.5rem' }}>🔑</span>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400E', lineHeight: 1.5 }}>
            {t.reauth_note}
          </p>
        </div>

        <div style={checklistCardStyle}>
          <p style={checklistTitleStyle}>{t.what_deleted_title}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {deletedItems.map((item, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: '#374151' }}>
                <span style={{ color: DANGER, marginRight: '0.4rem' }}>✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div style={retainedCardStyle}>
          <p style={retainedTitleStyle}>{t.retained_title}</p>
          <p style={{ fontSize: '0.825rem', color: '#374151', margin: 0, lineHeight: 1.5 }}>
            {t.retained_note}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '1rem 0 0.75rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            {t.type_confirm}
          </label>
          <input
            type="text"
            value={typeValue}
            onChange={(e) => setTypeValue(e.target.value)}
            placeholder={t.type_placeholder}
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: `1.5px solid ${typeValue.length > 0 && typeValue !== 'DELETE' ? DANGER : '#D1D5DB'}`,
              fontSize: '1rem',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              outline: 'none',
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <button
          style={{
            background: DANGER,
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '0.875rem',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.45,
            display: 'block',
            width: '100%',
          }}
          disabled={!canSubmit || loading}
          onClick={handleSubmit}
        >
          {loading ? t.submitting : t.submit_button}
        </button>
      </div>
    </main>
    </PolicyAcceptanceGate>
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
  margin: '0 0 1rem',
  lineHeight: 1.55,
};

const bodyStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: '#374151',
  lineHeight: 1.6,
  margin: '0.5rem 0',
};

const reauthNoteStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.5rem',
  background: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: '8px',
  padding: '0.75rem',
  marginBottom: '1rem',
};

const checklistCardStyle: React.CSSProperties = {
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: '10px',
  padding: '0.875rem',
  marginBottom: '0.75rem',
};

const checklistTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.85rem',
  color: '#111827',
  margin: '0 0 0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const retainedCardStyle: React.CSSProperties = {
  background: '#F0FDF4',
  border: '1px solid #BBF7D0',
  borderRadius: '10px',
  padding: '0.875rem',
};

const retainedTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.85rem',
  color: '#111827',
  margin: '0 0 0.4rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const cascadeNoteStyle: React.CSSProperties = {
  background: '#FFF7ED',
  border: '1px solid #FED7AA',
  borderRadius: '8px',
  padding: '0.75rem',
  marginTop: '0.75rem',
};

const noteStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#374151',
  margin: '0.5rem 0 0.25rem',
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
