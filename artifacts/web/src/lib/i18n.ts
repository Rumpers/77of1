export type Locale = "en" | "ja" | "zh-TW";
export const LOCALES: Locale[] = ["en", "ja", "zh-TW"];
export const DEFAULT_LOCALE: Locale = "en";

type Messages = {
  fan: {
    free_trial: string;
    send_message: string;
    subscribe: string;
    loading: string;
    not_found: string;
    powered_by: string;
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
  },
};

export function getMessages(locale: string): Messages {
  const loc = LOCALES.includes(locale as Locale) ? (locale as Locale) : DEFAULT_LOCALE;
  return messages[loc];
}

export function isValidLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale);
}
