export type Locale = "en" | "ja" | "zh-TW";
export const LOCALES: Locale[] = ["en", "ja", "zh-TW"];
export const DEFAULT_LOCALE: Locale = "en";

type ConsentItem = {
  label: string;
  emoji: string;
  description: string;
  required_note: string;
  legal: string;
};

type RecoverMessages = {
  contact_title: string;
  contact_subtitle: string;
  creator_handle_label: string;
  backup_email_label: string;
  or_label: string;
  backup_phone_label: string;
  contact_notice: string;
  contact_submit: string;
  attest_title: string;
  attest_subtitle: string;
  id_type_label: string;
  id_type_passport: string;
  id_type_national_id: string;
  id_type_drivers_license: string;
  id_image_label: string;
  id_image_choose: string;
  id_image_hint: string;
  attest_notice: string;
  attest_submit: string;
  done_title: string;
  done_body_simple: string;
  done_body_attested: string;
  done_support_hint: string;
  submitting: string;
  error_generic: string;
  powered_by: string;
};

type DsarMessages = {
  fan_tab: string;
  creator_tab: string;
  fan_title: string;
  fan_subtitle: string;
  email_label: string;
  email_placeholder: string;
  request_type_label: string;
  request_type_all: string;
  request_type_messages: string;
  request_type_account: string;
  fan_notice: string;
  fan_submit: string;
  creator_title: string;
  creator_subtitle: string;
  creator_email_label: string;
  creator_notice: string;
  creator_submit: string;
  submitting: string;
  error_generic: string;
  email_invalid: string;
  done_title: string;
  done_body_fan: string;
  done_body_creator: string;
  done_support_hint: string;
  powered_by: string;
};

type Messages = {
  recover: RecoverMessages;
  dsar: DsarMessages;
  fan: {
    free_trial: string;
    send_message: string;
    subscribe: string;
    loading: string;
    not_found: string;
    powered_by: string;
    disclosure_banner: string;
    chat_placeholder: string;
    ai_disclosure_footer: string;
    trial_remaining: string;
    trial_exhausted: string;
    paywall_title: string;
    paywall_subscribe: string;
    paywall_credits: string;
    paywall_escape: string;
    paywall_signup_cta: string;
    send: string;
  };
  onboard: {
    step1: {
      title: string;
      subtitle: string;
      photos_label: string;
      videos_label: string;
      photos_hint: string;
      videos_hint: string;
      consent_pending_notice: string;
      uploading: string;
      continue_button: string;
      min_photos_hint: string;
      min_videos_hint: string;
      upload_error: string;
    };
    step2: {
      title: string;
      subtitle: string;
      scenario_label: string;
      your_response: string;
      response_placeholder: string;
      min_scenarios_hint: string;
      scenarios_done: string;
      continue_button: string;
      skip_label: string;
    };
    step3: {
      title: string;
      subtitle: string;
      required_badge: string;
      optional_badge: string;
      yes_label: string;
      no_label: string;
      legal_expand: string;
      legal_collapse: string;
      continue_button: string;
      continue_disabled_hint: string;
      summary: {
        title: string;
        subtitle: string;
        granted: string;
        denied: string;
        confirm_button: string;
        back_button: string;
      };
      success: {
        title: string;
        body_with_persona: string;
        body_no_persona: string;
        done_label: string;
      };
      items: {
        persona_text: ConsentItem;
        voice: ConsentItem;
        image: ConsentItem;
        talking_video: ConsentItem;
        fullbody_video: ConsentItem;
      };
    };
  };
};

