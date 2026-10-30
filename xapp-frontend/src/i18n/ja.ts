// Japanese (日本語) message catalog.
// Typed as Messages, so a missing or misnamed key fails the build — the
// English catalog (en.ts) stays the single source of truth for the shape.

import type { Messages } from "./en";

export const ja: Messages = {
  common: {
    brand: "DNS://Money",
    loading: "読み込み中…",
    back: "← 戻る",
    sessionUnavailable: "セッションを利用できません — xAppを再起動してください。",
    preparing: "準備中…",
    waitingSignature: "署名を待っています…",
    rejectedInXaman: "Xamanで拒否されました",
    signTimedOut: "署名リクエストがタイムアウトしました",
    signOpenFailed: "署名リクエストを開けませんでした — 下の方法をお試しください。",
    serverError: "サーバーエラー {status}",
  },

  tabs: {
    register: "エイリアス取得",
    send: "送金",
    gallery: "ギャラリー",
    buy: "入金",
    cold: "コールド",
  },

  cold: {
    title: "コールド金庫",
    intro:
      "鍵がLedgerの中にあるXRPアカウントから支払います。このアプリは依頼を送るだけです。すべての支払いは、パソコンのLedgerで承認します。このアプリはそのアカウントの鍵を持ちません。",
    codeLabel: "ペアリングコード",
    pair: "ペアリング",
    pairing: "ペアリング中…",
    pairHelp: "パソコンでブリッジを起動します。8桁のコードが出ます。コードは10分間、1回だけ使えます。",
    badCode: "コードが違うか、期限が切れています。",
    locked: "間違いが多すぎます。15分後にもう一度お試しください。",
    sessionEnded: "ペアリングが終了しました。新しいコードでもう一度ペアリングしてください。",
    vault: "金庫アカウント",
    onlyLedger: "このアカウントの資金は、Ledgerの署名がなければ動かせません。",
    to: "宛先",
    toSelf: "金庫アカウント自身には支払えません。",
    aliasNotFound: "pay:name が見つかりません。",
    aliasNoAddress: "その名前にはXRPアドレスがありません。",
    couldNotResolve: "その名前を調べられませんでした。",
    amount: "金額（XRP）",
    amountBad: "0より大きい数を入力してください。小数は6桁までです。",
    note: "メモ（任意）",
    noteHelp: "メモは承認アプリに表示されます。Ledgerの画面には表示されません。",
    send: "Ledgerに支払いを依頼",
    sending: "送信中…",
    requests: "依頼",
    empty: "依頼はまだありません。",
    check: "状態を確認",
    forget: "この金庫を忘れる",
    failedWhy: "パソコンのゲートがこの依頼を拒否しました。何も送金されていません。",
    tooManyOpen: "未完了の依頼が10件あります。先にそれらを終えてください。",
    badInput: "中継サーバーが依頼を拒否しました。アドレスと金額を確認してください。",
    network: "中継サーバーに接続できません。",
    generic: "問題が発生しました。もう一度お試しください。",
    status: {
      QUEUED: "パソコンを待っています",
      PENDING_APPROVAL: "Ledgerで承認してください",
      APPROVED: "Ledgerで署名中",
      CONFIRMED: "送金済み",
      REJECTED: "Ledgerで拒否されました。何も送金されていません。",
      FAILED: "失敗しました。何も送金されていません。",
      EXPIRED: "期限切れです。何も送金されていません。",
    },
  },

  steps: {
    chooseName: "名前を選択",
    confirm: "確認",
    sign: "署名",
  },

  avail: {
    checking: "確認中…",
    available: "✓ 利用可能",
    taken: "✗ 使用済み",
    reserved: "✗ 予約済みの名前",
    invalid: "✗ 形式が無効です",
  },

  mintStatus: {
    check: "状態を確認",
    preparing: "準備中…",
    rendering: "アイデンティティを生成中…",
    uploading: "IPFSにアップロード中…",
    minting: "XRP Ledgerでミント中…",
    complete: "アイデンティティをミントしました",
    working: "処理中…",
  },

  register: {
    alreadyTitle: "すでに登録済みです",
    oneAliasPerWallet:
      "ウォレットごとにエイリアスは1つです。Sendタブから DNS://Money の誰にでも支払えます。",

    doneTitle: "登録完了。",
    doneSubtitle: "あなたのエイリアスは XRP Ledger 上で有効です",
    nftClaimed: "NFTを受け取りました — Xamanウォレットに入っています。",
    nftReadyHint:
      "アイデンティティNFTがミントされました。署名するだけでウォレットに受け取れます（支払い不要）。",
    openingXaman: "Xamanを開いています…",
    claimNft: "NFTをウォレットに受け取る",
    mintRetrying:
      "ミント中に問題が発生しました。エイリアスは安全に予約されています — 担当チームに通知され、まもなくミントを完了します。",
    mintTakesAMinute: "通常1〜2分かかります。",
    registerAnother: "別のエイリアスを登録",

    step1Title: "名前を選択",
    step1Subtitle: "XRP Ledger 上のあなたの永久支払いエイリアス",
    // Aliases are Latin-only (input strips to lowercase ascii), so the
    // placeholder stays Latin to avoid inviting kana that would fail validation.
    namePlaceholder: "yourname",
    continue: "続ける →",

    step2Title: "エイリアスを確認",
    step2Subtitle: "署名する前に内容をご確認ください",
    rowAlias: "エイリアス",
    rowYouGet: "取得内容",
    youGetValue: "エイリアス＋アイデンティティNFT",
    rowCost: "費用",
    costValue: "{price} XRP",
    rowSlotsRemaining: "残り枠",
    rowRegisteredTo: "登録先",
    registerAndMint: "登録してミント",

    step3Title: "Xamanで署名",
    registeringAlias: "エイリアスを登録中…",
    approveInXaman: "Xamanウォレットで支払いを確認し、承認してください。",
    almostDone: "もうすぐ完了",
  },

  send: {
    sentTitle: "送金しました！",
    transactionId: "トランザクションID",
    sendAgain: "もう一度送金",
    sendToAlias: "送金先エイリアス",
    aliasPlaceholder: "pay:name",
    rowTo: "宛先",
    rowAddress: "アドレス",
    rowFee: "手数料",
    amountLabel: "金額（XRP）",
    memoLabel: "メモ（任意）",
    memoPlaceholder: "用途は？",
    signAndSend: "署名して送金",
    aliasNotFound: "エイリアスが見つかりません",
    couldNotResolve: "エイリアスを解決できませんでした",
  },

  gallery: {
    title: "ファウンディング・アイデンティティ",
    countMinted: "XRP Ledger 上で{count}件ミント済み",
    loadError: "ギャラリーを読み込めませんでした — しばらくして再度お試しください。",
    empty: "まだミントされたアイデンティティはありません。",
    viewIdentity: "{alias} を全画面で表示",
    openImage: "フル画像を表示",
    send: "送金",
    close: "閉じる",
    prev: "前へ",
    next: "次へ",
    position: "{total}件中{index}件目",
    copyTokenId: "トークンIDをコピー",
    tokenIdCopied: "トークンIDをコピーしました ✓",
  },

  buy: {
    title: "入金",
    intro:
      "XRPを追加して、pay:name への支払いや送金に使えます。MoonPayは第三者のサービスで、手数料は同社が定め、本人確認が必要な場合があります。DNS://Money が資金に触れることはありません。",
    deliverToAlias: "届け先エイリアス",
    rowTo: "宛先",
    rowAddress: "アドレス",
    aliasNotFound: "エイリアスが見つかりません",
    noXrplAddress: "エイリアスにXRPLアドレスがありません",
    notAvailable: "現在入金はご利用いただけません",
    couldNotResolve: "エイリアスを解決できませんでした",
    preparingCheckout: "チェックアウトを準備中…",
    buyXrp: "MoonPayへ進む",
    checkoutOpened:
      "ブラウザでチェックアウトを開きました。そちらで完了してください — MoonPayの決済後、XRPが{alias}に届きます。",
    couldNotStart: "チェックアウトを開始できませんでした",
  },

  sign: {
    notOpening: "署名リクエストが開きませんか？",
    reopen: "署名リクエストを開く",
    openInXaman: "開かない場合は Xaman で開く →",
  },

  legal: {
    terms: "利用規約",
    privacy: "プライバシー",
    support: "サポート",
  },
};
