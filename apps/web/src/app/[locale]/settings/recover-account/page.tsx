'use client';

// OF-117 / HID-004: Fan account recovery flow.
// Handles magic-link loss scenarios: backup email/phone verification,
// ID attestation for balances above threshold, support escalation.
// Fraud-flag: rapid recovery + immediate credit liquidation triggers review hold.

import { useState } from 'react';
import { useParams } from 'next/navigation';

type Screen = 'method' | 'backup_contact' | 'id_attestation' | 'submitted' | 'escalate' | 'error';
type RecoveryMethod = 'backup_email' | 'backup_phone' | 'id_attestation' | 'support';

const BRAND = '#7C3AED';
const WARN = '#D97706';

type Locale = 'en' | 'ja' | 'zh-TW';

const I18N: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Recover Your Account',
    subtitle: 'Lost access to your email? Choose how to verify your identity.',
    method_backup_email: 'Send link to backup email',
    method_backup_phone: 'Verify via phone number',
    method_id: 'Identity attestation (if you have credits)',
    method_support: 'Contact support',
    backup_email_label: 'Your backup email address',
    backup_email_placeholder: 'backup@example.com',
    backup_phone_label: 'Your phone number (with country code)',
    backup_phone_placeholder: '+1 555 000 0000',
    id_title: 'Identity Attestation',
    id_body: 'Because your account has credits at stake, we require identity verification. Upload a government-issued ID matching your account name.',
    id_full_name_label: 'Full legal name (as on ID)',
    id_full_name_placeholder: 'Jane Smith',
    id_dob_label: 'Date of birth',
    id_upload_label: 'Upload ID document',
    id_upload_hint: 'JPEG or PNG, max 10 MB. Passport, national ID, or driving licence.',
    id_consent: 'I consent to my ID being processed for account verification and deleted within 30 days per §22.4.',
    submit: 'Continue',
    submitting: 'Submitting…',
    submitted_title: 'Recovery request received',
    submitted_body_contact: 'A verification link has been sent. Check your backup email or phone. The link expires in 30 minutes.',
    submitted_body_id: 'Your identity attestation is under review. We will contact you at your account email within 1–2 business days. Credits are safe and accessible after verification.',
    escalate_title: 'Contact Support',
    escalate_body: 'Our support team can help you recover your account. Include your account username or the email you registered with.',
    escalate_email: 'support@7of1.app',
    back: '← Back',
    error_title: 'Something went wrong',
    error_retry: 'Try Again',
    fraud_hold_notice: 'Your credits are temporarily held pending identity confirmation. This is a security measure to protect your balance.',
  },
  ja: {
    title: 'アカウントを回復する',
    subtitle: 'メールへのアクセスを失いましたか？本人確認方法を選択してください。',
    method_backup_email: 'バックアップメールにリンクを送信',
    method_backup_phone: '電話番号で確認する',
    method_id: '本人証明（クレジットがある場合）',
    method_support: 'サポートに連絡する',
    backup_email_label: 'バックアップメールアドレス',
    backup_email_placeholder: 'backup@example.com',
    backup_phone_label: '電話番号（国番号を含む）',
    backup_phone_placeholder: '+81 90 0000 0000',
    id_title: '本人証明',
    id_body: 'アカウントにクレジットがあるため、本人確認が必要です。アカウント名と一致する政府発行の身分証明書をアップロードしてください。',
    id_full_name_label: '法的氏名（身分証明書の通り）',
    id_full_name_placeholder: '山田 太郎',
    id_dob_label: '生年月日',
    id_upload_label: '身分証明書をアップロード',
    id_upload_hint: 'JPEGまたはPNG、最大10MB。パスポート、国民ID、または運転免許証。',
    id_consent: '§22.4に基づき、本人確認のために身分証明書が処理され、30日以内に削除されることに同意します。',
    submit: '続ける',
    submitting: '送信中…',
    submitted_title: '回復リクエストを受け付けました',
    submitted_body_contact: '確認リンクが送信されました。バックアップメールまたは電話を確認してください。リンクは30分後に無効になります。',
    submitted_body_id: '本人確認は審査中です。1〜2営業日以内にアカウントのメールにご連絡します。確認後、クレジットは安全にご利用いただけます。',
    escalate_title: 'サポートに連絡する',
    escalate_body: 'サポートチームがアカウントの回復をお手伝いします。アカウントのユーザー名または登録したメールアドレスをお知らせください。',
    escalate_email: 'support@7of1.app',
    back: '← 戻る',
    error_title: '問題が発生しました',
    error_retry: '再試行',
    fraud_hold_notice: 'セキュリティ対策として、本人確認が完了するまでクレジットは一時的に保留されます。',
  },
  'zh-TW': {
    title: '恢復您的帳號',
    subtitle: '無法存取您的電子郵件？選擇驗證身份的方式。',
    method_backup_email: '發送連結至備用電子郵件',
    method_backup_phone: '透過電話號碼驗證',
    method_id: '身份證明（如有點數）',
    method_support: '聯絡客服',
    backup_email_label: '備用電子郵件地址',
    backup_email_placeholder: 'backup@example.com',
    backup_phone_label: '電話號碼（含國碼）',
    backup_phone_placeholder: '+886 900 000 000',
    id_title: '身份認證',
    id_body: '由於您的帳號有點數，需要進行身份驗證。請上傳與帳號姓名相符的政府核發身份證件。',
    id_full_name_label: '法定姓名（與證件相同）',
    id_full_name_placeholder: '王小明',
    id_dob_label: '出生日期',
    id_upload_label: '上傳身份證件',
    id_upload_hint: 'JPEG 或 PNG，最大 10 MB。護照、身分證或駕照。',
    id_consent: '我同意依據 §22.4，我的身份證件將用於帳號驗證，並在 30 天內刪除。',
    submit: '繼續',
    submitting: '提交中…',
    submitted_title: '已收到恢復請求',
    submitted_body_contact: '驗證連結已發送。請查看您的備用電子郵件或電話。連結將在 30 分鐘後過期。',
    submitted_body_id: '您的身份認證正在審核中。我們將在 1-2 個工作天內透過您的帳號電子郵件與您聯繫。驗證後即可存取點數。',
    escalate_title: '聯絡客服',
    escalate_body: '我們的客服團隊可以協助您恢復帳號。請提供您的帳號用戶名或註冊時使用的電子郵件地址。',
    escalate_email: 'support@7of1.app',
    back: '← 返回',
    error_title: '發生錯誤',
    error_retry: '重試',
    fraud_hold_notice: '為保護您的餘額，點數已暫時凍結，待身份確認後解除。',
  },
};

