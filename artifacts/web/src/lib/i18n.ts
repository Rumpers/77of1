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
  fan: {
    free_trial: string;
    send_message: string;
    subscribe: string;
    loading: string;
    not_found: string;
    powered_by: string;
  };
  onboard: {
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
    fan: {
      free_trial: "Start free trial",
      send_message: "Send a message",
      subscribe: "Subscribe",
      loading: "Loading...",
      not_found: "Creator not found",
      powered_by: "Powered by 7of1",
    },
    onboard: {
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
    fan: {
      free_trial: "無料トライアルを開始",
      send_message: "メッセージを送る",
      subscribe: "サブスクライブ",
      loading: "読み込み中…",
      not_found: "クリエイターが見つかりません",
      powered_by: "7of1 提供",
    },
    onboard: {
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
    fan: {
      free_trial: "開始免費試用",
      send_message: "傳送訊息",
      subscribe: "訂閱",
      loading: "載入中…",
      not_found: "找不到創作者",
      powered_by: "由 7of1 提供",
    },
    onboard: {
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