const messages: Record<Locale, Messages> = {
  en: {
    dsar: {
      fan_tab: "My Data",
      creator_tab: "Creator Export",
      fan_title: "Download your data",
      fan_subtitle: "Request a copy of all data 7of1 holds about you. We'll email you a secure download link.",
      email_label: "Your email address",
      email_placeholder: "you@email.com",
      request_type_label: "What data do you want?",
      request_type_all: "Everything (messages, credits, account)",
      request_type_messages: "Chat messages only",
      request_type_account: "Account & billing only",
      fan_notice: "We'll prepare your download and email you a secure link within 30 days, as required by our privacy policy (§16).",
      fan_submit: "Request my data",
      creator_title: "Export your creator data",
      creator_subtitle: "Request a full export of your creator data. Delivered to your account email within 72 hours.",
      creator_email_label: "Creator account email",
      creator_notice: "You'll receive a secure download link at your account email within 72 hours per §16 of our Terms of Service.",
      creator_submit: "Request export",
      submitting: "Submitting…",
      error_generic: "Something went wrong. Please try again.",
      email_invalid: "Please enter a valid email address.",
      done_title: "Request received",
      done_body_fan: "We've received your data request. You'll receive a secure download link at {email} within 30 days.",
      done_body_creator: "We've received your export request. You'll receive a download link at {email} within 72 hours.",
      done_support_hint: "Questions? Email privacy@7of1.com",
      powered_by: "Powered by 7of1",
    },
    recover: {
      contact_title: "Recover your account",
      contact_subtitle: "Tell us which creator's chat you had and how to reach you.",
      creator_handle_label: "Creator handle",
      backup_email_label: "Your backup email",
      or_label: "— or —",
      backup_phone_label: "Your phone number",
      contact_notice: "We'll only use this contact to verify your identity and never share it.",
      contact_submit: "Continue",
      attest_title: "Verify your identity",
      attest_subtitle: "Your credit balance requires government-issued ID to recover.",
      id_type_label: "Document type",
      id_type_passport: "Passport",
      id_type_national_id: "National ID card",
      id_type_drivers_license: "Driver's license",
      id_image_label: "Upload document photo",
      id_image_choose: "Choose image…",
      id_image_hint: "JPG, PNG or WEBP · Max 10 MB · Clearly shows name and photo",
      attest_notice: "Your document is encrypted in transit and at rest. It is used only to verify this recovery request and deleted within 30 days.",
      attest_submit: "Submit for review",
      done_title: "Request received",
      done_body_simple: "We've received your recovery request. Our team will send instructions to your backup contact within 1 business day.",
      done_body_attested: "We've received your request and identity document. Your credit balance requires manual review. Expect a response within 2–3 business days.",
      done_support_hint: "Need urgent help? Email support@7of1.com",
      submitting: "Submitting…",
      error_generic: "Something went wrong. Please try again.",
      powered_by: "Powered by 7of1",
    },
    fan: {
      free_trial: "Start free trial",
      send_message: "Send a message",
      subscribe: "Subscribe",
      loading: "Loading...",
      not_found: "Creator not found",
      powered_by: "Powered by 7of1",
      disclosure_banner: "This is an AI twin, not a real person",
      chat_placeholder: "Message @{handle}'s AI twin…",
      ai_disclosure_footer: "AI twin · @{handle}_ai",
      trial_remaining: "{n} free messages left",
      trial_exhausted: "You've used all 3 free messages",
      paywall_title: "Continue chatting",
      paywall_subscribe: "Subscribe ¥980/mo",
      paywall_credits: "Buy credits ¥490",
      paywall_escape: "Open in browser to complete payment",
      paywall_signup_cta: "Create account to save your chat",
      send: "Send",
    },
    onboard: {
      step1: {
        title: "Upload your content",
        subtitle: "Add photos and videos so your twin looks and sounds like you.",
        photos_label: "Photos (5–25 images)",
        videos_label: "Videos (2–3 clips)",
        photos_hint: "JPG, PNG, WEBP · Max 10 MB each",
        videos_hint: "MP4, MOV · Max 100 MB each · 15s–5min",
        consent_pending_notice:
          "Files are stored securely. AI processing starts only after you complete Step 3 consent.",
        uploading: "Uploading…",
        continue_button: "Continue to persona",
        min_photos_hint: "Add at least 5 photos to continue",
        min_videos_hint: "Add at least 2 videos to continue",
        upload_error: "Upload failed. Please try again.",
      },
      step2: {
        title: "Train your persona",
        subtitle:
          "Answer each scenario how you'd actually respond to a fan. Your twin will learn from these.",
        scenario_label: "Scenario {n} of {total}",
        your_response: "Your response",
        response_placeholder: "How would you reply to this fan message?",
        min_scenarios_hint: "Complete {n} more scenarios to continue",
        scenarios_done: "{n}/{total} scenarios complete",
        continue_button: "Continue to consent",
        skip_label: "Skip this scenario",
      },
      step3: {
        title: "Your consent",
        subtitle:
          "You choose exactly what you're comfortable with. You can change these anytime via Hermes or your dashboard.",
        required_badge: "Required",
        optional_badge: "Optional",
        yes_label: "Yes",
        no_label: "No",
        legal_expand: "Read full legal terms",
        legal_collapse: "Collapse",
        continue_button: "Review my choices",
        continue_disabled_hint: "Answer all items to continue",
        summary: {
          title: "Review your choices",
          subtitle: "Review carefully before confirming. You can change these anytime.",
          granted: "Granted",
          denied: "Not granted",
          confirm_button: "Confirm consent",
          back_button: "Change my answers",
        },
        success: {
          title: "Consent recorded",
          body_with_persona:
            "Your twin production is starting now. Hermes will message you when it's ready.",
          body_no_persona:
            "Your consent has been recorded. Your AI twin needs the Persona / Text permission to work — you can grant it anytime via Hermes or your dashboard.",
          done_label: "Done",
        },
        items: {
          persona_text: {
            label: "Persona / Text Twin",
            emoji: "🧠",
            description:
              "I'll train an AI on your captions, messages, and the responses you gave me — so your twin talks like you.",
            required_note: "Required for your twin to work.",
            legal:
              "7of1 will process your public captions, provided DMs, and persona exercise responses to train a language model representing your communication style. This data is used solely to operate your AI twin. You retain copyright in all original content. 7of1 receives a limited, non-exclusive, revocable licence for the duration of your account. On account termination, all trained model weights derived from your content are deleted within 14 calendar days. See §3 of the Creator Terms of Service for full terms.",
          },
          voice: {
            label: "Voice Model",
            emoji: "🎙",
            description:
              "I'll clone your voice from your talking videos so your twin can send voice notes in your voice.",
            required_note: "Optional — your twin works without it.",
            legal:
              "7of1 will create a voice synthesis model from your uploaded talking videos. This model generates voice notes in your voice for fan interactions. Your voice model is stored encrypted at rest. Revocation immediately disables new voice note generation; previously delivered content is not recalled. On account termination, voice model weights are deleted within 14 calendar days. See §3 of the Creator Terms of Service.",
          },
          image: {
            label: "Image Model",
            emoji: "📸",
            description: "I'll generate still images from your photos, visible to fans.",
            required_note: "Optional.",
            legal:
              "7of1 will use your uploaded photos to generate still images for fan-visible content including shareable posts and fan page visuals. All generated images are moderated before delivery. Revocation halts new image generation. On account termination, LoRA adapters trained on your images are deleted within 14 calendar days. See §3 and §21.3 of the Creator Terms of Service.",
          },
          talking_video: {
            label: "Talking Video (Avatar)",
            emoji: "📹",
            description:
              "I'll create a video avatar that lip-syncs to your twin's messages, using your face and voice together.",
            required_note: "Optional.",
            legal:
              "7of1 will generate video of your likeness (face and synthesised voice) lip-syncing to AI-generated messages. This requires both your image data and voice model. All generated video is moderated before delivery. Revocation cancels in-flight generation within 60 seconds and suppresses queued delivery. See §3 and §21.3 of the Creator Terms of Service.",
          },
          fullbody_video: {
            label: "Full-Body / Motion Video",
            emoji: "🕺",
            description:
              "I'll generate video of your body in motion. This is the highest tier — only for creators fully comfortable with full-body video generation.",
            required_note: "Optional. Only for creators comfortable with full-body video generation.",
            legal:
              "7of1 will generate full-body motion video of your likeness using your image model and motion reference data. This is the highest-tier AI generation capability. All generated video is strictly moderated. Revocation cancels in-flight jobs within 60 seconds and suppresses queued delivery. This permission may not be available in all markets. See §3, §21.3, and §21.4 of the Creator Terms of Service.",
          },
        },
      },
    },
  },

  ja: {
    dsar: {
      fan_tab: "マイデータ",
      creator_tab: "クリエイターエクスポート",
      fan_title: "データをダウンロード",
      fan_subtitle: "7of1があなたについて保持するデータのコピーをリクエストします。安全なダウンロードリンクをメールでお送りします。",
      email_label: "メールアドレス",
      email_placeholder: "you@email.com",
      request_type_label: "どのデータが必要ですか？",
      request_type_all: "すべて（メッセージ、クレジット、アカウント）",
      request_type_messages: "チャットメッセージのみ",
      request_type_account: "アカウントと請求情報のみ",
      fan_notice: "プライバシーポリシー（§16）に従い、30日以内に安全なダウンロードリンクをメールでお送りします。",
      fan_submit: "データをリクエスト",
      creator_title: "クリエイターデータのエクスポート",
      creator_subtitle: "クリエイターデータのフルエクスポートをリクエストします。72時間以内にアカウントのメールアドレスにお届けします。",
      creator_email_label: "クリエイターアカウントのメールアドレス",
      creator_notice: "利用規約 §16 に従い、72時間以内にアカウントのメールアドレスに安全なダウンロードリンクをお送りします。",
      creator_submit: "エクスポートをリクエスト",
      submitting: "送信中…",
      error_generic: "エラーが発生しました。もう一度お試しください。",
      email_invalid: "有効なメールアドレスを入力してください。",
      done_title: "受け付けました",
      done_body_fan: "データリクエストを受け付けました。30日以内に安全なダウンロードリンクを {email} にお送りします。",
      done_body_creator: "エクスポートリクエストを受け付けました。72時間以内にダウンロードリンクを {email} にお送りします。",
      done_support_hint: "ご質問は privacy@7of1.com まで",
      powered_by: "7of1 提供",
    },
    recover: {
      contact_title: "アカウントを復元する",
      contact_subtitle: "チャットしていたクリエイターのハンドルと連絡先をお教えください。",
      creator_handle_label: "クリエイターのハンドル",
      backup_email_label: "予備のメールアドレス",
      or_label: "— または —",
      backup_phone_label: "電話番号",
      contact_notice: "この連絡先は本人確認のみに使用し、第三者に提供することはありません。",
      contact_submit: "次へ",
      attest_title: "本人確認",
      attest_subtitle: "クレジット残高を復元するには、公的身分証明書が必要です。",
      id_type_label: "書類の種類",
      id_type_passport: "パスポート",
      id_type_national_id: "マイナンバーカード / 健康保険証",
      id_type_drivers_license: "運転免許証",
      id_image_label: "書類の写真をアップロード",
      id_image_choose: "画像を選択…",
      id_image_hint: "JPG、PNG、WEBP · 最大10MB · 氏名と顔写真が鮮明に写ったもの",
      attest_notice: "書類は暗号化して送受信・保存されます。本人確認のみに使用し、30日以内に削除します。",
      attest_submit: "審査のために送信",
      done_title: "受け付けました",
      done_body_simple: "復元リクエストを受け付けました。1営業日以内に予備の連絡先へ手順をお送りします。",
      done_body_attested: "リクエストと身分証明書を受け付けました。クレジット残高の確認に2〜3営業日かかります。",
      done_support_hint: "お急ぎの方はサポートへ: support@7of1.com",
      submitting: "送信中…",
      error_generic: "エラーが発生しました。もう一度お試しください。",
      powered_by: "7of1 提供",
    },
    fan: {
      free_trial: "無料トライアルを開始",
      send_message: "メッセージを送る",
      subscribe: "サブスクライブ",
      loading: "読み込み中…",
      not_found: "クリエイターが見つかりません",
      powered_by: "7of1 提供",
      disclosure_banner: "これはAIツインです。本人ではありません",
      chat_placeholder: "@{handle}のAIツインにメッセージを送る",
      ai_disclosure_footer: "AIツイン · @{handle}_ai",
      trial_remaining: "あと{n}回無料メッセージできます",
      trial_exhausted: "無料メッセージ3回を使い切りました",
      paywall_title: "チャットを続ける",
      paywall_subscribe: "サブスクライブ ¥980/月",
      paywall_credits: "クレジットを購入 ¥490",
      paywall_escape: "ブラウザで開いて支払いを完了する",
      paywall_signup_cta: "アカウントを作成してチャットを保存",
      send: "送信",
    },
    onboard: {
      step1: {
        title: "コンテンツをアップロード",
        subtitle: "写真と動画を追加して、あなたのツインをあなたらしく仕上げましょう。",
        photos_label: "写真（5〜25枚）",
        videos_label: "動画（2〜3クリップ）",
        photos_hint: "JPG、PNG、WEBP · 各最大10 MB",
        videos_hint: "MP4、MOV · 各最大100 MB · 15秒〜5分",
        consent_pending_notice:
          "ファイルは安全に保存されます。AIの処理はステップ3の同意完了後に開始されます。",
        uploading: "アップロード中…",
        continue_button: "ペルソナへ進む",
        min_photos_hint: "続けるには写真を5枚以上追加してください",
        min_videos_hint: "続けるには動画を2本以上追加してください",
        upload_error: "アップロードに失敗しました。もう一度お試しください。",
      },
      step2: {
        title: "ペルソナをトレーニング",
        subtitle:
          "ファンへの返答を実際のように答えてください。あなたのツインがそこから学習します。",
        scenario_label: "シナリオ {n}/{total}",
        your_response: "あなたの返答",
        response_placeholder: "このファンメッセージにどう返しますか？",
        min_scenarios_hint: "続けるにはあと{n}つのシナリオを完了してください",
        scenarios_done: "{n}/{total} シナリオ完了",
        continue_button: "同意へ進む",
        skip_label: "このシナリオをスキップ",
      },
      step3: {
        title: "同意の確認",
        subtitle:
          "ご自身が許可できる範囲を選択してください。いつでも Hermes またはダッシュボードから変更できます。",
        required_badge: "必須",
        optional_badge: "任意",
        yes_label: "はい",
        no_label: "いいえ",
        legal_expand: "法的条件の全文を読む",
        legal_collapse: "閉じる",
        continue_button: "選択内容を確認する",
        continue_disabled_hint: "すべての項目に回答してください",
        summary: {
          title: "選択内容の確認",
          subtitle: "確定する前に内容をよく確認してください。いつでも変更できます。",
          granted: "許可済み",
          denied: "不許可",
          confirm_button: "同意を確定する",
          back_button: "回答を変更する",
        },
        success: {
          title: "同意が記録されました",
          body_with_persona:
            "AIツインの制作を開始します。準備ができ次第 Hermes からご連絡します。",
          body_no_persona:
            "同意が記録されました。AIツインにはペルソナ／テキストの許可が必要です。いつでも Hermes またはダッシュボードから許可できます。",
          done_label: "完了",
        },
        items: {
          persona_text: {
            label: "ペルソナ／テキストツイン",
            emoji: "🧠",
            description:
              "あなたのキャプション、メッセージ、ペルソナの回答をもとにAIを学習させ、あなたらしく話せるツインを作ります。",
            required_note: "必須 — ツインの動作に必要です。",
            legal:
              "7of1 は、あなたの公開キャプション、提供された DM、およびペルソナ演習の回答を処理し、あなたのコミュニケーションスタイルを表す言語モデルを学習します。このデータはAIツインの運営にのみ使用されます。元のコンテンツの著作権はあなたに帰属します。7of1 はアカウント期間中のみ、限定的・非独占的・取消可能なライセンスを受けます。アカウント解約時、コンテンツから生成されたモデルの重みは14暦日以内に削除されます。詳細はクリエイター利用規約 §3 をご覧ください。",
          },
          voice: {
            label: "ボイスモデル",
            emoji: "🎙",
            description:
              "トーキングビデオからあなたの声を複製し、ツインがあなたの声でボイスノートを送れるようにします。",
            required_note: "任意 — なくてもツインは動作します。",
            legal:
              "7of1 はアップロードされたトーキングビデオから音声合成モデルを作成します。このモデルはファンとのやり取りであなたの声のボイスノートを生成します。ボイスモデルは暗号化して保存されます。許可を取り消すと新しいボイスノートの生成は直ちに停止しますが、既に配信済みのコンテンツは取り消されません。アカウント解約時は14暦日以内に削除されます。クリエイター利用規約 §3 をご覧ください。",
          },
          image: {
            label: "イメージモデル",
            emoji: "📸",
            description: "あなたの写真から静止画を生成し、ファンが閲覧できるようにします。",
            required_note: "任意。",
            legal:
              "7of1 はアップロードされた写真を使用して、シェア用投稿やファンページのビジュアルなど、ファンが閲覧できる静止画を生成します。生成された画像はすべて配信前にモデレーションされます。許可を取り消すと新しい画像生成が停止します。アカウント解約時は14暦日以内に削除されます。クリエイター利用規約 §3 および §21.3 をご覧ください。",
          },
          talking_video: {
            label: "トーキングビデオ（アバター）",
            emoji: "📹",
            description:
              "ツインのメッセージにリップシンクするビデオアバターを作成します。顔と声を組み合わせて使用します。",
            required_note: "任意。",
            legal:
              "7of1 はあなたの外見（顔とAI合成音声）がAI生成メッセージにリップシンクするビデオを生成します。画像データとボイスモデルの両方が必要です。生成されたビデオはすべて配信前にモデレーションされます。許可を取り消すと進行中の生成は60秒以内にキャンセルされます。クリエイター利用規約 §3 および §21.3 をご覧ください。",
          },
          fullbody_video: {
            label: "全身／モーションビデオ",
            emoji: "🕺",
            description:
              "あなたの全身が動くビデオを生成します。全身ビデオ生成に完全に対応したクリエイター向けの最上位ティアです。",
            required_note: "任意。全身ビデオ生成に対応したクリエイター向けです。",
            legal:
              "7of1 はイメージモデルとモーション参照データを使用して、あなたの全身が動くビデオを生成します。これは最高ティアのAI生成機能です。生成されたビデオはすべて厳格にモデレーションされます。許可を取り消すと進行中のジョブは60秒以内にキャンセルされ、キューに入った配信も停止されます。一部の市場では利用できない場合があります。クリエイター利用規約 §3、§21.3、および §21.4 をご覧ください。",
          },
        },
      },
    },
  },

  "zh-TW": {
    dsar: {
      fan_tab: "我的資料",
      creator_tab: "創作者匯出",
      fan_title: "下載您的資料",
      fan_subtitle: "申請取得 7of1 持有的您的所有資料副本。我們將以電子郵件傳送安全的下載連結。",
      email_label: "您的電子郵件地址",
      email_placeholder: "you@email.com",
      request_type_label: "您想要哪些資料？",
      request_type_all: "所有資料（訊息、點數、帳號）",
      request_type_messages: "僅限聊天訊息",
      request_type_account: "僅限帳號與帳單資料",
      fan_notice: "依據我們的隱私權政策（§16），我們將在 30 天內以電子郵件傳送安全的下載連結給您。",
      fan_submit: "申請我的資料",
      creator_title: "匯出您的創作者資料",
      creator_subtitle: "申請完整的創作者資料匯出，將在 72 小時內傳送至您的帳號電子郵件。",
      creator_email_label: "創作者帳號電子郵件",
      creator_notice: "依據服務條款 §16，您將在 72 小時內收到傳送至您帳號電子郵件的安全下載連結。",
      creator_submit: "申請匯出",
      submitting: "提交中…",
      error_generic: "發生錯誤，請重試。",
      email_invalid: "請輸入有效的電子郵件地址。",
      done_title: "申請已收到",
      done_body_fan: "我們已收到您的資料申請，將在 30 天內傳送安全的下載連結至 {email}。",
      done_body_creator: "我們已收到您的匯出申請，將在 72 小時內傳送下載連結至 {email}。",
      done_support_hint: "有任何問題？請電郵 privacy@7of1.com",
      powered_by: "由 7of1 提供",
    },
    recover: {
      contact_title: "找回您的帳號",
      contact_subtitle: "請告訴我們您聊天的創作者帳號及您的聯絡方式。",
      creator_handle_label: "創作者帳號",
      backup_email_label: "備用電子郵件",
      or_label: "— 或 —",
      backup_phone_label: "電話號碼",
      contact_notice: "此聯絡方式僅用於驗證您的身份，不會與第三方分享。",
      contact_submit: "繼續",
      attest_title: "驗證身份",
      attest_subtitle: "您的點數餘額需要政府核發的身份證件才能找回。",
      id_type_label: "證件類型",
      id_type_passport: "護照",
      id_type_national_id: "國民身分證",
      id_type_drivers_license: "駕照",
      id_image_label: "上傳證件照片",
      id_image_choose: "選擇圖片…",
      id_image_hint: "JPG、PNG 或 WEBP · 最大 10 MB · 清楚顯示姓名與照片",
      attest_notice: "您的證件在傳輸和儲存時均已加密，僅用於驗證此找回申請，並將於 30 天內刪除。",
      attest_submit: "提交審核",
      done_title: "申請已收到",
      done_body_simple: "我們已收到您的找回申請。我們的團隊將在 1 個工作日內傳送指示至您的備用聯絡方式。",
      done_body_attested: "我們已收到您的申請及身份證件。您的點數餘額需要人工審核，請在 2–3 個工作日內等待回覆。",
      done_support_hint: "需要緊急協助？請電郵 support@7of1.com",
      submitting: "提交中…",
      error_generic: "發生錯誤，請重試。",
      powered_by: "由 7of1 提供",
    },
    fan: {
      free_trial: "開始免費試用",
      send_message: "傳送訊息",
      subscribe: "訂閱",
      loading: "載入中…",
      not_found: "找不到創作者",
      powered_by: "由 7of1 提供",
      disclosure_banner: "這是AI分身，不是真人",
      chat_placeholder: "傳訊息給@{handle}的AI分身…",
      ai_disclosure_footer: "AI分身 · @{handle}_ai",
      trial_remaining: "還剩{n}次免費訊息",
      trial_exhausted: "您已用完3次免費訊息",
      paywall_title: "繼續聊天",
      paywall_subscribe: "訂閱 ¥980/月",
      paywall_credits: "購買點數 ¥490",
      paywall_escape: "在瀏覽器中開啟以完成付款",
      paywall_signup_cta: "建立帳號以儲存對話",
      send: "傳送",
    },
    onboard: {
      step1: {
        title: "上傳您的內容",
        subtitle: "新增照片和影片，讓您的分身看起來和聽起來都像您。",
        photos_label: "照片（5–25 張）",
        videos_label: "影片（2–3 片）",
        photos_hint: "JPG、PNG、WEBP · 每張最大 10 MB",
        videos_hint: "MP4、MOV · 每片最大 100 MB · 15秒–5分鐘",
        consent_pending_notice:
          "檔案已安全儲存。AI 處理僅在您完成第 3 步同意後才會開始。",
        uploading: "上傳中…",
        continue_button: "繼續設定人格",
        min_photos_hint: "至少新增 5 張照片才能繼續",
        min_videos_hint: "至少新增 2 段影片才能繼續",
        upload_error: "上傳失敗。請重試。",
      },
      step2: {
        title: "訓練您的人格",
        subtitle: "用您實際回覆粉絲的方式回答每個情境。您的分身將從中學習。",
        scenario_label: "情境 {n} / {total}",
        your_response: "您的回覆",
        response_placeholder: "您會如何回覆這條粉絲訊息？",
        min_scenarios_hint: "再完成 {n} 個情境才能繼續",
        scenarios_done: "{n}/{total} 個情境已完成",
        continue_button: "繼續同意步驟",
        skip_label: "跳過此情境",
      },
      step3: {
        title: "同意確認",
        subtitle: "您可以自行選擇願意授權的範圍，隨時可透過 Hermes 或儀表板更改。",
        required_badge: "必填",
        optional_badge: "選填",
        yes_label: "是",
        no_label: "否",
        legal_expand: "閱讀完整法律條款",
        legal_collapse: "收起",
        continue_button: "確認我的選擇",
        continue_disabled_hint: "請回答所有項目以繼續",
        summary: {
          title: "確認您的選擇",
          subtitle: "確認前請仔細閱讀。您可以隨時更改。",
          granted: "已授權",
          denied: "未授權",
          confirm_button: "確認同意",
          back_button: "修改回答",
        },
        success: {
          title: "同意已記錄",
          body_with_persona: "您的 AI 分身製作即將開始。準備好後 Hermes 會通知您。",
          body_no_persona:
            "您的同意已記錄。AI 分身需要人格／文字的授權才能運作，您可隨時透過 Hermes 或儀表板授予。",
          done_label: "完成",
        },
        items: {
          persona_text: {
            label: "人格／文字分身",
            emoji: "🧠",
            description:
              "我將根據您的說明文字、訊息和人格問卷回答訓練 AI，讓您的分身說話像您一樣。",
            required_note: "必填 — 分身運作所需。",
            legal:
              "7of1 將處理您的公開說明文字、提供的私訊及人格問卷回答，以訓練代表您溝通風格的語言模型。此資料僅用於運營您的 AI 分身。您保留所有原始內容的著作權。7of1 在帳戶期間內獲得有限、非專屬、可撤銷的授權。帳戶終止時，從您的內容訓練的模型權重將於 14 個日曆日內刪除。詳情請參閱創作者服務條款 §3。",
          },
          voice: {
            label: "聲音模型",
            emoji: "🎙",
            description:
              "我將從您的說話影片複製您的聲音，讓您的分身能用您的聲音傳送語音訊息。",
            required_note: "選填 — 沒有此授權分身仍可運作。",
            legal:
              "7of1 將從您上傳的說話影片建立語音合成模型。此模型用於為粉絲互動生成您聲音的語音訊息。您的聲音模型以加密方式儲存。撤銷授權將立即停止新語音訊息的生成，已傳送的內容不受影響。帳戶終止時將於 14 個日曆日內刪除。請參閱創作者服務條款 §3。",
          },
          image: {
            label: "圖像模型",
            emoji: "📸",
            description: "我將根據您的照片生成靜態圖像，供粉絲瀏覽。",
            required_note: "選填。",
            legal:
              "7of1 將使用您上傳的照片生成粉絲可見的靜態圖像，包括分享貼文和粉絲頁面視覺效果。所有生成的圖像在傳送前均經過審核。撤銷授權將停止新圖像的生成。帳戶終止時將於 14 個日曆日內刪除。請參閱創作者服務條款 §3 和 §21.3。",
          },
          talking_video: {
            label: "說話影片（虛擬替身）",
            emoji: "📹",
            description:
              "我將建立一個與您的分身訊息同步對嘴的影片虛擬替身，結合您的臉部和聲音。",
            required_note: "選填。",
            legal:
              "7of1 將生成您的外貌（臉部和 AI 合成聲音）與 AI 生成訊息同步對嘴的影片。這需要您的圖像資料和聲音模型。所有生成的影片在傳送前均經過審核。撤銷授權將在 60 秒內取消進行中的生成。請參閱創作者服務條款 §3 和 §21.3。",
          },
          fullbody_video: {
            label: "全身／動作影片",
            emoji: "🕺",
            description:
              "我將生成您全身動作的影片。這是最高階功能，僅適用於完全接受全身影片生成的創作者。",
            required_note: "選填。僅適用於接受全身影片生成的創作者。",
            legal:
              "7of1 將使用您的圖像模型和動作參考資料生成您全身動作的影片。這是最高階的 AI 生成功能。所有生成的影片均受嚴格審核。撤銷授權將在 60 秒內取消進行中的工作並停止排隊中的傳送。此授權在部分市場可能無法使用。請參閱創作者服務條款 §3、§21.3 和 §21.4。",
          },
        },
      },
    },
  },
};

export function getMessages(locale: string): Messages {
  const loc = LOCALES.includes(locale as Locale) ? (locale as Locale) : DEFAULT_LOCALE;
  return messages[loc];
}

export function isValidLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale);
}
