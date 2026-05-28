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

type Messages = {
  version_history: {
    panel_title: string;
    version_label: string;
    by_label: string;
    hash_label: string;
    approved_badge: string;
    pending_badge: string;
    rejected_badge: string;
    expand_snapshot: string;
    collapse_snapshot: string;
    no_versions: string;
    loading: string;
    error_load: string;
    badge_tooltip_match: string;
    badge_tooltip_mismatch: string;
    modal_title: string;
    modal_version_warning: string;
    modal_hash_label: string;
    modal_confirm: string;
    modal_cancel: string;
    modal_submitting: string;
    modal_error: string;
    audit_title: string;
    audit_back: string;
    audit_draft: string;
    audit_approved: string;
    audit_posted: string;
    audit_mismatch_banner: string;
    audit_no_data: string;
    audit_loading: string;
    audit_error: string;
  };
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
    otp_email_placeholder: string;
    otp_send_button: string;
    otp_sending: string;
    otp_code_placeholder: string;
    otp_verify_button: string;
    otp_verifying: string;
    otp_back: string;
    otp_title: string;
    otp_subtitle: string;
    otp_check_email: string;
    otp_error_invalid: string;
    report_button: string;
    report_title: string;
    report_categories: {
      off_topic: string;
      abusive: string;
      inappropriate: string;
      fraud: string;
    };
    report_submit: string;
    report_cancel: string;
    report_success: string;
    // Phase 2 additions (UI-SPEC Copywriting Contract)
    empty_state: string;
    error_connection: string;
    error_paused: string;
    error_kyc: string;
    monetization_cta: string;
  };
  dsar: {
    page_title: string;
    page_subtitle: string;
    request_button: string;
    status_processing: string;
    status_ready: string;
    status_downloaded: string;
    status_expired: string;
    download_button: string;
    expires_label: string;
    cooldown_notice: string;
    cooldown_next: string;
    error_generic: string;
    error_auth: string;
    success_title: string;
    success_body: string;
    no_request_yet: string;
    data_rights_link: string;
    loading: string;
    creator_note: string;
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
    version_history: {
      panel_title: "Version history",
      version_label: "v{n}",
      by_label: "by {author}",
      hash_label: "#{hash}",
      approved_badge: "Approved",
      pending_badge: "Pending",
      rejected_badge: "Rejected",
      expand_snapshot: "View snapshot",
      collapse_snapshot: "Hide snapshot",
      no_versions: "No versions yet.",
      loading: "Loading versions…",
      error_load: "Failed to load versions.",
      badge_tooltip_match: "Approved version matches posted version",
      badge_tooltip_mismatch: "Warning: posted version differs from approved version",
      modal_title: "Request approval",
      modal_version_warning:
        "You are requesting approval for version {n}. Once approved, this version cannot be changed.",
      modal_hash_label: "Version hash: {hash}",
      modal_confirm: "Request approval",
      modal_cancel: "Cancel",
      modal_submitting: "Submitting…",
      modal_error: "Failed to submit approval request.",
      audit_title: "Lineage audit",
      audit_back: "← Back",
      audit_draft: "Draft v{n}",
      audit_approved: "Approved (v{n})",
      audit_posted: "Posted (v{n})",
      audit_mismatch_banner:
        "Warning: the posted version (v{posted}) does not match the approved version (v{approved}).",
      audit_no_data: "No lineage data found for this asset.",
      audit_loading: "Loading lineage…",
      audit_error: "Failed to load lineage.",
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
      otp_email_placeholder: "your@email.com",
      otp_send_button: "Send code",
      otp_sending: "Sending…",
      otp_code_placeholder: "6-digit code",
      otp_verify_button: "Continue",
      otp_verifying: "Verifying…",
      otp_back: "← Back",
      otp_title: "Sign in to continue",
      otp_subtitle: "Enter your email to get a one-time code. No password needed.",
      otp_check_email: "Check your email for the 6-digit code.",
      otp_error_invalid: "Invalid or expired code. Try again.",
      report_button: "Report",
      report_title: "Report this response",
      report_categories: {
        off_topic: "Off-topic",
        abusive: "Abusive",
        inappropriate: "Inappropriate",
        fraud: "Fraud / scam",
      },
      report_submit: "Submit report",
      report_cancel: "Cancel",
      report_success: "Report submitted. Thank you.",
      empty_state: "Say hi to {handle} ✨",
      error_connection: "Connection issue. Please try again.",
      error_paused: "{handle} is taking a short break. Check back soon.",
      error_kyc: "This twin isn't quite ready yet. Try again later.",
      monetization_cta: "Want more? Find me on {platform_name} →",
    },
    dsar: {
      page_title: "Your Data Rights",
      page_subtitle: "You can download a copy of all personal data 7of1 holds for your account. Requests are processed immediately.",
      request_button: "Request my data",
      status_processing: "Processing your request…",
      status_ready: "Your data is ready to download.",
      status_downloaded: "You've already downloaded your data.",
      status_expired: "Your download link has expired.",
      download_button: "Download my data (.json)",
      expires_label: "Link expires",
      cooldown_notice: "You already made a request recently.",
      cooldown_next: "You can request again after",
      error_generic: "Something went wrong. Please try again.",
      error_auth: "Please sign in to access your data.",
      success_title: "Request submitted",
      success_body: "Your data package is ready. Download it below. The link is valid for 30 days.",
      no_request_yet: "You haven't made a data request yet.",
      data_rights_link: "Your data rights",
      loading: "Loading…",
      creator_note: "As a creator, your download link is valid for 72 hours.",
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
    version_history: {
      panel_title: "バージョン履歴",
      version_label: "v{n}",
      by_label: "{author} による",
      hash_label: "#{hash}",
      approved_badge: "承認済み",
      pending_badge: "保留中",
      rejected_badge: "却下",
      expand_snapshot: "スナップショットを表示",
      collapse_snapshot: "スナップショットを閉じる",
      no_versions: "バージョンがまだありません。",
      loading: "バージョンを読み込み中…",
      error_load: "バージョンの読み込みに失敗しました。",
      badge_tooltip_match: "承認バージョンと投稿バージョンが一致しています",
      badge_tooltip_mismatch: "警告：投稿バージョンが承認バージョンと異なります",
      modal_title: "承認リクエスト",
      modal_version_warning:
        "バージョン {n} の承認をリクエストしています。承認後はこのバージョンを変更できません。",
      modal_hash_label: "バージョンハッシュ：{hash}",
      modal_confirm: "承認をリクエストする",
      modal_cancel: "キャンセル",
      modal_submitting: "送信中…",
      modal_error: "承認リクエストの送信に失敗しました。",
      audit_title: "系譜監査",
      audit_back: "← 戻る",
      audit_draft: "下書き v{n}",
      audit_approved: "承認済み（v{n}）",
      audit_posted: "投稿済み（v{n}）",
      audit_mismatch_banner:
        "警告：投稿バージョン（v{posted}）が承認バージョン（v{approved}）と一致しません。",
      audit_no_data: "このアセットの系譜データが見つかりません。",
      audit_loading: "系譜を読み込み中…",
      audit_error: "系譜の読み込みに失敗しました。",
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
      otp_email_placeholder: "メールアドレス",
      otp_send_button: "コードを送信",
      otp_sending: "送信中…",
      otp_code_placeholder: "6桁のコード",
      otp_verify_button: "続ける",
      otp_verifying: "確認中…",
      otp_back: "← 戻る",
      otp_title: "サインインして続ける",
      otp_subtitle: "メールアドレスを入力してワンタイムコードを受け取ってください。",
      otp_check_email: "6桁のコードをメールでご確認ください。",
      otp_error_invalid: "無効または期限切れのコードです。もう一度お試しください。",
      report_button: "報告",
      report_title: "この返答を報告する",
      report_categories: {
        off_topic: "関係のない内容",
        abusive: "侮辱的",
        inappropriate: "不適切",
        fraud: "詐欺・スパム",
      },
      report_submit: "報告を送信",
      report_cancel: "キャンセル",
      report_success: "報告を送信しました。ありがとうございます。",
      empty_state: "{handle}にあいさつしよう ✨",
      error_connection: "接続エラーが発生しました。もう一度お試しください。",
      error_paused: "{handle}は少し休憩中です。またあとで来てね。",
      error_kyc: "このツインはまだ準備中です。あとでまた来てね。",
      monetization_cta: "もっと話したい？{platform_name}で会えるよ →",
    },
    dsar: {
      page_title: "データに関する権利",
      page_subtitle: "7of1があなたのアカウントに保管しているすべての個人データのコピーをダウンロードできます。リクエストは即時処理されます。",
      request_button: "データをリクエストする",
      status_processing: "リクエストを処理中…",
      status_ready: "データのダウンロードの準備ができました。",
      status_downloaded: "すでにデータをダウンロードしています。",
      status_expired: "ダウンロードリンクの有効期限が切れました。",
      download_button: "データをダウンロード（.json）",
      expires_label: "リンクの有効期限",
      cooldown_notice: "最近リクエストを行いました。",
      cooldown_next: "次のリクエスト可能日時",
      error_generic: "エラーが発生しました。もう一度お試しください。",
      error_auth: "データにアクセスするにはサインインしてください。",
      success_title: "リクエスト完了",
      success_body: "データパッケージの準備ができました。以下からダウンロードしてください。リンクは30日間有効です。",
      no_request_yet: "まだデータリクエストを行っていません。",
      data_rights_link: "データに関する権利",
      loading: "読み込み中…",
      creator_note: "クリエイターの場合、ダウンロードリンクは72時間有効です。",
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
    version_history: {
      panel_title: "版本歷史",
      version_label: "v{n}",
      by_label: "由 {author}",
      hash_label: "#{hash}",
      approved_badge: "已核准",
      pending_badge: "待審核",
      rejected_badge: "已拒絕",
      expand_snapshot: "檢視快照",
      collapse_snapshot: "收起快照",
      no_versions: "尚無版本。",
      loading: "載入版本中…",
      error_load: "載入版本失敗。",
      badge_tooltip_match: "核准版本與發布版本一致",
      badge_tooltip_mismatch: "警告：發布版本與核准版本不一致",
      modal_title: "請求核准",
      modal_version_warning:
        "您正在請求核准版本 {n}。一旦核准，此版本將無法更改。",
      modal_hash_label: "版本雜湊：{hash}",
      modal_confirm: "請求核准",
      modal_cancel: "取消",
      modal_submitting: "提交中…",
      modal_error: "提交核准請求失敗。",
      audit_title: "版本歷程稽核",
      audit_back: "← 返回",
      audit_draft: "草稿 v{n}",
      audit_approved: "已核准（v{n}）",
      audit_posted: "已發布（v{n}）",
      audit_mismatch_banner:
        "警告：發布版本（v{posted}）與核准版本（v{approved}）不一致。",
      audit_no_data: "找不到此素材的版本歷程資料。",
      audit_loading: "載入版本歷程中…",
      audit_error: "載入版本歷程失敗。",
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
      otp_email_placeholder: "您的電子郵件",
      otp_send_button: "發送驗證碼",
      otp_sending: "發送中…",
      otp_code_placeholder: "6位數驗證碼",
      otp_verify_button: "繼續",
      otp_verifying: "驗證中…",
      otp_back: "← 返回",
      otp_title: "登入以繼續",
      otp_subtitle: "輸入您的電子郵件以取得一次性驗證碼。無需密碼。",
      otp_check_email: "請查看您的電子郵件中的6位數驗證碼。",
      otp_error_invalid: "驗證碼無效或已過期。請重試。",
      report_button: "檢舉",
      report_title: "檢舉此回覆",
      report_categories: {
        off_topic: "離題內容",
        abusive: "侮辱性內容",
        inappropriate: "不當內容",
        fraud: "詐騙／垃圾訊息",
      },
      report_submit: "送出檢舉",
      report_cancel: "取消",
      report_success: "檢舉已送出，謝謝您。",
      empty_state: "跟 {handle} 打個招呼 ✨",
      error_connection: "連線出問題了，請再試一次。",
      error_paused: "{handle} 暫時休息中，稍後再來看看。",
      error_kyc: "這個分身還沒準備好，請晚點再來。",
      monetization_cta: "想聊更多嗎？來 {platform_name} 找我 →",
    },
    dsar: {
      page_title: "您的資料權利",
      page_subtitle: "您可以下載 7of1 為您帳號保存的所有個人資料副本。請求將立即處理。",
      request_button: "請求我的資料",
      status_processing: "正在處理您的請求…",
      status_ready: "您的資料已準備好可以下載。",
      status_downloaded: "您已下載過您的資料。",
      status_expired: "您的下載連結已過期。",
      download_button: "下載我的資料（.json）",
      expires_label: "連結到期時間",
      cooldown_notice: "您最近已提出請求。",
      cooldown_next: "您可以在以下時間後再次請求",
      error_generic: "發生錯誤。請重試。",
      error_auth: "請登入以存取您的資料。",
      success_title: "請求已提交",
      success_body: "您的資料套件已準備好。請在下方下載。連結有效期為30天。",
      no_request_yet: "您尚未提出資料請求。",
      data_rights_link: "您的資料權利",
      loading: "載入中…",
      creator_note: "作為創作者，您的下載連結有效期為72小時。",
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