const METHODS: { key: RecoveryMethod; i18nKey: string }[] = [
  { key: 'backup_email', i18nKey: 'method_backup_email' },
  { key: 'backup_phone', i18nKey: 'method_backup_phone' },
  { key: 'id_attestation', i18nKey: 'method_id' },
  { key: 'support', i18nKey: 'method_support' },
];

export default function RecoverAccountPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || 'en';
  const t = I18N[locale] ?? I18N.en;

  const [screen, setScreen] = useState<Screen>('method');
  const [method, setMethod] = useState<RecoveryMethod | null>(null);
  const [contact, setContact] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idConsent, setIdConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fraudHold, setFraudHold] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  function handleMethodSelect(m: RecoveryMethod) {
    setMethod(m);
    if (m === 'support') {
      setScreen('escalate');
    } else if (m === 'id_attestation') {
      setScreen('id_attestation');
    } else {
      setScreen('backup_contact');
    }
  }

  async function handleContactSubmit() {
    if (!contact.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/account/fan/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, contact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'error');
      setFraudHold(!!data.fraud_hold);
      setScreen('submitted');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'error');
      setScreen('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleIdSubmit() {
    if (!fullName.trim() || !dob || !idFile || !idConsent) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('method', 'id_attestation');
      form.append('full_name', fullName);
      form.append('dob', dob);
      form.append('id_document', idFile);
      const res = await fetch('/api/account/fan/recover', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'error');
      setFraudHold(!!data.fraud_hold);
      setScreen('submitted');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'error');
      setScreen('error');
    } finally {
      setLoading(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 440,
    margin: '40px auto',
    padding: '32px 24px',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    color: '#111',
    marginBottom: 6,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#555',
    marginBottom: 24,
    lineHeight: 1.5,
  };

  const btnPrimary: React.CSSProperties = {
    width: '100%',
    padding: '12px 0',
    background: BRAND,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 16,
  };

  const btnSecondary: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: BRAND,
    fontSize: 14,
    cursor: 'pointer',
    padding: '4px 0',
    marginTop: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 8,
    fontSize: 15,
    boxSizing: 'border-box',
    marginTop: 6,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#333',
    display: 'block',
    marginTop: 16,
  };

  const methodBtn: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    background: '#fafafa',
    fontSize: 14,
    fontWeight: 500,
    color: '#222',
    cursor: 'pointer',
    marginBottom: 10,
    textAlign: 'left',
  };

  // --- Screens ---

  if (screen === 'method') {
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>{t.title}</div>
        <div style={subtitleStyle}>{t.subtitle}</div>
        {METHODS.map(({ key, i18nKey }) => (
          <button key={key} style={methodBtn} onClick={() => handleMethodSelect(key)}>
            {t[i18nKey]}
          </button>
        ))}
      </div>
    );
  }

  if (screen === 'backup_contact') {
    const isEmail = method === 'backup_email';
    return (
      <div style={cardStyle}>
        <button style={btnSecondary} onClick={() => setScreen('method')}>{t.back}</button>
        <div style={{ ...titleStyle, marginTop: 12 }}>{t.title}</div>
        <label style={labelStyle}>
          {isEmail ? t.backup_email_label : t.backup_phone_label}
          <input
            type={isEmail ? 'email' : 'tel'}
            style={inputStyle}
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder={isEmail ? t.backup_email_placeholder : t.backup_phone_placeholder}
            autoComplete={isEmail ? 'email' : 'tel'}
          />
        </label>
        <button
          style={{ ...btnPrimary, opacity: contact.trim() ? 1 : 0.5 }}
          disabled={!contact.trim() || loading}
          onClick={handleContactSubmit}
        >
          {loading ? t.submitting : t.submit}
        </button>
      </div>
    );
  }

  if (screen === 'id_attestation') {
    const canSubmit = fullName.trim() && dob && idFile && idConsent;
    return (
      <div style={cardStyle}>
        <button style={btnSecondary} onClick={() => setScreen('method')}>{t.back}</button>
        <div style={{ ...titleStyle, marginTop: 12 }}>{t.id_title}</div>
        <div style={subtitleStyle}>{t.id_body}</div>

        <label style={labelStyle}>
          {t.id_full_name_label}
          <input
            type="text"
            style={inputStyle}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder={t.id_full_name_placeholder}
            autoComplete="name"
          />
        </label>

        <label style={labelStyle}>
          {t.id_dob_label}
          <input
            type="date"
            style={inputStyle}
            value={dob}
            onChange={e => setDob(e.target.value)}
          />
        </label>

        <label style={labelStyle}>
          {t.id_upload_label}
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{t.id_upload_hint}</div>
          <input
            type="file"
            accept="image/jpeg,image/png"
            style={{ marginTop: 8, fontSize: 14 }}
            onChange={e => setIdFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label style={{ display: 'flex', gap: 10, marginTop: 20, fontSize: 13, color: '#444', lineHeight: 1.4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={idConsent}
            onChange={e => setIdConsent(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          {t.id_consent}
        </label>

        <button
          style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.5 }}
          disabled={!canSubmit || loading}
          onClick={handleIdSubmit}
        >
          {loading ? t.submitting : t.submit}
        </button>
      </div>
    );
  }

  if (screen === 'submitted') {
    const isId = method === 'id_attestation';
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
        <div style={titleStyle}>{t.submitted_title}</div>
        <div style={{ ...subtitleStyle, marginTop: 8 }}>
          {isId ? t.submitted_body_id : t.submitted_body_contact}
        </div>
        {fraudHold && (
          <div style={{
            background: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 13,
            color: '#92400E',
            marginTop: 16,
          }}>
            {t.fraud_hold_notice}
          </div>
        )}
      </div>
    );
  }

  if (screen === 'escalate') {
    return (
      <div style={cardStyle}>
        <button style={btnSecondary} onClick={() => setScreen('method')}>{t.back}</button>
        <div style={{ ...titleStyle, marginTop: 12 }}>{t.escalate_title}</div>
        <div style={{ ...subtitleStyle, marginTop: 8 }}>{t.escalate_body}</div>
        <a
          href={`mailto:${t.escalate_email}`}
          style={{
            display: 'inline-block',
            marginTop: 12,
            padding: '10px 20px',
            background: BRAND,
            color: '#fff',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {t.escalate_email}
        </a>
      </div>
    );
  }

  if (screen === 'error') {
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>{t.error_title}</div>
        <div style={{ ...subtitleStyle, color: '#DC2626' }}>{errorMsg}</div>
        <button style={btnPrimary} onClick={() => { setScreen('method'); setErrorMsg(''); }}>
          {t.error_retry}
        </button>
      </div>
    );
  }

  return null;
}
