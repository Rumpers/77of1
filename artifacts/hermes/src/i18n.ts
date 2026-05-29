// Hermes i18n — UI strings for creator-facing messages.
// Languages: 'en' | 'ja' | 'zh-tw'
// All strings MUST be present in every locale.

export type Lang = 'en' | 'ja' | 'zh-tw';

const strings = {
  en: {
    notLinked: "Your Telegram account isn't linked. Use /start to connect.",
    twinActive: '▶️ Active',
    twinPaused: '⏸ Paused',

    pauseOk: (elapsed: number) =>
      `⏸ Twin paused. Your AI presence is offline.\n\nUse /resume to reactivate.\n\n_(DB write: ${elapsed}ms)_`,
    resumeOk: '▶️ Twin reactivated. Your AI presence is live again.',

    statusTitle: (name: string) => `*${name} — Status*`,
    statusTwin: (state: string) => `Twin: ${state}`,
    statusFans: (n: number) => `Active fans: ${n}`,
    statusCredits: 'Credit balance: coming in Slice 2',

    revenueTitle: (name: string) => `*${name} — Revenue*`,
    revenueGmvToday: 'Today GMV: — _(ledger live in Slice 2)_',
    revenueGmvWeek: 'This week GMV: — _(ledger live in Slice 2)_',
    revenuePacks: 'Credit pack sales: — _(ledger live in Slice 2)_',
    revenueFans: (n: number) => `Active fans: ${n}`,
    revenueShare: 'Your share: 80% of GMV',

    tzSetOk: (tz: string) =>
      `✅ Timezone set to *${tz}*.\n\nRevenue summaries and nudges will use this timezone.`,
    tzInvalid: (input: string) =>
      `❌ Unknown timezone: *${input}*.\n\nUse an IANA timezone like \`Asia/Tokyo\`, \`Asia/Taipei\`, \`America/New_York\`, or a shortcut: \`JP\`, \`TW\`, \`US/East\`, \`US/West\`.\n\nSend /timezone to see your current setting.`,
    tzCurrent: (tz: string) =>
      `Your current timezone is *${tz}*.\n\nTo change it: /timezone <tz> (e.g. /timezone Asia\\/Tokyo)`,

    langSetOk: (lang: string) =>
      `✅ Hermes language set to *${lang}*.\n\nI'll message you in this language from now on.`,
    langInvalid: (input: string) =>
      `❌ Unknown language: *${input}*.\n\nChoose from:\n• \`en\` — English\n• \`ja\` — 日本語\n• \`zh-tw\` — 繁體中文\n\nSend /language to see your current setting.`,
    langCurrent: (lang: string) =>
      `Your current Hermes language is *${lang}*.\n\nTo change it: /language <lang> (e.g. /language ja)`,

    dsarHeader: "⚠️ Data Deletion Request",
    dsarWarning: "This will permanently delete:\n  • All fan conversation history with your twin\n  • Your voice reference sample\n  • Your persona / constitution\n  • All generated voice files\n\nYour twin will go offline IMMEDIATELY. Deletion completes within 24 hours.",
    dsarConfirmPrompt: "Type CONFIRM to proceed, or /cancel to abort.",
    dsarCancelled: "Cancelled. Send /dsar again if you change your mind.",
    dsarConfirmedTemplate: "Confirmed. Your twin is now offline. Audit ID: {auditId}\n\nAll data will be deleted within 24 hours. You'll receive a final confirmation when complete.",
    dsarError: "Could not process DSAR right now. Please contact support if this persists.",
  },

  ja: {
    notLinked: 'Telegramアカウントが未連携です。/start で接続してください。',
    twinActive: '▶️ 稼働中',
    twinPaused: '⏸ 一時停止中',

    pauseOk: (elapsed: number) =>
      `⏸ ツインを一時停止しました。AI プレゼンスはオフラインです。\n\n再開するには /resume を送ってください。\n\n_(DB書き込み: ${elapsed}ms)_`,
    resumeOk: '▶️ ツインを再開しました。AI プレゼンスが再稼働しました。',

    statusTitle: (name: string) => `*${name} — ステータス*`,
    statusTwin: (state: string) => `ツイン: ${state}`,
    statusFans: (n: number) => `アクティブファン: ${n}`,
    statusCredits: 'クレジット残高: Slice 2 で対応予定',

    revenueTitle: (name: string) => `*${name} — 収益*`,
    revenueGmvToday: '本日の GMV: — _(Slice 2 で対応予定)_',
    revenueGmvWeek: '今週の GMV: — _(Slice 2 で対応予定)_',
    revenuePacks: 'クレジットパック売上: — _(Slice 2 で対応予定)_',
    revenueFans: (n: number) => `アクティブファン: ${n}`,
    revenueShare: 'あなたの取り分: GMV の 80%',

    tzSetOk: (tz: string) =>
      `✅ タイムゾーンを *${tz}* に設定しました。\n\n収益サマリーやリマインダーはこのタイムゾーンで表示されます。`,
    tzInvalid: (input: string) =>
      `❌ 不明なタイムゾーン: *${input}*\n\nIANA タイムゾーン（例: \`Asia/Tokyo\`, \`Asia/Taipei\`, \`America/New_York\`）またはショートカット（\`JP\`, \`TW\`, \`US/East\`, \`US/West\`）を指定してください。\n\n現在の設定を確認するには /timezone を送信してください。`,
    tzCurrent: (tz: string) =>
      `現在のタイムゾーン: *${tz}*\n\n変更するには: /timezone <tz>（例: /timezone Asia\\/Tokyo）`,

    langSetOk: (lang: string) =>
      `✅ Hermes の言語を *${lang}* に設定しました。\n\n今後この言語でメッセージを送ります。`,
    langInvalid: (input: string) =>
      `❌ 不明な言語: *${input}*\n\n以下から選択してください:\n• \`en\` — English\n• \`ja\` — 日本語\n• \`zh-tw\` — 繁體中文\n\n現在の設定を確認するには /language を送信してください。`,
    langCurrent: (lang: string) =>
      `現在の Hermes 言語: *${lang}*\n\n変更するには: /language <lang>（例: /language ja）`,

    dsarHeader: "⚠️ データ削除リクエスト",
    dsarWarning: "以下のデータが完全に削除されます：\n  • ファンとのツインでの会話履歴すべて\n  • ボイスリファレンスサンプル\n  • ペルソナ / コンスティテューション\n  • 生成されたすべてのボイスファイル\n\nあなたのツインは直ちにオフラインになります。削除は24時間以内に完了します。",
    dsarConfirmPrompt: "続行するには CONFIRM と入力してください。中断するには /cancel を送信してください。",
    dsarCancelled: "キャンセルしました。気が変わったら /dsar を再送してください。",
    dsarConfirmedTemplate: "確認が取れました。あなたのツインはオフラインになりました。監査 ID: {auditId}\n\n24時間以内にすべてのデータが削除されます。完了したらご連絡します。",
    dsarError: "現在 DSAR を処理できませんでした。問題が続く場合はサポートにお問い合わせください。",
  },

  'zh-tw': {
    notLinked: '您的 Telegram 帳號尚未連結。請使用 /start 進行連結。',
    twinActive: '▶️ 運行中',
    twinPaused: '⏸ 已暫停',

    pauseOk: (elapsed: number) =>
      `⏸ 數位分身已暫停。您的 AI 存在已下線。\n\n使用 /resume 重新啟動。\n\n_(資料庫寫入: ${elapsed}ms)_`,
    resumeOk: '▶️ 數位分身已重新啟動。您的 AI 存在已上線。',

    statusTitle: (name: string) => `*${name} — 狀態*`,
    statusTwin: (state: string) => `數位分身: ${state}`,
    statusFans: (n: number) => `活躍粉絲: ${n}`,
    statusCredits: '點數餘額: Slice 2 推出',

    revenueTitle: (name: string) => `*${name} — 收益*`,
    revenueGmvToday: '今日 GMV: — _(Slice 2 推出)_',
    revenueGmvWeek: '本週 GMV: — _(Slice 2 推出)_',
    revenuePacks: '點數包銷售: — _(Slice 2 推出)_',
    revenueFans: (n: number) => `活躍粉絲: ${n}`,
    revenueShare: '您的分潤: GMV 的 80%',

    tzSetOk: (tz: string) =>
      `✅ 時區已設定為 *${tz}*。\n\n收益摘要和提醒將使用此時區。`,
    tzInvalid: (input: string) =>
      `❌ 未知時區: *${input}*\n\n請使用 IANA 時區（如 \`Asia/Tokyo\`、\`Asia/Taipei\`、\`America/New_York\`）或快捷方式（\`JP\`、\`TW\`、\`US/East\`、\`US/West\`）。\n\n傳送 /timezone 查看目前設定。`,
    tzCurrent: (tz: string) =>
      `目前時區: *${tz}*\n\n修改方式: /timezone <tz>（例如 /timezone Asia\\/Taipei）`,

    langSetOk: (lang: string) =>
      `✅ Hermes 語言已設定為 *${lang}*。\n\n我之後將用此語言與您溝通。`,
    langInvalid: (input: string) =>
      `❌ 未知語言: *${input}*\n\n請從以下選擇:\n• \`en\` — English\n• \`ja\` — 日本語\n• \`zh-tw\` — 繁體中文\n\n傳送 /language 查看目前設定。`,
    langCurrent: (lang: string) =>
      `目前 Hermes 語言: *${lang}*\n\n修改方式: /language <lang>（例如 /language zh-tw）`,

    dsarHeader: "⚠️ 資料刪除請求",
    dsarWarning: "以下資料將被永久刪除：\n  • 粉絲與您數位分身的所有對話紀錄\n  • 聲音參考樣本\n  • 人物設定 / 個性說明\n  • 所有已生成的語音檔案\n\n您的數位分身將立即下線。刪除將於 24 小時內完成。",
    dsarConfirmPrompt: "輸入 CONFIRM 以繼續，或傳送 /cancel 中止。",
    dsarCancelled: "已取消。如果您改變主意，請再次傳送 /dsar。",
    dsarConfirmedTemplate: "已確認。您的數位分身現已下線。審計 ID：{auditId}\n\n所有資料將於 24 小時內刪除。完成後我們將通知您。",
    dsarError: "目前無法處理 DSAR 請求。如問題持續，請聯繫客服。",
  },
} as const satisfies Record<Lang, Record<string, unknown>>;

export type Strings = typeof strings.en;

export function t(lang: string): Strings {
  const l = (lang in strings ? lang : 'en') as Lang;
  return strings[l] as Strings;
}
